"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePeople } from "@/contexts/PersonContext";
import { notifyCategory } from "@/lib/notifyClient";
import { submitBubbleBobbleScore } from "@/lib/bubbleBobbleScores";
import { BubbleBobbleResult } from "./BubbleBobbleResult";
import { BUBBLE_BOBBLE_LEVEL_COUNT } from "./bubbleBobbleLevels";

// The canvas drives its own rAF loop and reads window/Image directly, so it
// can't be server-rendered -- load it client-only, same reasoning as Suika
// and Dino Runner's canvas.
const BubbleBobbleCanvas = dynamic(
  () => import("./BubbleBobbleCanvas").then((m) => m.BubbleBobbleCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[520px] w-full max-w-[360px] items-center justify-center text-sm text-ink/40">
        loading the cave...
      </div>
    ),
  },
);

type RunResult = {
  score: number;
  isNewPersonalBest: boolean;
  isNewGroupBest: boolean;
};

const BANNER_VISIBLE_MS = 1300;

export function BubbleBobbleGame() {
  const { people, loading, activePersonId, activePerson } = usePeople();
  const [runKey, setRunKey] = useState(0);
  const [score, setScore] = useState(0);
  const [levelNumber, setLevelNumber] = useState(1);
  const [loopNumber, setLoopNumber] = useState(0);
  const [banner, setBanner] = useState<{ text: string; isWin: boolean } | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [personImages, setPersonImages] = useState<Map<string, HTMLImageElement> | null>(null);

  // Only changes when ids/photoUrls actually change, so a PersonProvider
  // snapshot re-render with the same people doesn't re-trigger a full
  // photo reload every time.
  const peopleKey = useMemo(() => people.map((p) => `${p.id}:${p.photoUrl}`).join("|"), [people]);

  useEffect(() => {
    if (people.length === 0) return;
    let cancelled = false;
    const map = new Map<string, HTMLImageElement>();
    const settled = people.map(
      (p) =>
        new Promise<void>((resolve) => {
          const img = new window.Image();
          // Resolve on error too -- a broken photo URL should fall back to
          // the placeholder ring in-game, not block the run from starting.
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = p.photoUrl;
          map.set(p.id, img);
        }),
    );
    void Promise.all(settled).then(() => {
      if (!cancelled) setPersonImages(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peopleKey]);

  const otherPersonIds = useMemo(() => {
    const others = people.filter((p) => p.id !== activePersonId).map((p) => p.id);
    // Fall back to everyone (including the active player) in the rare case
    // this person is the only one in the app -- enemies need some face.
    return others.length > 0 ? others : people.map((p) => p.id);
  }, [people, activePersonId]);

  const handleLevelChange = useCallback((level: number, loop: number) => {
    setLevelNumber(level);
    setLoopNumber(loop);
  }, []);

  const handleLevelCleared = useCallback((clearedLevelNumber: number, isWin: boolean) => {
    setBanner({
      text: isWin ? "🎉 you win! the cave loops back, tougher" : `level ${clearedLevelNumber} clear!`,
      isWin,
    });
    setTimeout(() => setBanner(null), BANNER_VISIBLE_MS);
  }, []);

  const handleGameOver = useCallback(
    (finalScore: number) => {
      setSubmitting(true);
      void (async () => {
        let isNewPersonalBest = false;
        let isNewGroupBest = false;
        if (activePersonId) {
          try {
            let passedPersonId: string | null = null;
            ({ isNewPersonalBest, isNewGroupBest, passedPersonId } = await submitBubbleBobbleScore(
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
                body: `${myName} passed ${passedName} in Bubble Bobble`,
                url: "/game/bubble-bobble",
              });
            }
          } catch (err) {
            // Show the result either way -- a flaky connection shouldn't
            // strand the player on a frozen run without their score.
            console.error("failed to submit bubble bobble score", err);
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
    setLevelNumber(1);
    setLoopNumber(0);
    setBanner(null);
    setResult(null);
    setSubmitting(false);
    setRunKey((k) => k + 1);
  };

  if (result) {
    return (
      <BubbleBobbleResult
        score={result.score}
        isNewPersonalBest={result.isNewPersonalBest}
        isNewGroupBest={result.isNewGroupBest}
        submitting={submitting}
        onRetry={handleRetry}
      />
    );
  }

  if (loading || !activePersonId || !activePerson) {
    return <p className="pt-10 text-center text-ink/40">loading...</p>;
  }

  if (!personImages) {
    return (
      <p className="pt-10 text-center text-ink/40">loading everyone&apos;s photos...</p>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex w-full max-w-[360px] items-center justify-between px-1">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink/40">score</p>
          <p className="font-heading text-2xl font-bold text-ink">{score}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-ink/40">level</p>
          <p className="font-heading text-2xl font-bold text-ink">
            {levelNumber}
            <span className="text-sm font-semibold text-ink/40">/{BUBBLE_BOBBLE_LEVEL_COUNT}</span>
            {loopNumber > 0 && <span className="ml-1 text-sm font-semibold text-orange">×{loopNumber + 1}</span>}
          </p>
        </div>
      </div>

      <div className="bbobble-stage">
        <BubbleBobbleCanvas
          key={runKey}
          personImages={personImages}
          otherPersonIds={otherPersonIds}
          onScoreChange={setScore}
          onLevelChange={handleLevelChange}
          onLevelCleared={handleLevelCleared}
          onGameOver={handleGameOver}
        />
        {banner && (
          <div className="bbobble-banner">
            <p
              className={`rounded-chip px-4 py-2 text-center text-sm font-semibold shadow-button ${
                banner.isWin ? "bg-orange text-card" : "bg-ink text-paper"
              }`}
            >
              {banner.text}
            </p>
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-ink/40">
        arrows/WASD to move &middot; space to jump &middot; X to blow a bubble
      </p>
    </div>
  );
}
