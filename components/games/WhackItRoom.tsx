"use client";

import { useEffect, useRef } from "react";
import { GameResults } from "@/components/games/GameResults";
import { useBatchedCounter } from "@/components/games/useBatchedCounter";
import { useRoundTimer } from "@/components/games/useRoundTimer";
import { finishRoom, rankResults } from "@/lib/gameRooms";
import { WHACK_IT_BATCH_MS, addHit } from "@/lib/whackIt";
import type { GameRoom, Person, WhackItState } from "@/lib/types";

export function WhackItRoom({
  room,
  people,
  activePersonId,
}: {
  room: GameRoom<WhackItState>;
  people: Person[];
  activePersonId: string;
}) {
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "someone";

  const startedAtMs = room.state.startedAt ? room.state.startedAt.toMillis() : null;
  const roundKey = startedAtMs !== null ? String(startedAtMs) : "unstarted";

  const counter = useBatchedCounter({
    active: room.status === "active",
    roundKey,
    initialValue: room.state.scores[activePersonId] ?? 0,
    batchMs: WHACK_IT_BATCH_MS,
    onFlush: (delta) => void addHit(room.id, activePersonId, delta),
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

  // Guards against scoring the same mole appearance twice from a flurry of taps.
  const scoredIndicesRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    scoredIndicesRef.current = new Set();
  }, [roundKey]);

  const elapsedInRoundMs = timer.roundStartMs !== null ? timer.now - timer.roundStartMs : -1;
  const activeIndex =
    !timer.isPreparing && elapsedInRoundMs >= 0
      ? room.state.schedule.findIndex(
          (m) => elapsedInRoundMs >= m.showAtMs && elapsedInRoundMs < m.hideAtMs,
        )
      : -1;
  const activeCell = activeIndex >= 0 ? room.state.schedule[activeIndex].cell : null;

  const tapCell = (cell: number) => {
    if (room.status !== "active" || timer.isPreparing || timer.remainingMs <= 0) return;
    if (activeIndex < 0 || activeCell !== cell) return;
    if (scoredIndicesRef.current.has(activeIndex)) return;
    scoredIndicesRef.current.add(activeIndex);
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
        <p className="text-[13px] text-ink/50">eyes on the grid...</p>
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
        <p className="mb-4 text-[13px] text-ink/50">whack it when it pops!</p>

        <div className="mb-3 grid grid-cols-3 gap-2.5">
          {Array.from({ length: room.state.gridSize }, (_, cell) => (
            <button
              key={cell}
              onClick={() => tapCell(cell)}
              className={`flex h-20 w-20 select-none items-center justify-center rounded-2xl border-[3px] border-ink transition-colors ${
                activeCell === cell ? "bg-orange" : "bg-card"
              }`}
            >
              {activeCell === cell && <span className="text-2xl">🔨</span>}
            </button>
          ))}
        </div>
        <p className="mb-6 font-heading text-lg font-bold text-ink">{counter.count}</p>

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
                  {room.state.scores[id] ?? 0}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const results = rankResults(room.players, room.state.scores);
  const winner = results[0];
  const loser = results[results.length - 1];
  const tagline =
    results.length > 1
      ? `${nameOf(winner.id)} has the reflexes — ${nameOf(loser.id)} needs more coffee ☕`
      : "solo run, no shame here";

  return <GameResults results={results} nameOf={nameOf} tagline={tagline} />;
}
