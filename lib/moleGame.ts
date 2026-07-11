import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MOLE_TOPICS } from "@/lib/moleTopics";
import type { MoleGameState } from "@/lib/types";

/** A mole game needs at least one "crew" member besides the mole to make sense. */
export const MOLE_MIN_PLAYERS = 3;
/** Topic + this many decoys shown to the mole if caught -- 8 total options. */
export const MOLE_GUESS_DECOY_COUNT = 7;

const ROOMS_COLLECTION = "gameRooms";

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function lobbyMoleGameState(): MoleGameState {
  return {
    phase: "reveal",
    topic: "",
    moleId: "",
    wordOptions: [],
    startedAt: null,
    votes: {},
    moleGuess: null,
    endedAt: null,
  };
}

/**
 * Picks the topic and mole once, at round start, and writes the concrete
 * result (not a seed) so every player sees the identical topic/decoys --
 * no need for the randomness itself to be reproducible across devices.
 */
export function activeMoleGameState(players: string[]) {
  const topic = MOLE_TOPICS[Math.floor(Math.random() * MOLE_TOPICS.length)];
  const moleId = players[Math.floor(Math.random() * players.length)];
  const decoys = shuffled(MOLE_TOPICS.filter((t) => t !== topic)).slice(
    0,
    MOLE_GUESS_DECOY_COUNT,
  );
  return {
    phase: "reveal" as const,
    topic,
    moleId,
    wordOptions: shuffled([topic, ...decoys]),
    startedAt: serverTimestamp(),
    votes: {},
    moleGuess: null,
    endedAt: null,
  };
}

export async function startDiscussion(roomId: string) {
  await updateDoc(doc(db, ROOMS_COLLECTION, roomId), {
    "state.phase": "discuss",
  });
}

export async function startVoting(roomId: string) {
  await updateDoc(doc(db, ROOMS_COLLECTION, roomId), {
    "state.phase": "vote",
  });
}

export async function castVote(roomId: string, voterId: string, suspectId: string) {
  await updateDoc(doc(db, ROOMS_COLLECTION, roomId), {
    [`state.votes.${voterId}`]: suspectId,
  });
}

/** Highest vote-getter is "voted out"; ties resolve to whoever appears first in `players`. */
export function tallyVotes(players: string[], votes: Record<string, string>) {
  const counts: Record<string, number> = {};
  players.forEach((id) => {
    counts[id] = 0;
  });
  Object.values(votes).forEach((suspectId) => {
    counts[suspectId] = (counts[suspectId] ?? 0) + 1;
  });
  const votedOutId = players.reduce(
    (best, id) => (counts[id] > counts[best] ? id : best),
    players[0],
  );
  return { counts, votedOutId };
}

/** Called once all votes are in. If the mole was caught, they get one guess at the topic first. */
export async function resolveVotes(roomId: string, votedOutId: string, moleId: string) {
  if (votedOutId === moleId) {
    await updateDoc(doc(db, ROOMS_COLLECTION, roomId), { "state.phase": "moleGuess" });
    return;
  }
  await updateDoc(doc(db, ROOMS_COLLECTION, roomId), {
    status: "finished",
    "state.phase": "revealed",
    "state.endedAt": serverTimestamp(),
  });
}

export async function submitMoleGuess(roomId: string, guess: string) {
  await updateDoc(doc(db, ROOMS_COLLECTION, roomId), {
    status: "finished",
    "state.phase": "revealed",
    "state.moleGuess": guess,
    "state.endedAt": serverTimestamp(),
  });
}
