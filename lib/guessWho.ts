import { arrayUnion, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GUESS_WHO_IDENTITIES } from "@/lib/guessWhoIdentities";
import type { GuessWhoState } from "@/lib/types";

/** Minimum time to get the phone up to your forehead before your keyword shows. */
export const GUESS_WHO_PREPARE_SECONDS = 5;
/** Works with 2, but it's a lot more fun with a group. */
export const GUESS_WHO_MIN_PLAYERS = 2;

const ROOMS_COLLECTION = "gameRooms";

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function lobbyGuessWhoState(): GuessWhoState {
  return {
    keywords: {},
    startedAt: null,
    prepareSeconds: GUESS_WHO_PREPARE_SECONDS,
    doneOrder: [],
    loserId: null,
    endedAt: null,
  };
}

/** Assigns each player a unique identity, drawn from the shared bank once at round start. */
export function activeGuessWhoState(players: string[]) {
  const picks = shuffled(GUESS_WHO_IDENTITIES).slice(0, players.length);
  const keywords: Record<string, string> = {};
  players.forEach((id, i) => {
    keywords[id] = picks[i];
  });
  return {
    keywords,
    startedAt: serverTimestamp(),
    prepareSeconds: GUESS_WHO_PREPARE_SECONDS,
    doneOrder: [],
    loserId: null,
    endedAt: null,
  };
}

export async function markDone(roomId: string, personId: string) {
  await updateDoc(doc(db, ROOMS_COLLECTION, roomId), {
    "state.doneOrder": arrayUnion(personId),
  });
}

/**
 * Once all but one player have confirmed they guessed correctly, the game
 * ends immediately -- the one player left is the loser, by definition, so
 * there's nothing to wait for. Guards against a rare simultaneous-finish
 * race (two people landing at once could jump straight from N-2 to N) by
 * triggering on "at least N-1 done" rather than an exact count.
 */
export async function resolveIfOneRemains(
  roomId: string,
  players: string[],
  doneOrder: string[],
) {
  if (doneOrder.length < players.length - 1) return;
  const loserId = players.find((id) => !doneOrder.includes(id)) ?? null;
  await updateDoc(doc(db, ROOMS_COLLECTION, roomId), {
    status: "finished",
    "state.loserId": loserId,
    "state.endedAt": serverTimestamp(),
  });
}
