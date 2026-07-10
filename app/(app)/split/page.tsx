"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listenBills } from "@/lib/bills";
import type { Bill } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { CreateBillModal } from "@/components/bills/CreateBillModal";
import { EditBillModal } from "@/components/bills/EditBillModal";

export default function SplitListPage() {
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  useEffect(() => listenBills(setBills), []);

  return (
    <div>
      {bills.map((bill) => (
        <Card
          key={bill.id}
          className="mb-3 cursor-pointer p-4"
          onClick={() => router.push(`/split/${bill.id}`)}
        >
          <div className="flex items-start justify-between">
            <p className="font-heading text-[19px] font-semibold text-ink">
              {bill.title}
            </p>
            <div className="flex items-center gap-2">
              <p className="font-heading text-[17px] font-semibold text-ink">
                ${bill.totalAmount}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingBill(bill);
                }}
                className="cursor-pointer text-xs font-medium text-ink/40 hover:text-orange"
              >
                edit
              </button>
            </div>
          </div>
          <p className="mt-1 text-[13px] text-ink/50">
            {bill.participantIds.length} people · {bill.roundCount}{" "}
            {bill.roundCount === 1 ? "round" : "rounds"} · tap to open
          </p>
        </Card>
      ))}

      <Card
        dashed
        className="cursor-pointer p-4 text-center text-[15px]"
        onClick={() => setShowCreate(true)}
      >
        + start a new bill
      </Card>

      {showCreate && (
        <CreateBillModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            router.push(`/split/${id}`);
          }}
        />
      )}

      {editingBill && (
        <EditBillModal
          bill={editingBill}
          onClose={() => setEditingBill(null)}
        />
      )}
    </div>
  );
}
