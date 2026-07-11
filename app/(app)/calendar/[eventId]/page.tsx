"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePeople } from "@/contexts/PersonContext";
import {
  deleteEvent,
  listenAvailabilities,
  listenEvent,
  planStatus,
  setAvailability,
} from "@/lib/calendar";
import { buildMonthGrid, formatDateBadge, monthLabel } from "@/lib/dateUtils";
import type { Availability, CalendarEvent } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { FinalizePlanModal } from "@/components/calendar/FinalizePlanModal";

export default function OpenPlanDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const { people, activePersonId } = usePeople();
  const [event, setEvent] = useState<CalendarEvent | null | undefined>(
    undefined,
  );
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [showFinalize, setShowFinalize] = useState(false);

  useEffect(() => listenEvent(eventId, setEvent), [eventId]);
  useEffect(() => listenAvailabilities(eventId, setAvailabilities), [eventId]);

  useEffect(() => {
    if (event && planStatus(event) === "confirmed") {
      router.replace("/calendar");
    }
  }, [event, router]);

  const nameOf = useMemo(() => {
    const map = new Map(people.map((p) => [p.id, p]));
    return (id: string) => map.get(id);
  }, [people]);

  const overlapByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    availabilities.forEach((a) => {
      a.dates.forEach((iso) => {
        const list = map.get(iso) ?? [];
        list.push(a.personId);
        map.set(iso, list);
      });
    });
    return map;
  }, [availabilities]);

  const sortedOverlap = useMemo(
    () =>
      [...overlapByDate.entries()]
        .map(([iso, personIds]) => ({ iso, personIds }))
        .sort(
          (a, b) =>
            b.personIds.length - a.personIds.length || a.iso.localeCompare(b.iso),
        ),
    [overlapByDate],
  );

  const myAvailability = useMemo(
    () => availabilities.find((a) => a.personId === activePersonId)?.dates ?? [],
    [availabilities, activePersonId],
  );

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month),
    [cursor],
  );

  const toggleDay = (iso: string) => {
    if (!activePersonId) return;
    const next = myAvailability.includes(iso)
      ? myAvailability.filter((d) => d !== iso)
      : [...myAvailability, iso].sort();
    setAvailability(eventId, activePersonId, next);
  };

  const cancelPlan = async () => {
    await deleteEvent(eventId);
    router.push("/calendar");
  };

  if (event === undefined) {
    return <p className="pt-10 text-center text-ink/40">loading plan...</p>;
  }

  if (event === null || planStatus(event) === "confirmed") {
    return (
      <div>
        <button
          onClick={() => router.push("/calendar")}
          className="mb-2.5 cursor-pointer font-body text-sm font-medium text-orange"
        >
          ‹ back to calendar
        </button>
        <p className="pt-10 text-center text-ink/40">
          {event === null
            ? "this plan doesn't exist anymore."
            : "this plan has been confirmed..."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.push("/calendar")}
        className="mb-2.5 cursor-pointer font-body text-sm font-medium text-orange"
      >
        ‹ back to calendar
      </button>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold text-ink">
          {event.title}
        </h2>
        <button
          onClick={cancelPlan}
          className="cursor-pointer text-xs font-medium text-ink/40 hover:text-orange"
        >
          cancel plan
        </button>
      </div>
      <p className="mb-4 text-sm text-ink/55">
        open plan · tap the days you&apos;re free
      </p>

      <div className="mb-2.5 flex items-center justify-between">
        <button
          onClick={() =>
            setCursor((c) =>
              c.month === 0
                ? { year: c.year - 1, month: 11 }
                : { year: c.year, month: c.month - 1 },
            )
          }
          className="cursor-pointer px-2 font-heading text-lg text-ink/50"
        >
          ‹
        </button>
        <p className="font-heading text-lg font-semibold text-ink">
          {monthLabel(cursor.year, cursor.month)}
        </p>
        <button
          onClick={() =>
            setCursor((c) =>
              c.month === 11
                ? { year: c.year + 1, month: 0 }
                : { year: c.year, month: c.month + 1 },
            )
          }
          className="cursor-pointer px-2 font-heading text-lg text-ink/50"
        >
          ›
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center text-xs font-medium text-ink/40">
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (cell.iso === null) return <div key={i} className="aspect-square" />;
          const personIds = overlapByDate.get(cell.iso) ?? [];
          const count = personIds.length;
          const mine = myAvailability.includes(cell.iso);
          const intensity = people.length > 0 ? count / people.length : 0;
          return (
            <button
              key={i}
              onClick={() => toggleDay(cell.iso as string)}
              style={
                count > 0
                  ? { backgroundColor: `rgba(234, 90, 50, ${0.12 + 0.55 * intensity})` }
                  : undefined
              }
              className={`relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-2 text-[13px] transition-colors ${
                mine ? "border-orange font-semibold text-ink" : "border-transparent text-ink"
              } ${count === 0 ? "bg-ink/[0.06]" : ""}`}
            >
              <span>{cell.day}</span>
              {count > 0 && (
                <span className="text-[9px] font-semibold text-ink/60">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mb-4 text-[12px] text-ink/40">
        the orange outline is your own picks · darker fill means more people are free
      </p>

      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/55">
        overlap
      </p>
      {sortedOverlap.length === 0 ? (
        <p className="p-3.5 text-center text-sm text-ink/45">
          nobody&apos;s marked their availability yet
        </p>
      ) : (
        sortedOverlap.map(({ iso, personIds }) => (
          <Card
            key={iso}
            className="mb-2 flex items-center justify-between px-3.5 py-2.5"
          >
            <div>
              <p className="font-heading text-sm font-semibold text-ink">
                {formatDateBadge(iso)}
              </p>
              <p className="text-[12px] text-ink/50">
                {personIds.length} {personIds.length === 1 ? "person" : "people"} free
              </p>
            </div>
            <div className="flex">
              {personIds.map((id) => {
                const person = nameOf(id);
                return person ? (
                  <Avatar
                    key={id}
                    src={person.photoUrl}
                    name={person.name}
                    size="sm"
                    overlap
                  />
                ) : null;
              })}
            </div>
          </Card>
        ))
      )}

      <div className="sticky bottom-0 -mx-5 mt-4 flex items-center justify-between border-t-2 border-ink bg-paper px-5 py-3.5">
        <p className="text-sm text-ink/55">
          {sortedOverlap.length > 0
            ? `best day: ${formatDateBadge(sortedOverlap[0].iso)}`
            : "mark some days first"}
        </p>
        <Button onClick={() => setShowFinalize(true)}>finalize</Button>
      </div>

      {showFinalize && (
        <FinalizePlanModal
          eventId={eventId}
          candidates={sortedOverlap}
          defaultDate={sortedOverlap[0]?.iso ?? ""}
          onClose={() => setShowFinalize(false)}
          onFinalized={() => router.push("/calendar")}
        />
      )}
    </div>
  );
}
