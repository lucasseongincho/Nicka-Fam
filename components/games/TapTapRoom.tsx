"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { finishRoom, resetToLobby } from "@/lib/gameRooms";
import { TAP_BATCH_MS, addTaps, lobbyTapTapState, tapTapResults } from "@/lib/tapTap";
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

  const [now, setNow] = useState(() => Date.now());
  const [localCount, setLocalCount] = useState(0);
  const pendingRef = useRef(0);
  const seededRoundRef = useRef<string | null>(null);
  const finishedRef = useRef(false);

  const roundKey = room.state.startedAt
    ? String(room.state.startedAt.toMillis())
    : "unstarted";

  // Seed the local tap counter once per round, then trust only local
  // increments for our own count (the periodic flush keeps Firestore in
  // sync); re-seeding on every snapshot would make our own number jump
  // backward whenever a stale server read lands between flushes.
  useEffect(() => {
    if (room.status === "active" && seededRoundRef.current !== roundKey) {
      seededRoundRef.current = roundKey;
      pendingRef.current = 0;
      finishedRef.current = false;
      setLocalCount(room.state.taps[activePersonId] ?? 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-seed on round change, not every taps update
  }, [room.status, roundKey, activePersonId]);

  useEffect(() => {
    if (room.status !== "active") return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [room.status]);

  useEffect(() => {
    if (room.status !== "active") return;
    const flush = () => {
      if (pendingRef.current > 0) {
        const delta = pendingRef.current;
        pendingRef.current = 0;
        void addTaps(room.id, activePersonId, delta);
      }
    };
    const id = setInterval(flush, TAP_BATCH_MS);
    return () => {
      flush();
      clearInterval(id);
    };
  }, [room.status, room.id, activePersonId]);

  const startedAtMs = room.state.startedAt ? room.state.startedAt.toMillis() : null;
  const endsAtMs = startedAtMs ? startedAtMs + room.state.durationSeconds * 1000 : null;
  const remainingMs = endsAtMs
    ? Math.max(0, endsAtMs - now)
    : room.state.durationSeconds * 1000;
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  // Any client can flip the room to "finished" once time's up; whoever
  // notices first wins the race, the write is idempotent either way.
  useEffect(() => {
    if (
      room.status === "active" &&
      endsAtMs !== null &&
      now >= endsAtMs &&
      !finishedRef.current
    ) {
      finishedRef.current = true;
      if (pendingRef.current > 0) {
        const delta = pendingRef.current;
        pendingRef.current = 0;
        void addTaps(room.id, activePersonId, delta);
      }
      void finishRoom(room.id);
    }
  }, [room.status, now, endsAtMs, room.id, activePersonId]);

  const tap = () => {
    if (room.status !== "active" || remainingMs <= 0) return;
    pendingRef.current += 1;
    setLocalCount((c) => c + 1);
  };

  const playAgain = () => void resetToLobby(room.id, lobbyTapTapState());

  if (room.status === "active") {
    const others = room.players.filter((id) => id !== activePersonId);
    return (
      <div className="flex flex-col items-center pt-4 text-center">
        <p className="mb-1 font-heading text-4xl font-bold text-orange">
          {remainingSeconds}
        </p>
        <p className="mb-5 text-[13px] text-ink/50">tap tap tap!!</p>

        <button
          onClick={tap}
          className="mb-6 flex h-40 w-40 select-none items-center justify-center rounded-full border-[3px] border-ink bg-orange font-heading text-2xl font-bold text-card shadow-button transition-transform active:scale-90"
        >
          {localCount}
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

  const results = tapTapResults(room.players, room.state.taps);
  const winner = results[0];
  const loser = results[results.length - 1];

  return (
    <div className="flex flex-col items-center pt-4 text-center">
      <p className="mb-1 font-heading text-xl font-semibold text-ink">
        results are in
      </p>
      <p className="mb-5 text-[13px] text-ink/50">
        {results.length > 1
          ? `${nameOf(winner.id)} crushed it — ${nameOf(loser.id)} owes an explanation 👀`
          : "solo run, no shame here"}
      </p>

      <div className="mb-6 w-full">
        {results.map((r, i) => (
          <Card
            key={r.id}
            className={`mb-2 flex items-center justify-between px-3.5 py-2.5 ${
              i === 0 ? "border-orange" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-heading text-sm font-semibold text-ink/40">
                #{i + 1}
              </span>
              <span className="font-heading text-base font-semibold text-ink">
                {nameOf(r.id)}
                {i === 0 && " 🏆"}
                {results.length > 1 && i === results.length - 1 && " 💀"}
              </span>
            </div>
            <span className="font-heading text-lg font-bold text-ink">
              {r.count}
            </span>
          </Card>
        ))}
      </div>

      <Button onClick={playAgain}>play again</Button>
    </div>
  );
}
