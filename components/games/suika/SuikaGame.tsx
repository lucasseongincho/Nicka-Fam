"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { usePeople } from "@/contexts/PersonContext";
import { submitSuikaScore } from "@/lib/suikaScores";
import { suikaFaceSrc } from "./suikaConfig";
import { SuikaResult } from "./SuikaResult";

// matter-js touches the DOM/canvas at setup time, so this can never run
// during SSR -- load it client-only and keep it out of every other page's
// bundle.
const SuikaCanvas = dynamic(
  () => import("./SuikaCanvas").then((m) => m.SuikaCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] w-full max-w-[300px] items-center justify-center text-sm text-ink/40">
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

export function SuikaGame() {
  const { activePersonId } = usePeople();
  const [runKey, setRunKey] = useState(0);
  const [score, setScore] = useState(0);
  const [nextStage, setNextStage] = useState<number | null>(null);
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
            ({ isNewPersonalBest, isNewGroupBest } = await submitSuikaScore(
              activePersonId,
              finalScore,
            ));
          } catch (err) {
            // Show the result either way -- a flaky connection shouldn't
            // strand the player on a frozen board without their score.
            console.error("failed to submit suika score", err);
          }
        }
        setResult({ score: finalScore, isNewPersonalBest, isNewGroupBest });
        setSubmitting(false);
      })();
    },
    [activePersonId],
  );

  const handleRetry = () => {
    setScore(0);
    setNextStage(null);
    setResult(null);
    setSubmitting(false);
    setRunKey((k) => k + 1);
  };

  if (result) {
    return (
      <SuikaResult
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
        {nextStage !== null && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-[11px] uppercase tracking-wide text-ink/40">next</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-card">
              <Image src={suikaFaceSrc(nextStage)} alt="" width={32} height={32} />
            </div>
          </div>
        )}
      </div>
      <SuikaCanvas
        key={runKey}
        onScoreChange={setScore}
        onNextStageChange={setNextStage}
        onGameOver={handleGameOver}
      />
      <p className="text-center text-[11px] text-ink/40">
        tap or click to drop &middot; don&apos;t overflow the line
      </p>
    </div>
  );
}
