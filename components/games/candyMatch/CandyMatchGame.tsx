"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePeople } from "@/contexts/PersonContext";
import { submitCandyMatchScore } from "@/lib/candyMatchScores";
import { MOVES_LIMIT } from "./candyMatchConfig";
import { CandyMatchResult } from "./CandyMatchResult";

// The board's initial tiles are randomly generated at mount, so it can't
// be server-rendered without the client re-rolling a different board on
// hydration -- load it client-only, same reasoning as Suika/2048.
const CandyMatchBoard = dynamic(
  () => import("./CandyMatchBoard").then((m) => m.CandyMatchBoard),
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

const RESHUFFLE_TOAST_MS = 2000;

export function CandyMatchGame() {
  const { activePersonId } = usePeople();
  const [runKey, setRunKey] = useState(0);
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(MOVES_LIMIT);
  const [result, setResult] = useState<RunResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showReshuffleToast, setShowReshuffleToast] = useState(false);

  useEffect(() => {
    if (!showReshuffleToast) return;
    const id = setTimeout(() => setShowReshuffleToast(false), RESHUFFLE_TOAST_MS);
    return () => clearTimeout(id);
  }, [showReshuffleToast]);

  const handleGameOver = useCallback(
    (finalScore: number) => {
      setSubmitting(true);
      void (async () => {
        let isNewPersonalBest = false;
        let isNewGroupBest = false;
        if (activePersonId) {
          try {
            ({ isNewPersonalBest, isNewGroupBest } = await submitCandyMatchScore(
              activePersonId,
              finalScore,
            ));
          } catch (err) {
            // Show the result either way -- a flaky connection shouldn't
            // strand the player on a frozen board without their score.
            console.error("failed to submit candy match score", err);
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
    setMovesLeft(MOVES_LIMIT);
    setResult(null);
    setSubmitting(false);
    setShowReshuffleToast(false);
    setRunKey((k) => k + 1);
  };

  if (result) {
    return (
      <CandyMatchResult
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
          <p className="text-[11px] uppercase tracking-wide text-ink/40">moves left</p>
          <p className="font-heading text-2xl font-bold text-ink">{movesLeft}</p>
        </div>
      </div>
      <CandyMatchBoard
        key={runKey}
        movesLimit={MOVES_LIMIT}
        onScoreChange={setScore}
        onMovesChange={setMovesLeft}
        onGameOver={handleGameOver}
        onReshuffle={() => setShowReshuffleToast(true)}
      />
      <p className="text-center text-[11px] text-ink/40">
        drag a candy into a neighbor to swap &middot; match 3+ to clear
      </p>

      {showReshuffleToast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <div className="rounded-chip bg-ink px-4 py-2 text-[13px] font-semibold text-cream shadow-card">
            no moves left — board reshuffled
          </div>
        </div>
      )}
    </div>
  );
}
