"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { usePeople } from "@/contexts/PersonContext";
import { submitSuikaScore } from "@/lib/suikaScores";
import { suikaFaceSrc } from "./suikaConfig";
import { SuikaResult } from "./SuikaResult";

const SECRET_SCORE = 1992;
/** Wall-clock timings (ms) for each phase of the 1992 overlay -- fade-in/hold/fade
 * for the text, then quick swaps into the photo and the closing phrase. Sums to
 * roughly the 6.5s the sequence is meant to take end to end. */
const EGG_TEXT_HOLD_MS = 1900;
const EGG_PHOTO_FADE_MS = 200;
const EGG_PHOTO_HOLD_MS = 2200;
const EGG_PHRASE_FADE_MS = 200;
const EGG_PHRASE_HOLD_MS = 2200;
const EGG_FADE_OUT_MS = 300;

type EggPhase = "idle" | "text" | "photo" | "phrase";

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

export function SuikaGame({ bouncyTrigger = 0 }: { bouncyTrigger?: number }) {
  const { activePersonId } = usePeople();
  const [runKey, setRunKey] = useState(0);
  const [score, setScore] = useState(0);
  const [nextStage, setNextStage] = useState<number | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [eggPhase, setEggPhase] = useState<EggPhase>("idle");
  const [eggVisible, setEggVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const eggTriggeredRef = useRef(false);
  const bouncyActiveRef = useRef(false);

  useEffect(() => {
    if (score !== SECRET_SCORE || eggTriggeredRef.current) return;
    eggTriggeredRef.current = true;

    const timers: ReturnType<typeof setTimeout>[] = [];
    setEggPhase("text");
    timers.push(setTimeout(() => setEggVisible(true), 20));
    timers.push(setTimeout(() => setEggVisible(false), EGG_TEXT_HOLD_MS));

    const photoAt = EGG_TEXT_HOLD_MS + EGG_PHOTO_FADE_MS;
    timers.push(
      setTimeout(() => {
        setEggPhase("photo");
        setEggVisible(true);
      }, photoAt),
    );
    const photoFadeOutAt = photoAt + EGG_PHOTO_HOLD_MS;
    timers.push(setTimeout(() => setEggVisible(false), photoFadeOutAt));

    const phraseAt = photoFadeOutAt + EGG_PHRASE_FADE_MS;
    timers.push(
      setTimeout(() => {
        setEggPhase("phrase");
        setEggVisible(true);
      }, phraseAt),
    );
    const phraseFadeOutAt = phraseAt + EGG_PHRASE_HOLD_MS;
    timers.push(setTimeout(() => setEggVisible(false), phraseFadeOutAt));
    timers.push(setTimeout(() => setEggPhase("idle"), phraseFadeOutAt + EGG_FADE_OUT_MS));

    return () => timers.forEach(clearTimeout);
  }, [score]);

  useEffect(() => {
    if (bouncyTrigger === 0 || bouncyActiveRef.current) return;
    bouncyActiveRef.current = true;
    setToastVisible(true);
    const id = setTimeout(() => setToastVisible(false), 1600);
    return () => clearTimeout(id);
  }, [bouncyTrigger]);

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
    setEggPhase("idle");
    setEggVisible(false);
    setToastVisible(false);
    eggTriggeredRef.current = false;
    bouncyActiveRef.current = false;
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
        paused={eggPhase !== "idle"}
        bouncyTrigger={bouncyTrigger}
      />
      <p className="text-center text-[11px] text-ink/40">
        press and drag, release to drop &middot; don&apos;t overflow the line
      </p>

      {eggPhase !== "idle" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink transition-opacity duration-200"
          style={{ opacity: eggVisible ? 1 : 0 }}
        >
          {eggPhase === "text" && (
            <p className="font-heading text-3xl font-semibold text-cream">1992...</p>
          )}
          {eggPhase === "photo" && (
            // eslint-disable-next-line @next/next/no-img-element -- full-bleed overlay photo, dimensions unknown ahead of time
            <img
              src="/easter-eggs/jaehee-1992.jpg"
              alt=""
              className="h-full w-full object-cover"
            />
          )}
          {eggPhase === "phrase" && (
            <p className="px-8 text-center font-heading text-2xl font-semibold text-cream">
              1992: history was made
            </p>
          )}
        </div>
      )}

      {toastVisible && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="rounded-chip bg-ink px-4 py-2 text-[13px] font-semibold text-cream shadow-card">
            bouncy mode on
          </div>
        </div>
      )}
    </div>
  );
}
