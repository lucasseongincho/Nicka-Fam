"use client";

import { useEffect, useState } from "react";
import { ensureClockSynced, syncedNow } from "@/lib/clockSync";
import { etDateString, etHour, etSlotEndsAtUtc } from "@/lib/setlogTime";

/**
 * Ticks down the time remaining in the current hour's slot (always "until
 * the top of the next hour," since slots are fixed wall-clock hours). Every
 * hour of the day is recordable -- 6am-11pm ET is only when the push
 * notification fires, not a restriction on this window. Anchored to the
 * clock-synced server time, same reasoning as useRoundTimer for mini-games,
 * so this agrees with the server regardless of this device's own clock.
 */
export function useSetlogCountdown(active: boolean) {
  const [now, setNow] = useState(() => syncedNow());

  useEffect(() => {
    void ensureClockSynced();
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(syncedNow()), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return { isOpen: false, remainingMs: 0, remainingSeconds: 0, label: "0:00" };

  const nowDate = new Date(now);
  const hour = etHour(nowDate);
  const endsAtMs = etSlotEndsAtUtc(etDateString(nowDate), hour).getTime();
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
