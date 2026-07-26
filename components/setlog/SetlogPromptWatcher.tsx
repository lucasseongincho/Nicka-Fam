"use client";

import { useEffect, useState } from "react";
import { usePeople } from "@/contexts/PersonContext";
import { currentSetlogSlotId, listenSetlogSlot } from "@/lib/setlog";
import { etHour, isWithinNotifyHours } from "@/lib/setlogTime";
import type { SetlogSlot } from "@/lib/types";
import { CaptureFlow } from "@/components/setlog/CaptureFlow";
import { useSetlogCountdown } from "@/components/setlog/useSetlogCountdown";

/**
 * Mounted once in the app shell (app/(app)/layout.tsx) so a capture prompt
 * surfaces no matter which tab someone's on -- the push notification is
 * what wakes the device/browser, this is what actually gets them into the
 * recording flow once they're back in the app.
 */
export function SetlogPromptWatcher() {
  const { activePersonId, activePerson } = usePeople();

  const [slotId, setSlotId] = useState<string | null>(() => currentSetlogSlotId());
  const [slot, setSlot] = useState<SetlogSlot | null>(null);
  // Every hour has a recordable slot, but this unprompted nag banner should
  // only surface during the same 6am-11pm window the push notification
  // itself respects -- otherwise it'd nag people at 3am for an hour they
  // were never notified about.
  const [notifyWindowOpen, setNotifyWindowOpen] = useState(() => isWithinNotifyHours(etHour(new Date())));
  // Which open slot's capture flow the person has closed back down to a
  // banner -- tracked as a slot id (not a plain boolean) so a *new* slot
  // opening always starts back in the full capture flow rather than
  // inheriting the previous slot's dismissed state.
  const [dismissedSlotId, setDismissedSlotId] = useState<string | null>(null);

  // The "current" slot changes at the top of every hour with no external
  // event to react to, so just recheck periodically.
  useEffect(() => {
    const id = setInterval(() => {
      setSlotId(currentSetlogSlotId());
      setNotifyWindowOpen(isWithinNotifyHours(etHour(new Date())));
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!slotId) return;
    return listenSetlogSlot(slotId, setSlot);
  }, [slotId]);

  // slotId flipping to null (e.g. active hours just ended) doesn't clear
  // `slot` state directly -- that would mean calling setState unconditionally
  // in an effect body -- so gate its use here instead.
  const effectiveSlot = slotId ? slot : null;
  const countdown = useSetlogCountdown(!!effectiveSlot);
  const alreadyPosted = !!(
    activePersonId && effectiveSlot?.submittedPersonIds.includes(activePersonId)
  );
  const openSlot =
    effectiveSlot && !alreadyPosted && countdown.isOpen && notifyWindowOpen ? effectiveSlot : null;
  const showCapture = !!openSlot && dismissedSlotId !== openSlot.id;

  if (!activePersonId || !activePerson || !openSlot) return null;

  if (showCapture) {
    return (
      <CaptureFlow
        personId={activePersonId}
        personName={activePerson.name}
        slotId={openSlot.id}
        slotHour={openSlot.hour}
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
