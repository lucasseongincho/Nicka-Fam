"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { revealLadderResult, traceLadderPath } from "@/lib/ladder";
import type { GameRoom, LadderState, Person } from "@/lib/types";
import { LadderBoard } from "./LadderBoard";

function outcomeFor(state: LadderState, personId: string): string | null {
  const col = state.playerColumns[personId];
  if (col === undefined) return null;
  const { finalColumn } = traceLadderPath(col, state.ladderStructure, state.rowCount);
  return state.outcomes[finalColumn] ?? null;
}

export function LadderRoom({
  room,
  people,
  activePersonId,
}: {
  room: GameRoom<LadderState>;
  people: Person[];
  activePersonId: string;
}) {
  const [justRevealedByMe, setJustRevealedByMe] = useState(false);
  const state = room.state;
  const iRevealed = !!state.revealed[activePersonId];
  const myOutcome = outcomeFor(state, activePersonId);

  const myReveal = async () => {
    if (iRevealed) return;
    setJustRevealedByMe(true);
    await revealLadderResult(room.id, activePersonId, room.players, state.revealed);
  };

  return (
    <div className="flex flex-col items-center gap-4 pt-2 text-center">
      <p className="font-heading text-lg font-semibold text-ink">사다리게임</p>

      {!iRevealed ? (
        <Button onClick={myReveal}>reveal my result 🪜</Button>
      ) : (
        <div className="rounded-chip bg-orange/15 px-4 py-2 text-center">
          <p className="text-[11px] uppercase tracking-wide text-ink/50">your result</p>
          <p className="font-heading text-lg font-bold text-orange-dark">{myOutcome}</p>
        </div>
      )}

      <LadderBoard
        state={state}
        people={people}
        activePersonId={activePersonId}
        justRevealedByMe={justRevealedByMe}
      />

      <div className="w-full">
        <p className="mb-1.5 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
          everyone
        </p>
        {room.players.map((id) => {
          const person = people.find((p) => p.id === id);
          const revealed = !!state.revealed[id];
          const outcome = revealed ? outcomeFor(state, id) : null;
          return (
            <Card key={id} className="mb-1.5 flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                {person && <Avatar src={person.photoUrl} name={person.name} size="sm" />}
                <span className="text-sm text-ink">{person?.name ?? "someone"}</span>
              </div>
              <span
                className={`text-sm font-medium ${revealed ? "text-ink" : "text-ink/40"}`}
              >
                {revealed ? outcome : "not revealed yet"}
              </span>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
