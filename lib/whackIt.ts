import { serverTimestamp } from "firebase/firestore";
import { incrementRoomStateField } from "@/lib/gameRooms";
import type { WhackItMole, WhackItState } from "@/lib/types";

export const WHACK_IT_DURATION_SECONDS = 15;
/** "Get ready" beat between hitting start and the mole schedule actually beginning. */
export const WHACK_IT_PREPARE_SECONDS = 3;
export const WHACK_IT_GRID_SIZE = 9;
/** How often a player's local hits are flushed to Firestore, so we don't write on every tap. */
export const WHACK_IT_BATCH_MS = 200;

const MIN_ACTIVE_MS = 600;
const MAX_ACTIVE_MS = 900;
const MIN_GAP_MS = 250;
const MAX_GAP_MS = 500;

function randomInt(min: number, maxExclusive: number) {
  return Math.floor(min + Math.random() * (maxExclusive - min));
}

/**
 * Generates the full sequence of mole appearances up front, so every player
 * faces the identical schedule (same difficulty for all) without needing any
 * per-mole writes during the round -- each device just compares its own
 * clock-synced "now" against this fixed timeline.
 */
function buildSchedule(durationMs: number): WhackItMole[] {
  const schedule: WhackItMole[] = [];
  let cursor = 0;
  let lastCell = -1;
  while (cursor < durationMs) {
    const activeMs = randomInt(MIN_ACTIVE_MS, MAX_ACTIVE_MS);
    let cell = randomInt(0, WHACK_IT_GRID_SIZE);
    while (cell === lastCell) cell = randomInt(0, WHACK_IT_GRID_SIZE);
    lastCell = cell;
    schedule.push({ cell, showAtMs: cursor, hideAtMs: cursor + activeMs });
    cursor += activeMs + randomInt(MIN_GAP_MS, MAX_GAP_MS);
  }
  return schedule;
}

export function lobbyWhackItState(): WhackItState {
  return {
    durationSeconds: WHACK_IT_DURATION_SECONDS,
    prepareSeconds: WHACK_IT_PREPARE_SECONDS,
    gridSize: WHACK_IT_GRID_SIZE,
    startedAt: null,
    endedAt: null,
    schedule: [],
    scores: {},
  };
}

export function activeWhackItState() {
  return {
    durationSeconds: WHACK_IT_DURATION_SECONDS,
    prepareSeconds: WHACK_IT_PREPARE_SECONDS,
    gridSize: WHACK_IT_GRID_SIZE,
    startedAt: serverTimestamp(),
    endedAt: null,
    schedule: buildSchedule(WHACK_IT_DURATION_SECONDS * 1000),
    scores: {},
  };
}

export async function addHit(roomId: string, personId: string, delta: number) {
  await incrementRoomStateField(roomId, `scores.${personId}`, delta);
}
