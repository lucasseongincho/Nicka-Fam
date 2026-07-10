"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listenBill, listenRounds, setBillParticipants, toggleNoDrink } from "@/lib/bills";
import { usePeople } from "@/contexts/PersonContext";
import type { Bill, Round } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { AddRoundModal } from "@/components/bills/AddRoundModal";

export default function BillDetailPage({
  params,
}: {
  params: Promise<{ billId: string }>;
}) {
  const { billId } = use(params);
  const router = useRouter();
  const { people } = usePeople();
  const [bill, setBill] = useState<Bill | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [showAddRound, setShowAddRound] = useState(false);

  useEffect(() => listenBill(billId, setBill), [billId]);
  useEffect(() => listenRounds(billId, setRounds), [billId]);

  const nameOf = useMemo(() => {
    const map = new Map(people.map((p) => [p.id, p.name]));
    return (id: string) => map.get(id) ?? id;
  }, [people]);

  const billMembers = useMemo(
    () =>
      bill ? people.filter((p) => bill.participantIds.includes(p.id)) : [],
    [people, bill],
  );

  if (!bill) {
    return <p className="pt-10 text-center text-ink/40">loading bill...</p>;
  }

  const toggleParticipant = (personId: string) => {
    const next = bill.participantIds.includes(personId)
      ? bill.participantIds.filter((id) => id !== personId)
      : [...bill.participantIds, personId];
    setBillParticipants(billId, next);
  };

  return (
    <div>
      <button
        onClick={() => router.push("/split")}
        className="mb-2.5 cursor-pointer font-body text-sm font-medium text-orange"
      >
        ‹ back to bills
      </button>
      <h2 className="mb-2.5 font-heading text-xl font-semibold text-ink">
        {bill.title}
      </h2>

      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/55">
        who&apos;s in
      </p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {people.map((person) => (
          <Chip
            key={person.id}
            active={bill.participantIds.includes(person.id)}
            onClick={() => toggleParticipant(person.id)}
          >
            {person.name}
          </Chip>
        ))}
      </div>

      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/55">
        rounds
      </p>
      {rounds.map((round) => (
        <Card key={round.id} className="mb-2.5 p-3">
          <div className="flex justify-between font-heading text-base font-semibold text-ink">
            <span>{round.label}</span>
            <span>${round.amount}</span>
          </div>
          <p className="my-1 text-[13px] text-ink/55">
            paid by {nameOf(round.payerId)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {round.participantIds.map((personId) => {
              const off = round.noDrinkIds.includes(personId);
              return (
                <button
                  key={personId}
                  onClick={() =>
                    toggleNoDrink(billId, round.id, personId, off)
                  }
                  className={`cursor-pointer rounded-pill border-2 px-2.5 py-1 font-body text-[13px] transition-colors ${
                    off
                      ? "border-ink/30 bg-card text-ink/40 line-through"
                      : "border-ink bg-cream text-ink"
                  }`}
                >
                  {nameOf(personId)}
                  {off ? " 🚫" : ""}
                </button>
              );
            })}
          </div>
        </Card>
      ))}

      <Card
        dashed
        className="mb-4 cursor-pointer p-2.5 text-center text-sm"
        onClick={() => setShowAddRound(true)}
      >
        + add another round
      </Card>

      <div className="sticky bottom-0 -mx-5 flex items-center justify-between border-t-2 border-ink bg-paper px-5 py-3.5">
        <p className="font-heading text-lg font-semibold text-ink">
          total ${bill.totalAmount}
        </p>
        <Button onClick={() => router.push(`/split/${billId}/settle`)}>
          settle up ⚖️
        </Button>
      </div>

      {showAddRound && (
        <AddRoundModal
          billId={billId}
          billMembers={billMembers}
          nextOrder={rounds.length}
          onClose={() => setShowAddRound(false)}
        />
      )}
    </div>
  );
}
