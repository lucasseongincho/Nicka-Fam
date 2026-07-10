"use client";

import { useState } from "react";
import type { Person, Round } from "@/lib/types";
import { usePeople } from "@/contexts/PersonContext";
import { addRound, deleteRound, updateRound } from "@/lib/bills";
import { Modal } from "@/components/ui/Modal";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";

export function AddRoundModal({
  billId,
  billMembers,
  nextOrder,
  editingRound,
  onClose,
}: {
  billId: string;
  billMembers: Person[];
  nextOrder: number;
  editingRound?: Round;
  onClose: () => void;
}) {
  const { activePersonId } = usePeople();
  const [label, setLabel] = useState(editingRound?.label ?? "");
  const [amount, setAmount] = useState(
    editingRound ? String(editingRound.amount) : "",
  );
  const [payerId, setPayerId] = useState(
    editingRound?.payerId ?? billMembers[0]?.id ?? "",
  );
  const [participantIds, setParticipantIds] = useState<string[]>(
    editingRound?.participantIds ?? billMembers.map((p) => p.id),
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
    if (editingRound) {
      await updateRound(billId, editingRound.id, editingRound.amount, {
        label: label.trim(),
        amount: amountNum,
        payerId,
        participantIds,
      });
    } else {
      await addRound(billId, {
        label: label.trim(),
        amount: amountNum,
        payerId,
        participantIds,
        order: nextOrder,
        createdBy: activePersonId,
      });
    }
    onClose();
  };

  const remove = async () => {
    if (!editingRound) return;
    setSubmitting(true);
    await deleteRound(billId, editingRound.id, editingRound.amount);
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <p className="mb-4 text-center font-heading text-lg font-semibold text-ink">
        {editingRound ? "edit round" : "add a round"}
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
        {editingRound && (
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
        <Button
          className="flex-1"
          disabled={!valid || submitting}
          onClick={submit}
        >
          {editingRound ? "save" : "add"}
        </Button>
      </div>
    </Modal>
  );
}
