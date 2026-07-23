"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { Person } from "@/lib/types";

/**
 * One text field per current player -- decoupled from who ends up where
 * (outcomes land on fixed bottom positions, not tied to any specific
 * starting player), so fields are just labeled "outcome 1", "outcome 2",
 * etc. Typed values are kept by index rather than in a players.length-sized
 * array, so the field *count* simply derives from the live player list on
 * every render (no effect needed to "resize" anything) while still
 * preserving whatever's already typed if someone joins/leaves the lobby
 * while this is open.
 */
export function LadderOutcomeModal({
  players,
  onClose,
  onSubmit,
}: {
  players: Person[];
  onClose: () => void;
  onSubmit: (outcomes: string[]) => void;
}) {
  const [outcomesByIndex, setOutcomesByIndex] = useState<Record<number, string>>({});
  const outcomes = players.map((_, i) => outcomesByIndex[i] ?? "");

  const setOutcomeAt = (i: number, value: string) => {
    setOutcomesByIndex((cur) => ({ ...cur, [i]: value }));
  };

  const valid = outcomes.length > 0 && outcomes.every((o) => o.trim().length > 0);

  return (
    <Modal onClose={onClose}>
      <p className="mb-1.5 text-center font-heading text-lg font-semibold text-ink">
        set the outcomes
      </p>
      <p className="mb-4 text-center text-[13px] text-ink/50">
        one result per person -- who gets which stays a surprise until they reveal
      </p>
      <div className="mb-5 flex flex-col gap-2.5">
        {outcomes.map((value, i) => (
          <input
            key={i}
            value={value}
            onChange={(e) => setOutcomeAt(i, e.target.value)}
            placeholder={`outcome ${i + 1} (e.g. "buys coffee")`}
            className="w-full rounded-card-sm border-2 border-ink bg-paper px-3 py-2.5 font-body text-ink outline-none placeholder:text-ink/35"
          />
        ))}
      </div>
      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!valid}
          onClick={() => onSubmit(outcomes.map((o) => o.trim()))}
        >
          start ladder 🪜
        </Button>
      </div>
    </Modal>
  );
}
