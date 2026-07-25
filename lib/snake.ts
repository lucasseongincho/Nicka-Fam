import { serverTimestamp } from "firebase/firestore";
import type { SnakeState } from "@/lib/types";

/** Bots fill empty slots, so a single human is enough to start. */
export const SNAKE_MIN_PLAYERS = 1;

export function lobbySnakeState(): SnakeState {
  return { startedAt: null, endedAt: null };
}

export function activeSnakeState(): SnakeState {
  return { startedAt: serverTimestamp() as unknown as SnakeState["startedAt"], endedAt: null };
}
