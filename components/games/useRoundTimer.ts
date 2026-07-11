"use client";

import { useEffect, useRef, useState } from "react";
import { syncedNow } from "@/lib/clockSync";

/**
 * Shared "get ready, then count down" clock for any timed game round.
 * Anchors everything off a single server-resolved startedAt plus a
 * clock-synced "now" (not each device's raw clock), so every player's
 * prepare countdown and round timer agree regardless of network latency or
 * an inaccurate device clock. Calls onRoundEnd exactly once when time's up.
 */
export function useRoundTimer({
  active,
  startedAtMs,
  prepareSeconds,
  durationSeconds,
  onRoundEnd,
}: {
  active: boolean;
  startedAtMs: number | null;
  prepareSeconds: number;
  durationSeconds: number;
  onRoundEnd: () => void;
}) {
  const [now, setNow] = useState(() => syncedNow());
  const endedRef = useRef(false);
  const onRoundEndRef = useRef(onRoundEnd);

  useEffect(() => {
    onRoundEndRef.current = onRoundEnd;
  }, [onRoundEnd]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(syncedNow()), 100);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    endedRef.current = false;
  }, [startedAtMs]);

  const roundStartMs = startedAtMs !== null ? startedAtMs + prepareSeconds * 1000 : null;
  const endsAtMs = roundStartMs !== null ? roundStartMs + durationSeconds * 1000 : null;
  const isPreparing = roundStartMs !== null && now < roundStartMs;
  const prepareRemainingSeconds =
    roundStartMs !== null ? Math.max(1, Math.ceil((roundStartMs - now) / 1000)) : prepareSeconds;
  const remainingMs = endsAtMs !== null ? Math.max(0, endsAtMs - now) : durationSeconds * 1000;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const isRoundOver = endsAtMs !== null && now >= endsAtMs;

  // Whichever client notices first flips the round over; idempotent either way.
  useEffect(() => {
    if (active && isRoundOver && !endedRef.current) {
      endedRef.current = true;
      onRoundEndRef.current();
    }
  }, [active, isRoundOver]);

  return {
    now,
    roundStartMs,
    endsAtMs,
    isPreparing,
    prepareRemainingSeconds,
    remainingMs,
    remainingSeconds,
    isRoundOver,
  };
}
