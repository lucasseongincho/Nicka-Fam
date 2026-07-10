"use client";

import { useState } from "react";
import type { Bill } from "@/lib/types";
import { deleteBill, updateBillTitle } from "@/lib/bills";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function EditBillModal({
  bill,
  onClose,
  onDeleted,
}: {
  bill: Bill;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const [title, setTitle] = useState(bill.title);
  const [submitting, setSubmitting] = useState(false);

  const valid = title.trim().length > 0;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    await updateBillTitle(bill.id, title.trim());
    onClose();
  };

  const remove = async () => {
    setSubmitting(true);
    await deleteBill(bill.id);
    onClose();
    onDeleted?.();
  };

  return (
    <Modal onClose={onClose}>
      <p className="mb-4 text-center font-heading text-lg font-semibold text-ink">
        edit bill
      </p>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tuesday Tacos 🌮"
        className="mb-5 w-full rounded-card-sm border-2 border-ink bg-paper px-3 py-2.5 font-body text-ink outline-none placeholder:text-ink/35"
      />
      <div className="flex gap-3">
        <Button
          variant="ghost"
          className="flex-1 text-orange-dark"
          disabled={submitting}
          onClick={remove}
        >
          delete
        </Button>
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          cancel
        </Button>
        <Button className="flex-1" disabled={!valid || submitting} onClick={submit}>
          save
        </Button>
      </div>
    </Modal>
  );
}
