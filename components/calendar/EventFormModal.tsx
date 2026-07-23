"use client";

import { useState } from "react";
import { usePeople } from "@/contexts/PersonContext";
import { createEvent, deleteEvent, updateEvent } from "@/lib/calendar";
import { notifyCategory } from "@/lib/notifyClient";
import type { CalendarEvent } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function EventFormModal({
  editingEvent,
  onClose,
}: {
  editingEvent?: CalendarEvent;
  onClose: () => void;
}) {
  const { activePerson, activePersonId } = usePeople();
  const [title, setTitle] = useState(editingEvent?.title ?? "");
  const [date, setDate] = useState(editingEvent?.date ?? "");
  const [time, setTime] = useState(editingEvent?.time ?? "");
  const [submitting, setSubmitting] = useState(false);

  const valid = title.trim().length > 0;

  const handleDateChange = (value: string) => {
    setDate(value);
    if (!value) setTime("");
  };

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    if (editingEvent) {
      await updateEvent(editingEvent.id, {
        title: title.trim(),
        date: date || undefined,
        time: time.trim() || undefined,
      });
    } else if (activePersonId) {
      const trimmedTitle = title.trim();
      await createEvent({
        title: trimmedTitle,
        date: date || undefined,
        time: time.trim() || undefined,
        createdBy: activePersonId,
      });
      const name = activePerson?.name ?? "someone";
      void notifyCategory({
        category: "calendar",
        actorId: activePersonId,
        title: "calendar",
        body: date
          ? `${name} added a plan: ${trimmedTitle}`
          : `${name} shared an idea: ${trimmedTitle}`,
        url: "/calendar",
      });
    }
    onClose();
  };

  const remove = async () => {
    if (!editingEvent) return;
    setSubmitting(true);
    await deleteEvent(editingEvent.id);
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <p className="mb-4 text-center font-heading text-lg font-semibold text-ink">
        {editingEvent ? "edit plan" : "plan something"}
      </p>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Beach day 🏖️"
        className="mb-3 w-full rounded-card-sm border-2 border-ink bg-paper px-3 py-2.5 font-body text-ink outline-none placeholder:text-ink/35"
      />
      <div className="mb-2 flex gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="flex-1 rounded-card-sm border-2 border-ink bg-paper px-3 py-2.5 font-body text-ink outline-none"
        />
        <input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="10am"
          disabled={!date}
          className="w-24 rounded-card-sm border-2 border-ink bg-paper px-3 py-2.5 font-body text-ink outline-none placeholder:text-ink/35 disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>
      {!date && (
        <p className="mb-3 text-[13px] text-ink/45">
          no date yet? leave it blank to make this an open plan, then find a day together later.
        </p>
      )}
      <div className={date ? "mb-5" : "mb-2"} />
      <div className="flex gap-3">
        {editingEvent && (
          <Button
            variant="ghost"
            className="flex-1 text-orange-dark"
            disabled={submitting}
            onClick={remove}
          >
            delete
          </Button>
        )}
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          cancel
        </Button>
        <Button className="flex-1" disabled={!valid || submitting} onClick={submit}>
          {editingEvent ? "save" : "add"}
        </Button>
      </div>
    </Modal>
  );
}
