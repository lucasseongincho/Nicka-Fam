"use client";

import { useState } from "react";
import type { Person } from "@/lib/types";
import { usePeople } from "@/contexts/PersonContext";
import { addRound } from "@/lib/bills";
import { Modal } from "@/components/ui/Modal";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";

export function AddRoundModal({
  billId,
  billMembers,
  nextOrder,
  onClose,
}: {
  billId: string;
  billMembers: Person[];
  nextOrder: number;
  onClose: () => void;
}) {
  const { activePersonId } = usePeople();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState(billMembers[0]?.id ?? "");
  const [participantIds, setParticipantIds] = useState<string[]>(
    billMembers.map((p) => p.id),
  );
  const [submitting, setSubmitting] = useState(false);

  const toggle = (id: string) => {
    setParticipantIds((cur) =>
      cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id],
    );
  };

  const amountNum = Number(amount);
  const valid =
    label.trim() &&
    amountNum > 0 &&
    payerId &&
    participantIds.length > 0 &&
    activePersonId;

  const submit = async () => {
    if (!valid || !activePersonId) return;
    setSubmitting(true);
    await addRound(billId, {
      label: label.trim(),
      amount: amountNum,
      payerId,
      participantIds,
      order: nextOrder,
      createdBy: activePersonId,
    });
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <p className="mb-4 text-center font-heading text-lg font-semibold text-ink">
        add a round
      </p>
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Chips & drinks"
        className="mb-3 w-full rounded-card-sm border-2 border-ink bg-paper px-3 py-2.5 font-body text-ink outline-none placeholder:text-ink/35"
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="amount ($)"
        inputMode="decimal"
        className="mb-4 w-full rounded-card-sm border-2 border-ink bg-paper px-3 py-2.5 font-body text-ink outline-none placeholder:text-ink/35"
      />

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/55">
        paid by
      </p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {billMembers.map((person) => (
          <Chip
            key={person.id}
            active={payerId === person.id}
            onClick={() => setPayerId(person.id)}
          >
            {person.name}
          </Chip>
        ))}
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/55">
        split among
      </p>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {billMembers.map((person) => (
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
          disabled={!valid || submitting}
          onClick={submit}
        >
          add
        </Button>
      </div>
    </Modal>
  );
}
