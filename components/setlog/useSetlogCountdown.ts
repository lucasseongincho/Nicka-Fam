"use client";

import { useEffect, useState } from "react";
import { ensureClockSynced, syncedNow } from "@/lib/clockSync";
import { SETLOG_WINDOW_MINUTES } from "@/lib/setlogTime";
import type { SetlogSlot } from "@/lib/types";

const WINDOW_MS = SETLOG_WINDOW_MINUTES * 60_000;

/**
 * Ticks down the 8-minute capture window for one slot, anchored to the
 * clock-synced server time (same reasoning as useRoundTimer for mini-games)
 * so the countdown a person sees agrees with when the server-side merge
 * actually closes the window, regardless of this device's own clock.
 */
export function useSetlogCountdown(slot: SetlogSlot | null) {
  const [now, setNow] = useState(() => syncedNow());

  useEffect(() => {
    void ensureClockSynced();
  }, []);

  useEffect(() => {
    if (!slot) return;
    const id = setInterval(() => setNow(syncedNow()), 250);
    return () => clearInterval(id);
  }, [slot]);

  if (!slot) return { isOpen: false, remainingMs: 0, remainingSeconds: 0, label: "0:00" };

  const startMs = slot.scheduledAt.toMillis();
  const endsAtMs = startMs + WINDOW_MS;
  const remainingMs = Math.max(0, endsAtMs - now);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return {
    isOpen: remainingMs > 0,
    remainingMs,
    remainingSeconds,
    label: `${minutes}:${String(seconds).padStart(2, "0")}`,
  };
}
