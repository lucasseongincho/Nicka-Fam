"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePeople } from "@/contexts/PersonContext";
import { submitDinoRunnerScore } from "@/lib/dinoRunnerScores";
import { DinoRunnerResult } from "./DinoRunnerResult";

// The canvas drives its own rAF loop and reads window/Image directly, so it
// can't be server-rendered -- load it client-only, same reasoning as Suika
// and 2048's canvas/board.
const DinoRunnerCanvas = dynamic(
  () => import("./DinoRunnerCanvas").then((m) => m.DinoRunnerCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[260px] w-full max-w-[640px] items-center justify-center text-sm text-ink/40">
        loading the track...
      </div>
    ),
  },
);

type RunResult = {
  score: number;
  isNewPersonalBest: boolean;
  isNewGroupBest: boolean;
};

export function DinoRunnerGame() {
  const { people, loading, activePersonId, activePerson } = usePeople();
  const [runKey, setRunKey] = useState(0);
  const [score, setScore] = useState(0);
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
          // the placeholder circle in-game, not block the run from starting.
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
    // this person is the only one in the app -- obstacles need some face.
    return others.length > 0 ? others : people.map((p) => p.id);
  }, [people, activePersonId]);

  const handleGameOver = useCallback(
    (finalScore: number) => {
      setSubmitting(true);
      void (async () => {
        let isNewPersonalBest = false;
        let isNewGroupBest = false;
        if (activePersonId) {
          try {
            ({ isNewPersonalBest, isNewGroupBest } = await submitDinoRunnerScore(
              activePersonId,
              finalScore,
            ));
          } catch (err) {
            // Show the result either way -- a flaky connection shouldn't
            // strand the player on a frozen run without their score.
            console.error("failed to submit dino runner score", err);
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
    setRunKey((k) => k + 1);
  };

  if (result) {
    return (
      <DinoRunnerResult
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
    <>
      <div className="dino-rotate-prompt flex-col items-center gap-3 py-16 text-center">
        <p className="text-4xl">📱↻</p>
        <p className="font-heading text-base font-semibold text-ink">
          turn your phone sideways
        </p>
        <p className="text-[13px] text-ink/50">Dino Runner plays best in landscape</p>
      </div>

      <div className="dino-play-area flex w-full flex-col items-center gap-3">
        <div className="flex w-full max-w-[640px] items-center justify-between px-1">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink/40">score</p>
            <p className="font-heading text-2xl font-bold text-ink">{score}</p>
          </div>
        </div>
        <DinoRunnerCanvas
          key={runKey}
          personImages={personImages}
          activePersonId={activePersonId}
          otherPersonIds={otherPersonIds}
          onScoreChange={setScore}
          onGameOver={handleGameOver}
        />
        <p className="dino-hide-in-fullscreen text-center text-[11px] text-ink/40">
          tap left to jump, right to duck &middot; or ↑/space to jump, ↓ to duck
        </p>
      </div>
    </>
  );
}
