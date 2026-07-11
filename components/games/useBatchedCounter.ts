"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A player's own live count for the current round: increments show up
 * instantly (optimistic, local), while writes to Firestore are batched on
 * an interval instead of firing on every tap. Seeds itself once per round
 * (keyed by roundKey) from the round's starting value, then trusts only
 * local increments for the rest of the round -- re-seeding from a snapshot
 * mid-round would make the number jump backward whenever a stale server
 * read lands between flushes.
 */
export function useBatchedCounter({
  active,
  roundKey,
  initialValue,
  batchMs,
  onFlush,
}: {
  active: boolean;
  roundKey: string;
  initialValue: number;
  batchMs: number;
  onFlush: (delta: number) => void;
}) {
  const [count, setCount] = useState(0);
  const pendingRef = useRef(0);
  const seededRoundRef = useRef<string | null>(null);
  const onFlushRef = useRef(onFlush);

  useEffect(() => {
    onFlushRef.current = onFlush;
  }, [onFlush]);

  useEffect(() => {
    if (active && seededRoundRef.current !== roundKey) {
      seededRoundRef.current = roundKey;
      pendingRef.current = 0;
      setCount(initialValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-seed on round change, not every initialValue update
  }, [active, roundKey]);

  const flushNow = () => {
    if (pendingRef.current > 0) {
      const delta = pendingRef.current;
      pendingRef.current = 0;
      onFlushRef.current(delta);
    }
  };

  useEffect(() => {
    if (!active) return;
    const id = setInterval(flushNow, batchMs);
    return () => {
      flushNow();
      clearInterval(id);
    };
  }, [active, batchMs]);

  const increment = () => {
    pendingRef.current += 1;
    setCount((c) => c + 1);
  };

  return { count, increment, flushNow };
}
