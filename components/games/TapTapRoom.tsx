"use client";

import Image from "next/image";
import { useState } from "react";
import { GameResults } from "@/components/games/GameResults";
import { useBatchedCounter } from "@/components/games/useBatchedCounter";
import { useRoundTimer } from "@/components/games/useRoundTimer";
import { finishRoom, rankResults } from "@/lib/gameRooms";
import { TAP_BATCH_MS, addTaps } from "@/lib/tapTap";
import type { GameRoom, Person, TapTapState } from "@/lib/types";

export function TapTapRoom({
  room,
  people,
  activePersonId,
}: {
  room: GameRoom<TapTapState>;
  people: Person[];
  activePersonId: string;
}) {
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "someone";
  const [pressed, setPressed] = useState(false);

  const startedAtMs = room.state.startedAt ? room.state.startedAt.toMillis() : null;
  const roundKey = startedAtMs !== null ? String(startedAtMs) : "unstarted";

  const counter = useBatchedCounter({
    active: room.status === "active",
    roundKey,
    initialValue: room.state.taps[activePersonId] ?? 0,
    batchMs: TAP_BATCH_MS,
    onFlush: (delta) => void addTaps(room.id, activePersonId, delta),
  });

  const timer = useRoundTimer({
    active: room.status === "active",
    startedAtMs,
    prepareSeconds: room.state.prepareSeconds,
    durationSeconds: room.state.durationSeconds,
    onRoundEnd: () => {
      counter.flushNow();
      void finishRoom(room.id);
    },
  });

  const tap = () => {
    if (room.status !== "active" || timer.isPreparing || timer.remainingMs <= 0) return;
    counter.increment();
  };

  if (room.status === "active" && timer.isPreparing) {
    return (
      <div className="flex flex-col items-center gap-2 pt-16 text-center">
        <p className="font-heading text-sm font-semibold uppercase tracking-wide text-ink/45">
          get ready
        </p>
        <p className="font-heading text-7xl font-bold text-orange">
          {timer.prepareRemainingSeconds}
        </p>
        <p className="text-[13px] text-ink/50">fingers on standby...</p>
      </div>
    );
  }

  if (room.status === "active") {
    const others = room.players.filter((id) => id !== activePersonId);
    return (
      <div className="flex flex-col items-center pt-4 text-center">
        <p className="mb-1 font-heading text-4xl font-bold text-orange">
          {timer.remainingSeconds}
        </p>
        <p className="mb-5 text-[13px] text-ink/50">tap tap tap!!</p>

        <button
          onClick={tap}
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerLeave={() => setPressed(false)}
          onPointerCancel={() => setPressed(false)}
          className="relative mb-6 h-40 w-40 select-none"
        >
          <Image
            src={pressed ? "/games/red-button-pushed.png" : "/games/red-button.png"}
            alt=""
            width={160}
            height={160}
            className="pointer-events-none h-40 w-40 object-contain"
            priority
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-heading text-2xl font-bold text-card">
            {counter.count}
          </span>
        </button>

        {others.length > 0 && (
          <div className="w-full">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/45">
              everyone else
            </p>
            {others.map((id) => (
              <div
                key={id}
                className="mb-1.5 flex items-center justify-between rounded-card-sm border-2 border-ink/15 bg-card px-3 py-1.5"
              >
                <span className="text-sm text-ink/70">{nameOf(id)}</span>
                <span className="font-heading text-sm font-semibold text-ink">
                  {room.state.taps[id] ?? 0}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const results = rankResults(room.players, room.state.taps);
  const winner = results[0];
  const loser = results[results.length - 1];
  const tagline =
    results.length > 1
      ? `${nameOf(winner.id)} crushed it — ${nameOf(loser.id)} owes an explanation 👀`
      : "solo run, no shame here";

  return <GameResults results={results} nameOf={nameOf} tagline={tagline} />;
}
