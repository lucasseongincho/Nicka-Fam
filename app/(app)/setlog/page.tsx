"use client";

import { useEffect, useState } from "react";
import { usePeople } from "@/contexts/PersonContext";
import { listenSetlogDays } from "@/lib/setlog";
import { SETLOG_TIMEZONE } from "@/lib/setlogTime";
import { formatDateBadge } from "@/lib/dateUtils";
import type { SetlogDay } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Mascot } from "@/components/ui/Mascot";

function formatSlotTime(scheduledAt: SetlogDay["slots"][number]["scheduledAt"]): string {
  return scheduledAt.toDate().toLocaleTimeString("en-US", {
    timeZone: SETLOG_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  });
}

function DayCard({ day }: { day: SetlogDay }) {
  const { people } = usePeople();
  const nameOf = (id: string) => people.find((p) => p.id === id);

  return (
    <Card className="mb-4 overflow-hidden p-0">
      <div className="border-b-2 border-ink px-4 py-2.5">
        <p className="font-heading text-sm font-semibold text-ink">{formatDateBadge(day.date)}</p>
      </div>

      {day.status === "ready" && day.mergedVideoUrl ? (
        <video
          src={day.mergedVideoUrl}
          controls
          playsInline
          preload="metadata"
          className="aspect-[9/16] w-full bg-ink object-cover"
        />
      ) : (
        <div className="flex aspect-[9/16] w-full items-center justify-center bg-cream">
          <p className="px-6 text-center text-sm text-ink/45">
            nobody captured a moment this day
          </p>
        </div>
      )}

      <div className="space-y-2 px-4 py-3">
        {day.slots.map((slot) => (
          <div key={slot.id} className="flex items-center justify-between gap-2">
            <span className="text-xs text-ink/45">{formatSlotTime(slot.scheduledAt)}</span>
            <div className="flex flex-1 flex-wrap items-center justify-end gap-1">
              {slot.participantIds.map((id) => {
                const person = nameOf(id);
                if (!person) return null;
                return <Avatar key={id} src={person.photoUrl} name={person.name} size="sm" overlap />;
              })}
              {slot.missedIds.length > 0 && (
                <span className="ml-1 text-[11px] text-ink/35">
                  missed: {slot.missedIds.map((id) => nameOf(id)?.name ?? "someone").join(", ")}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function SetlogPage() {
  const [days, setDays] = useState<SetlogDay[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(
    () =>
      listenSetlogDays((d) => {
        setDays(d);
        setLoaded(true);
      }),
    [],
  );

  const visibleDays = days.filter((d) => d.status === "ready" || d.status === "no_clips");

  if (loaded && visibleDays.length === 0) {
    return (
      <div className="flex flex-col items-center px-2.5 pt-10 text-center">
        <div className="mb-4.5">
          <Mascot size={84} color="teal" mouth />
        </div>
        <p className="mb-1.5 font-heading text-xl font-semibold text-ink">no setlog days yet</p>
        <p className="max-w-[240px] text-sm leading-relaxed text-ink/55">
          random prompts go out through the day — capture your 4 seconds when they hit, and the
          first merged day will show up here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {visibleDays.map((day) => (
        <DayCard key={day.date} day={day} />
      ))}
    </div>
  );
}
