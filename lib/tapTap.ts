import { doc, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TapTapState } from "@/lib/types";

export const TAP_TAP_DURATION_SECONDS = 10;
/** How often a player's local taps are flushed to Firestore, so we don't write on every tap. */
export const TAP_BATCH_MS = 200;

export function lobbyTapTapState(): TapTapState {
  return {
    durationSeconds: TAP_TAP_DURATION_SECONDS,
    startedAt: null,
    endedAt: null,
    taps: {},
  };
}

export function activeTapTapState() {
  return {
    durationSeconds: TAP_TAP_DURATION_SECONDS,
    startedAt: serverTimestamp(),
    endedAt: null,
    taps: {},
  };
}

export async function addTaps(roomId: string, personId: string, delta: number) {
  if (delta <= 0) return;
  await updateDoc(doc(db, "gameRooms", roomId), {
    [`state.taps.${personId}`]: increment(delta),
  });
}

export function tapTapResults(players: string[], taps: Record<string, number>) {
  return [...players]
    .map((id) => ({ id, count: taps[id] ?? 0 }))
    .sort((a, b) => b.count - a.count);
}
