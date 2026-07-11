"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  castVote,
  resolveVotes,
  startDiscussion,
  startVoting,
  submitMoleGuess,
  tallyVotes,
} from "@/lib/moleGame";
import type { GameRoom, MoleGameState, Person } from "@/lib/types";

export function MoleRoom({
  room,
  people,
  activePersonId,
}: {
  room: GameRoom<MoleGameState>;
  people: Person[];
  activePersonId: string;
}) {
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "someone";
  const isHost = activePersonId === room.createdBy;
  const isMole = activePersonId === room.state.moleId;
  const hostName = nameOf(room.createdBy);

  // Once every player has voted, whoever notices first tallies and advances.
  const resolvedRef = useRef(false);
  useEffect(() => {
    if (
      room.state.phase === "vote" &&
      !resolvedRef.current &&
      room.players.every((id) => room.state.votes[id])
    ) {
      resolvedRef.current = true;
      const { votedOutId } = tallyVotes(room.players, room.state.votes);
      void resolveVotes(room.id, votedOutId, room.state.moleId);
    }
  }, [room.state.phase, room.state.votes, room.players, room.id, room.state.moleId]);

  const [guess, setGuess] = useState<string | null>(null);

  if (room.state.phase === "reveal") {
    return (
      <div className="flex flex-col items-center gap-4 pt-8 text-center">
        <Card className="w-full px-4 py-6">
          {isMole ? (
            <>
              <Image
                src="/games/liar.png"
                alt=""
                width={64}
                height={64}
                className="mx-auto mb-1 rounded-card-sm border-2 border-ink"
              />
              <p className="font-heading text-lg font-semibold text-ink">Liar</p>
              <p className="mt-1.5 text-[13px] text-ink/55">
                you don&apos;t know the secret topic. listen closely and bluff your way through.
              </p>
            </>
          ) : (
            <>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/45">
                the secret topic is
              </p>
              <p className="font-heading text-2xl font-bold text-orange">{room.state.topic}</p>
              <p className="mt-1.5 text-[13px] text-ink/55">
                give a clue without saying it — find the mole before they blend in.
              </p>
            </>
          )}
        </Card>

        {isHost ? (
          <Button onClick={() => void startDiscussion(room.id)}>start discussion</Button>
        ) : (
          <p className="text-sm text-ink/45">waiting for {hostName} to start discussion</p>
        )}
      </div>
    );
  }

  if (room.state.phase === "discuss") {
    return (
      <div className="flex flex-col items-center gap-4 pt-10 text-center">
        <p className="font-heading text-lg font-semibold text-ink">discuss out loud, find the mole</p>

        <Card className="w-full px-4 py-5">
          {isMole ? (
            <div className="flex items-center justify-center gap-2">
              <Image
                src="/games/liar.png"
                alt=""
                width={24}
                height={24}
                className="rounded-full border-2 border-ink"
              />
              <p className="text-sm text-ink/70">you&apos;re still the mole — keep bluffing</p>
            </div>
          ) : (
            <p className="text-sm text-ink/70">
              topic: <span className="font-semibold text-ink">{room.state.topic}</span>
            </p>
          )}
        </Card>

        {isHost ? (
          <Button onClick={() => void startVoting(room.id)}>start voting</Button>
        ) : (
          <p className="text-sm text-ink/45">waiting for {hostName} to start voting</p>
        )}
      </div>
    );
  }

  if (room.state.phase === "vote") {
    const myVote = room.state.votes[activePersonId];
    const votedCount = room.players.filter((id) => room.state.votes[id]).length;
    return (
      <div className="flex flex-col items-center gap-4 pt-6 text-center">
        <p className="font-heading text-lg font-semibold text-ink">who&apos;s the mole?</p>
        <p className="-mt-2 text-[13px] text-ink/50">
          {votedCount} of {room.players.length} have voted
        </p>

        <div className="grid w-full grid-cols-3 gap-3">
          {room.players.map((id) => {
            const person = people.find((p) => p.id === id);
            if (!person) return null;
            const selected = myVote === id;
            return (
              <button
                key={id}
                onClick={() => void castVote(room.id, activePersonId, id)}
                className="flex flex-col items-center gap-1.5"
              >
                <Avatar src={person.photoUrl} name={person.name} size="lg" active={selected} />
                <span
                  className={`text-xs ${selected ? "font-semibold text-orange" : "text-ink/60"}`}
                >
                  {person.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (room.state.phase === "moleGuess") {
    return (
      <div className="flex flex-col items-center gap-4 pt-10 text-center">
        <Image
          src="/games/liar.png"
          alt=""
          width={64}
          height={64}
          className="rounded-card-sm border-2 border-ink"
        />
        <p className="font-heading text-lg font-semibold text-ink">the mole was caught!</p>
        {isMole ? (
          <>
            <p className="text-[13px] text-ink/55">
              last chance — guess the topic to steal the win
            </p>
            <div className="grid w-full grid-cols-2 gap-2.5">
              {room.state.wordOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setGuess(option)}
                  className={`rounded-card-sm border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    guess === option ? "border-ink bg-orange text-card" : "border-ink/25 bg-card text-ink"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <Button disabled={!guess} onClick={() => guess && void submitMoleGuess(room.id, guess)}>
              submit guess
            </Button>
          </>
        ) : (
          <p className="text-[13px] text-ink/55">they&apos;re picking their final guess...</p>
        )}
      </div>
    );
  }

  // revealed
  const { counts, votedOutId } = tallyVotes(room.players, room.state.votes);
  const moleCaught = votedOutId === room.state.moleId;
  const moleWon = !moleCaught || room.state.moleGuess === room.state.topic;
  const verdict = moleCaught
    ? moleWon
      ? `caught red-handed, but they guessed right — ${nameOf(room.state.moleId)} wins as the mole`
      : "caught and stumped — crew wins 🎉"
    : `${nameOf(room.state.moleId)} got away with it — mole wins 😈`;

  const rankedByVotes = [...room.players].sort((a, b) => counts[b] - counts[a]);

  return (
    <div className="flex flex-col items-center gap-1 pt-4 text-center">
      <p className="font-heading text-xl font-semibold text-ink">results are in</p>
      <p className="mb-4 text-[13px] text-ink/50">the topic was &ldquo;{room.state.topic}&rdquo;</p>

      <div className="mb-2 w-full">
        {rankedByVotes.map((id) => (
          <Card
            key={id}
            className={`mb-2 flex items-center justify-between px-3.5 py-2.5 ${
              id === room.state.moleId ? "border-orange" : ""
            }`}
          >
            <span className="flex items-center gap-1.5 font-heading text-base font-semibold text-ink">
              {nameOf(id)}
              {id === room.state.moleId && (
                <Image
                  src="/games/liar.png"
                  alt=""
                  width={20}
                  height={20}
                  className="rounded-full border border-ink"
                />
              )}
            </span>
            <span className="text-sm text-ink/55">
              {counts[id]} {counts[id] === 1 ? "vote" : "votes"}
            </span>
          </Card>
        ))}
      </div>

      {room.state.moleGuess && (
        <p className="mb-3 text-[13px] text-ink/55">
          the mole guessed: <span className="font-semibold text-ink">{room.state.moleGuess}</span>
        </p>
      )}

      <p className="text-sm font-medium text-ink">{verdict}</p>
    </div>
  );
}
