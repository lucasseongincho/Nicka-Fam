"use client";

import { useEffect, useRef, useState } from "react";
import { usePeople } from "@/contexts/PersonContext";
import {
  currentSetlogSlotId,
  isClipEditable,
  listenSetlogClipsForSlot,
  listenSetlogSlotsForDate,
  todaySetlogDate,
} from "@/lib/setlog";
import { formatHourLabel } from "@/lib/setlogTime";
import type { SetlogClip, SetlogSlot } from "@/lib/types";
import { Mascot } from "@/components/ui/Mascot";
import { CaptureFlow } from "@/components/setlog/CaptureFlow";
import { SetlogClipBox } from "@/components/setlog/SetlogClipBox";
import { SetlogCommentSheet } from "@/components/setlog/SetlogCommentSheet";
import { SetlogEditCaptionModal } from "@/components/setlog/SetlogEditCaptionModal";
import { SetlogSlotChatroom } from "@/components/setlog/SetlogSlotChatroom";
import { useSetlogCountdown } from "@/components/setlog/useSetlogCountdown";

/** Pure calendar-date arithmetic (no timezone conversion needed -- both sides are already ET date strings). */
function shiftDate(date: string, deltaDays: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, "0"),
    String(next.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

const SWIPE_THRESHOLD_PX = 60;

export default function SetlogPage() {
  const { people, activePersonId } = usePeople();

  const [date, setDate] = useState(() => todaySetlogDate());
  const [slots, setSlots] = useState<SetlogSlot[]>([]);
  const [slotIndex, setSlotIndex] = useState(0);
  const [clips, setClips] = useState<SetlogClip[]>([]);
  const [commentsFor, setCommentsFor] = useState<SetlogClip | null>(null);
  const [editingClip, setEditingClip] = useState<SetlogClip | null>(null);
  const [showChatroom, setShowChatroom] = useState(false);
  const [recordingSlot, setRecordingSlot] = useState<SetlogSlot | null>(null);

  const touchStartX = useRef<number | null>(null);
  const lastLoadedDate = useRef<string | null>(null);

  useEffect(() => listenSetlogSlotsForDate(date, setSlots), [date]);

  // Default to the most recent slot whenever a *new* date's slots first
  // arrive -- most relevant for today (the current hour) and for past days
  // (the day's last slot) alike. Only resets on an actual date change, not
  // every live update to the same day's slots.
  useEffect(() => {
    if (lastLoadedDate.current === date) return;
    lastLoadedDate.current = date;
    setSlotIndex(Math.max(0, slots.length - 1));
  }, [date, slots]);

  const slot = slots[slotIndex] ?? null;

  useEffect(() => {
    if (!slot) return;
    return listenSetlogClipsForSlot(slot.id, setClips);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed on slot?.id, not the whole slot object, so a live submittedPersonIds update on the same slot doesn't re-subscribe the clips listener
  }, [slot?.id]);

  // Guard usage rather than clearing `clips` state directly when slot goes
  // away (that would be an unconditional setState call in an effect body).
  const visibleClips = slot ? clips : [];

  const activePerson = people.find((p) => p.id === activePersonId);
  const countdown = useSetlogCountdown(!!recordingSlot);
  const isCurrentSlot = !!slot && slot.id === currentSetlogSlotId();

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    // Swipe left (negative delta) -> next day; swipe right -> previous day.
    setDate((d) => shiftDate(d, deltaX < 0 ? 1 : -1));
  };

  if (!activePersonId || !activePerson) return null;

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="mb-3 flex items-center justify-between">
        <input
          type="date"
          value={date}
          max={todaySetlogDate()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-pill border-2 border-ink bg-card px-2.5 py-1 text-xs font-medium text-ink"
        />
        <p className="font-heading text-sm font-semibold text-ink">setlog</p>
        <button
          onClick={() => setShowChatroom(true)}
          disabled={!slot}
          className="cursor-pointer rounded-pill border-2 border-ink bg-card px-2.5 py-1 text-xs font-medium text-ink disabled:opacity-30"
        >
          💬 chat
        </button>
      </div>

      {slots.length === 0 ? (
        <div className="flex flex-col items-center px-2.5 pt-10 text-center">
          <div className="mb-4.5">
            <Mascot size={84} color="teal" mouth />
          </div>
          <p className="mb-1.5 font-heading text-xl font-semibold text-ink">
            nothing here yet
          </p>
          <p className="max-w-[240px] text-sm leading-relaxed text-ink/55">
            {date === todaySetlogDate()
              ? "hourly prompts start at 6am — check back once the first one fires."
              : "no setlog activity on this day."}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-center gap-3">
            <button
              onClick={() => setSlotIndex((i) => Math.max(0, i - 1))}
              disabled={slotIndex === 0}
              className="cursor-pointer text-lg text-ink/50 disabled:opacity-20"
              aria-label="previous slot"
            >
              ‹
            </button>
            <p className="font-heading text-base font-semibold text-ink">
              {slot ? formatHourLabel(slot.hour) : ""}
              {isCurrentSlot && <span className="ml-1.5 text-xs text-orange">· live</span>}
            </p>
            <button
              onClick={() => setSlotIndex((i) => Math.min(slots.length - 1, i + 1))}
              disabled={slotIndex >= slots.length - 1}
              className="cursor-pointer text-lg text-ink/50 disabled:opacity-20"
              aria-label="next slot"
            >
              ›
            </button>
          </div>

          <div className="space-y-3 pb-4">
            {people.map((person) => {
              const clip = visibleClips.find((c) => c.personId === person.id) ?? null;
              const isSelf = person.id === activePersonId;
              return (
                <SetlogClipBox
                  key={person.id}
                  person={person}
                  clip={clip}
                  isSelf={isSelf}
                  canRecord={isSelf && isCurrentSlot && !clip}
                  missed={!clip && !isCurrentSlot}
                  isEditable={!!clip && isClipEditable(clip)}
                  slotHour={slot?.hour ?? 0}
                  onRecord={() => setRecordingSlot(slot)}
                  onOpenComments={setCommentsFor}
                  onEditCaption={setEditingClip}
                />
              );
            })}
          </div>
        </>
      )}

      {recordingSlot && (
        <CaptureFlow
          personId={activePersonId}
          personName={activePerson.name}
          slotId={recordingSlot.id}
          slotHour={recordingSlot.hour}
          remainingLabel={countdown.label}
          isWindowOpen={countdown.isOpen}
          onDone={() => setRecordingSlot(null)}
        />
      )}

      {commentsFor && (
        <SetlogCommentSheet
          clip={commentsFor}
          people={people}
          activePersonId={activePersonId}
          onClose={() => setCommentsFor(null)}
        />
      )}

      {editingClip && (
        <SetlogEditCaptionModal clip={editingClip} onClose={() => setEditingClip(null)} />
      )}

      {showChatroom && slot && (
        <SetlogSlotChatroom
          slotId={slot.id}
          slotHour={slot.hour}
          people={people}
          activePersonId={activePersonId}
          onClose={() => setShowChatroom(false)}
        />
      )}
    </div>
  );
}
