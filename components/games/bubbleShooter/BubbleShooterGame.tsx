"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { usePeople } from "@/contexts/PersonContext";
import { notifyCategory } from "@/lib/notifyClient";
import { submitBubbleShooterScore } from "@/lib/bubbleShooterScores";
import { SHOTS_PER_DROP, bubbleFaceSrc, bubbleRingColor } from "./bubbleShooterConfig";
import { BubbleShooterResult } from "./BubbleShooterResult";

// The board's initial grid is randomly generated at mount, so it can't be
// server-rendered without the client re-rolling a different board on
// hydration -- load it client-only, same reasoning as Suika/Candy Match.
const BubbleShooterCanvas = dynamic(
  () => import("./BubbleShooterCanvas").then((m) => m.BubbleShooterCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex w-full max-w-[300px] items-center justify-center text-sm text-ink/40" style={{ aspectRatio: "300 / 460" }}>
        loading the field...
      </div>
    ),
  },
);

type RunResult = {
  score: number;
  isNewPersonalBest: boolean;
  isNewGroupBest: boolean;
};

export function BubbleShooterGame() {
  const { people, activePersonId } = usePeople();
  const [runKey, setRunKey] = useState(0);
  const [score, setScore] = useState(0);
  const [nextType, setNextType] = useState<number | null>(null);
  const [shotsUntilDrop, setShotsUntilDrop] = useState(SHOTS_PER_DROP);
  const [result, setResult] = useState<RunResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleGameOver = useCallback(
    (finalScore: number) => {
      setSubmitting(true);
      void (async () => {
        let isNewPersonalBest = false;
        let isNewGroupBest = false;
        if (activePersonId) {
          try {
            let passedPersonId: string | null = null;
            ({ isNewPersonalBest, isNewGroupBest, passedPersonId } = await submitBubbleShooterScore(
              activePersonId,
              finalScore,
            ));
            if (passedPersonId) {
              const myName = people.find((p) => p.id === activePersonId)?.name ?? "someone";
              const passedName = people.find((p) => p.id === passedPersonId)?.name ?? "someone";
              void notifyCategory({
                category: "leaderboards",
                actorId: activePersonId,
                title: "leaderboards",
                body: `${myName} passed ${passedName} in Bubble Shooter`,
                url: "/game/bubble-shooter",
              });
            }
          } catch (err) {
            // Show the result either way -- a flaky connection shouldn't
            // strand the player on a frozen board without their score.
            console.error("failed to submit bubble shooter score", err);
          }
        }
        setResult({ score: finalScore, isNewPersonalBest, isNewGroupBest });
        setSubmitting(false);
      })();
    },
    [activePersonId, people],
  );

  const handleRetry = () => {
    setScore(0);
    setNextType(null);
    setShotsUntilDrop(SHOTS_PER_DROP);
    setResult(null);
    setSubmitting(false);
    setRunKey((k) => k + 1);
  };

  if (result) {
    return (
      <BubbleShooterResult
        score={result.score}
        isNewPersonalBest={result.isNewPersonalBest}
        isNewGroupBest={result.isNewGroupBest}
        submitting={submitting}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full max-w-[300px] items-center justify-between px-1">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink/40">score</p>
          <p className="font-heading text-2xl font-bold text-ink">{score}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-ink/40">ceiling drops in</p>
          <p className="font-heading text-2xl font-bold text-ink">{shotsUntilDrop}</p>
        </div>
        {nextType !== null && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-[11px] uppercase tracking-wide text-ink/40">next</p>
            <div
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-[3px] bg-card"
              style={{ borderColor: bubbleRingColor(nextType) }}
            >
              <Image src={bubbleFaceSrc(nextType)} alt="" width={32} height={32} className="rounded-full object-cover" />
            </div>
          </div>
        )}
      </div>
      <BubbleShooterCanvas
        key={runKey}
        onScoreChange={setScore}
        onNextTypeChange={setNextType}
        onShotsUntilDropChange={setShotsUntilDrop}
        onGameOver={handleGameOver}
      />
      <p className="text-center text-[11px] text-ink/40">
        drag to aim, release to shoot &middot; match 3+ of a color to pop
      </p>
    </div>
  );
}
