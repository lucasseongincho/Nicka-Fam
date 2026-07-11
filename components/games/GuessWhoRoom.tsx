"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useRoundTimer } from "@/components/games/useRoundTimer";
import { markDone, resolveIfOneRemains } from "@/lib/guessWho";
import type { GameRoom, GuessWhoState, Person } from "@/lib/types";

/** There's no fixed round length -- it ends when one player remains -- so
 * durationSeconds just needs to be long enough to never trigger in practice. */
const EFFECTIVELY_FOREVER_SECONDS = 24 * 60 * 60;

export function GuessWhoRoom({
  room,
  people,
  activePersonId,
}: {
  room: GameRoom<GuessWhoState>;
  people: Person[];
  activePersonId: string;
}) {
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "someone";

  const startedAtMs = room.state.startedAt ? room.state.startedAt.toMillis() : null;

  const timer = useRoundTimer({
    active: room.status === "active",
    startedAtMs,
    prepareSeconds: room.state.prepareSeconds,
    durationSeconds: EFFECTIVELY_FOREVER_SECONDS,
    onRoundEnd: () => {},
  });

  // Once all but one player is done, whoever notices first ends the round.
  const resolvedRef = useRef(false);
  useEffect(() => {
    if (
      room.status === "active" &&
      !timer.isPreparing &&
      !resolvedRef.current &&
      room.state.doneOrder.length >= room.players.length - 1
    ) {
      resolvedRef.current = true;
      void resolveIfOneRemains(room.id, room.players, room.state.doneOrder);
    }
  }, [room.status, timer.isPreparing, room.state.doneOrder, room.players, room.id]);

  const myKeyword = room.state.keywords[activePersonId];
  const iAmDone = room.state.doneOrder.includes(activePersonId);

  if (room.status === "active" && timer.isPreparing) {
    return (
      <div className="flex flex-col items-center gap-3 pt-14 text-center">
        <p className="text-3xl">🤳</p>
        <p className="font-heading text-lg font-semibold text-ink">don&apos;t look!</p>
        <p className="font-heading text-6xl font-bold text-orange">
          {timer.prepareRemainingSeconds}
        </p>
        <p className="max-w-[240px] text-[13px] text-ink/55">
          get your phone up to your forehead, screen facing out, before it reveals
        </p>
      </div>
    );
  }

  if (room.status === "active") {
    const doneCount = room.state.doneOrder.length;
    return (
      <div className="flex flex-col items-center gap-4 pt-6 text-center">
        {iAmDone ? (
          <>
            <p className="text-3xl">🎉</p>
            <p className="font-heading text-lg font-semibold text-ink">nice, you got it!</p>
            <p className="text-[13px] text-ink/50">waiting on everyone else to finish up...</p>
          </>
        ) : (
          <>
            <Card className="flex min-h-[180px] w-full flex-col items-center justify-center px-4 py-8">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/40">
                who am i?
              </p>
              <p className="font-heading text-4xl font-bold text-orange">{myKeyword}</p>
            </Card>
            <p className="text-[13px] text-ink/50">
              ask the group yes/no questions out loud — tap done once you guess it
            </p>
            <Button onClick={() => void markDone(room.id, activePersonId)}>
              done, I got it!
            </Button>
          </>
        )}

        <div className="w-full">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/45">
            {doneCount} of {room.players.length} have guessed
          </p>
          {room.players.map((id) => (
            <div
              key={id}
              className="mb-1.5 flex items-center justify-between rounded-card-sm border-2 border-ink/15 bg-card px-3 py-1.5"
            >
              <span className="text-sm text-ink/70">{nameOf(id)}</span>
              <span className="text-sm">{room.state.doneOrder.includes(id) ? "✅" : "🤔"}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // finished
  const loserId = room.state.loserId;
  const revealOrder = loserId ? [...room.state.doneOrder, loserId] : room.state.doneOrder;

  return (
    <div className="flex flex-col items-center gap-1 pt-4 text-center">
      <p className="font-heading text-xl font-semibold text-ink">results are in</p>
      <p className="mb-4 text-[13px] text-ink/50">
        {loserId
          ? `${nameOf(loserId)} was left holding the phone 📱`
          : "everyone got it — no losers this round!"}
      </p>

      <div className="w-full">
        {revealOrder.map((id, i) => (
          <Card
            key={id}
            className={`mb-2 flex items-center justify-between px-3.5 py-2.5 ${
              id === loserId ? "border-orange" : ""
            }`}
          >
            <span className="font-heading text-base font-semibold text-ink">
              {id === loserId ? `${nameOf(id)} 🐢` : `#${i + 1} ${nameOf(id)}`}
            </span>
            <span className="text-sm text-ink/55">{room.state.keywords[id]}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
