"use client";

import { useState } from "react";
import { finalizePlan } from "@/lib/calendar";
import { formatDateBadge } from "@/lib/dateUtils";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";

export function FinalizePlanModal({
  eventId,
  candidates,
  defaultDate,
  onClose,
  onFinalized,
}: {
  eventId: string;
  candidates: { iso: string; personIds: string[] }[];
  defaultDate: string;
  onClose: () => void;
  onFinalized: () => void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const valid = date.length > 0;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    await finalizePlan(eventId, date, time.trim());
    onFinalized();
  };

  return (
    <Modal onClose={onClose}>
      <p className="mb-4 text-center font-heading text-lg font-semibold text-ink">
        finalize plan
      </p>

      {candidates.length > 0 && (
        <>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/55">
            marked days
          </p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {candidates.map((c) => (
              <Chip
                key={c.iso}
                active={date === c.iso}
                onClick={() => setDate(c.iso)}
              >
                {formatDateBadge(c.iso)} · {c.personIds.length}
              </Chip>
            ))}
          </div>
        </>
      )}

      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/55">
        or pick any date
      </p>
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
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!valid || submitting}
          onClick={submit}
        >
          confirm
        </Button>
      </div>
    </Modal>
  );
}
