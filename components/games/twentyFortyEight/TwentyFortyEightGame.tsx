"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePeople } from "@/contexts/PersonContext";
import { submitTwentyFortyEightScore } from "@/lib/twentyFortyEightScores";
import { TwentyFortyEightResult } from "./TwentyFortyEightResult";

// The board's initial tiles are randomly spawned at mount, so it can't be
// server-rendered without the client re-rolling different tiles on
// hydration -- load it client-only, same reasoning as Suika's canvas.
const TwentyFortyEightBoard = dynamic(
  () => import("./TwentyFortyEightBoard").then((m) => m.TwentyFortyEightBoard),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-square w-full max-w-[300px] items-center justify-center text-sm text-ink/40">
        loading the board...
      </div>
    ),
  },
);

type RunResult = {
  score: number;
  isNewPersonalBest: boolean;
  isNewGroupBest: boolean;
};

const WIN_TOAST_MS = 2200;

export function TwentyFortyEightGame() {
  const { activePersonId } = usePeople();
  const [runKey, setRunKey] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showWinToast, setShowWinToast] = useState(false);

  useEffect(() => {
    if (!showWinToast) return;
    const id = setTimeout(() => setShowWinToast(false), WIN_TOAST_MS);
    return () => clearTimeout(id);
  }, [showWinToast]);

  const handleGameOver = useCallback(
    (finalScore: number) => {
      setSubmitting(true);
      void (async () => {
        let isNewPersonalBest = false;
        let isNewGroupBest = false;
        if (activePersonId) {
          try {
            ({ isNewPersonalBest, isNewGroupBest } = await submitTwentyFortyEightScore(
              activePersonId,
              finalScore,
            ));
          } catch (err) {
            // Show the result either way -- a flaky connection shouldn't
            // strand the player on a frozen board without their score.
            console.error("failed to submit 2048 score", err);
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
    setResult(null);
    setSubmitting(false);
    setShowWinToast(false);
    setRunKey((k) => k + 1);
  };

  if (result) {
    return (
      <TwentyFortyEightResult
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
      </div>
      <TwentyFortyEightBoard
        key={runKey}
        onScoreChange={setScore}
        onGameOver={handleGameOver}
        onWin={() => setShowWinToast(true)}
      />
      <p className="text-center text-[11px] text-ink/40">
        swipe or use arrow keys &middot; merge matching faces
      </p>

      {showWinToast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <div className="rounded-chip bg-orange px-4 py-2 text-[13px] font-semibold text-card shadow-card">
            🎉 you win! keep going for a higher score
          </div>
        </div>
      )}
    </div>
  );
}
