"use client";

import { useState } from "react";
import { usePeople } from "@/contexts/PersonContext";
import { createBill } from "@/lib/bills";
import { Modal } from "@/components/ui/Modal";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";

export function CreateBillModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (billId: string) => void;
}) {
  const { people, activePersonId } = usePeople();
  const [title, setTitle] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>(
    people.map((p) => p.id),
  );
  const [submitting, setSubmitting] = useState(false);

  const toggle = (id: string) => {
    setParticipantIds((cur) =>
      cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id],
    );
  };

  const submit = async () => {
    if (!activePersonId || !title.trim() || participantIds.length === 0) return;
    setSubmitting(true);
    const id = await createBill(title.trim(), participantIds, activePersonId);
    onCreated(id);
  };

  return (
    <Modal onClose={onClose}>
      <p className="mb-4 text-center font-heading text-lg font-semibold text-ink">
        start a new bill
      </p>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tuesday Tacos 🌮"
        className="mb-4 w-full rounded-card-sm border-2 border-ink bg-paper px-3 py-2.5 font-body text-ink outline-none placeholder:text-ink/35"
      />
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/55">
        who&apos;s in
      </p>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {people.map((person) => (
          <Chip
            key={person.id}
            active={participantIds.includes(person.id)}
            onClick={() => toggle(person.id)}
          >
            {person.name}
          </Chip>
        ))}
      </div>
      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!title.trim() || participantIds.length === 0 || submitting}
          onClick={submit}
        >
          create
        </Button>
      </div>
    </Modal>
  );
}
