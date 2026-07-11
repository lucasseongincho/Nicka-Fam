import { doc, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TapTapState } from "@/lib/types";

export const TAP_TAP_DURATION_SECONDS = 10;
/** "Get ready" beat between hitting start and taps actually counting. */
export const TAP_TAP_PREPARE_SECONDS = 3;
/** How often a player's local taps are flushed to Firestore, so we don't write on every tap. */
export const TAP_BATCH_MS = 200;

export function lobbyTapTapState(): TapTapState {
  return {
    durationSeconds: TAP_TAP_DURATION_SECONDS,
    prepareSeconds: TAP_TAP_PREPARE_SECONDS,
    startedAt: null,
    endedAt: null,
    taps: {},
  };
}

export function activeTapTapState() {
  return {
    durationSeconds: TAP_TAP_DURATION_SECONDS,
    prepareSeconds: TAP_TAP_PREPARE_SECONDS,
    // The single anchor both the "get ready" countdown and the round's
    // start/end are computed from, so every device converges on the same
    // real moments regardless of when they receive this write.
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
