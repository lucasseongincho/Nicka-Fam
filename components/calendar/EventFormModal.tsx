"use client";

import { useState } from "react";
import { usePeople } from "@/contexts/PersonContext";
import { createEvent, deleteEvent, updateEvent } from "@/lib/calendar";
import { todayISO } from "@/lib/dateUtils";
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
  const { activePersonId } = usePeople();
  const [title, setTitle] = useState(editingEvent?.title ?? "");
  const [date, setDate] = useState(editingEvent?.date ?? todayISO());
  const [time, setTime] = useState(editingEvent?.time ?? "");
  const [submitting, setSubmitting] = useState(false);

  const valid = title.trim() && date;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    if (editingEvent) {
      await updateEvent(editingEvent.id, {
        title: title.trim(),
        date,
        time: time.trim(),
      });
    } else if (activePersonId) {
      await createEvent({
        title: title.trim(),
        date,
        time: time.trim(),
        createdBy: activePersonId,
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
      <div className="mb-5 flex gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 rounded-card-sm border-2 border-ink bg-paper px-3 py-2.5 font-body text-ink outline-none"
        />
        <input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="10am"
          className="w-24 rounded-card-sm border-2 border-ink bg-paper px-3 py-2.5 font-body text-ink outline-none placeholder:text-ink/35"
        />
      </div>
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
