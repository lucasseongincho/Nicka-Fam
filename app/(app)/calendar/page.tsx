"use client";

import { useEffect, useMemo, useState } from "react";
import { usePeople } from "@/contexts/PersonContext";
import { listenEvents, toggleRSVP } from "@/lib/calendar";
import { buildMonthGrid, formatDateBadge, monthLabel } from "@/lib/dateUtils";
import type { CalendarEvent } from "@/lib/types";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { EventFormModal } from "@/components/calendar/EventFormModal";

export default function CalendarPage() {
  const { people, activePersonId } = usePeople();
  const [view, setView] = useState<"month" | "agenda">("agenda");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => listenEvents(setEvents), []);

  const nameOf = useMemo(() => {
    const map = new Map(people.map((p) => [p.id, p]));
    return (id: string) => map.get(id);
  }, [people]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((ev) => {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    });
    return map;
  }, [events]);

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month),
    [cursor],
  );

  const selectedDayEvents = selectedIso
    ? (eventsByDate.get(selectedIso) ?? [])
    : [];

  const agendaEvents = useMemo(
    () =>
      [...events].sort((a, b) =>
        (a.date + a.time).localeCompare(b.date + b.time),
      ),
    [events],
  );

  const openEdit = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setShowForm(true);
  };

  return (
    <div>
      <div className="mb-4">
        <SegmentedToggle
          value={view}
          onChange={setView}
          options={[
            { value: "month", label: "month" },
            { value: "agenda", label: "agenda" },
          ]}
        />
      </div>

      {view === "month" && (
        <div>
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

          <div className="mb-3.5 grid grid-cols-7 gap-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div
                key={i}
                className="text-center text-xs font-medium text-ink/40"
              >
                {d}
              </div>
            ))}
            {cells.map((cell, i) => {
              if (cell.iso === null)
                return <div key={i} className="aspect-square" />;
              const hasEvent = eventsByDate.has(cell.iso);
              const selected = cell.iso === selectedIso;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedIso(cell.iso)}
                  className={`relative flex aspect-square cursor-pointer items-center justify-center rounded-lg text-[13px] ${
                    selected
                      ? "border-2 border-ink bg-orange font-semibold text-card"
                      : "bg-ink/[0.06] text-ink"
                  }`}
                >
                  {cell.day}
                  {hasEvent && (
                    <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-orange" />
                  )}
                </button>
              );
            })}
          </div>

          {selectedIso === null ? (
            <p className="p-3.5 text-center text-sm text-ink/45">
              tap a day to see what&apos;s on
            </p>
          ) : selectedDayEvents.length === 0 ? (
            <p className="p-3.5 text-center text-sm text-ink/45">
              nothing planned this day yet
            </p>
          ) : (
            selectedDayEvents.map((ev) => (
              <Card
                key={ev.id}
                className="mb-2 flex cursor-pointer items-center justify-between px-3.5 py-3"
                onClick={() => openEdit(ev)}
              >
                <div>
                  <p className="font-heading text-base font-semibold text-ink">
                    {ev.title}
                  </p>
                  <p className="text-[13px] text-ink/50">{ev.time}</p>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {view === "agenda" && (
        <div>
          {agendaEvents.map((ev) => {
            const attending = !!activePersonId && ev.attendeeIds.includes(activePersonId);
            const avatars = ev.attendeeIds.slice(0, 3);
            const extra = ev.attendeeIds.length - avatars.length;
            return (
              <Card key={ev.id} className="mb-2.5 p-3">
                <p className="mb-0.5 font-heading text-xs font-semibold tracking-wide text-orange">
                  {formatDateBadge(ev.date)}
                </p>
                <div className="flex items-center justify-between">
                  <p
                    onClick={() => openEdit(ev)}
                    className="cursor-pointer font-heading text-[17px] font-semibold text-ink"
                  >
                    {ev.title}
                  </p>
                  <button
                    onClick={() =>
                      activePersonId &&
                      toggleRSVP(ev.id, activePersonId, attending)
                    }
                    className={`cursor-pointer rounded-pill border-2 px-3 py-1 font-body text-[13px] transition-colors ${
                      attending
                        ? "border-ink bg-orange font-semibold text-card"
                        : "border-ink/30 bg-card font-medium text-ink/50"
                    }`}
                  >
                    {attending ? "in ✓" : "rsvp?"}
                  </button>
                </div>
                <p className="my-0.5 mb-2 text-[13px] text-ink/50">
                  {ev.time}
                </p>
                <div className="flex">
                  {avatars.map((id) => {
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
                  {extra > 0 && (
                    <span className="-ml-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper bg-ink/10 text-[11px] font-medium text-ink/60">
                      +{extra}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}

          <Card
            dashed
            className="cursor-pointer p-2.5 text-center text-sm"
            onClick={() => {
              setEditingEvent(null);
              setShowForm(true);
            }}
          >
            + plan something
          </Card>
        </div>
      )}

      {showForm && (
        <EventFormModal
          editingEvent={editingEvent ?? undefined}
          onClose={() => {
            setShowForm(false);
            setEditingEvent(null);
          }}
        />
      )}
    </div>
  );
}
