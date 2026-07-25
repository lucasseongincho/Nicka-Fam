"use client";

import { useEffect, useState } from "react";
import { usePeople } from "@/contexts/PersonContext";
import { ensureClockSynced, syncedNow } from "@/lib/clockSync";
import { findOpenSetlogSlot, listenMySetlogClips, listenSetlogPrompts, todaySetlogDate } from "@/lib/setlog";
import type { SetlogPromptsDay } from "@/lib/types";
import { CaptureFlow } from "@/components/setlog/CaptureFlow";
import { useSetlogCountdown } from "@/components/setlog/useSetlogCountdown";

/**
 * Mounted once in the app shell (app/(app)/layout.tsx) so a capture prompt
 * surfaces no matter which tab someone's on -- the push notification is
 * what wakes the device/browser, this is what actually gets them into the
 * recording flow once they're back in the app.
 */
export function SetlogPromptWatcher() {
  const { activePersonId } = usePeople();
  const date = todaySetlogDate();

  const [prompts, setPrompts] = useState<SetlogPromptsDay | null>(null);
  const [mySlotIds, setMySlotIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => syncedNow());
  // Which open slot's capture flow the person has closed back down to a
  // banner -- tracked as a slot id (not a plain boolean) so a *new* slot
  // opening always starts back in the full capture flow rather than
  // inheriting the previous slot's dismissed state.
  const [dismissedSlotId, setDismissedSlotId] = useState<string | null>(null);

  useEffect(() => {
    void ensureClockSynced();
  }, []);

  useEffect(() => listenSetlogPrompts(date, setPrompts), [date]);

  useEffect(() => {
    if (!activePersonId) return;
    return listenMySetlogClips(date, activePersonId, (clips) => {
      setMySlotIds(new Set(clips.map((c) => c.slotId)));
    });
  }, [date, activePersonId]);

  useEffect(() => {
    const id = setInterval(() => setNow(syncedNow()), 1000);
    return () => clearInterval(id);
  }, []);

  const openSlot = findOpenSetlogSlot(prompts, mySlotIds, now);
  const countdown = useSetlogCountdown(openSlot);
  // Defaults to the full capture flow (not the banner) the moment a slot
  // opens, since dismissedSlotId can only ever equal a *previous* slot's id.
  const showCapture = !!openSlot && dismissedSlotId !== openSlot.id;

  if (!activePersonId || !openSlot) return null;

  if (showCapture) {
    return (
      <CaptureFlow
        personId={activePersonId}
        date={date}
        slotId={openSlot.id}
        remainingLabel={countdown.label}
        isWindowOpen={countdown.isOpen}
        onDone={() => setDismissedSlotId(openSlot.id)}
      />
    );
  }

  return (
    <button
      onClick={() => setDismissedSlotId(null)}
      className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-sm cursor-pointer items-center justify-between rounded-pill border-2 border-ink bg-orange px-4 py-3 shadow-button"
    >
      <span className="font-heading text-sm font-semibold text-card">
        🎥 time to capture your moment!
      </span>
      <span className="rounded-pill bg-card px-2 py-0.5 font-heading text-xs font-semibold text-ink">
        {countdown.label}
      </span>
    </button>
  );
}
