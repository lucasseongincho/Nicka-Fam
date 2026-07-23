import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LadderRung, LadderState } from "@/lib/types";

/** A ladder needs at least two people, or there's nothing to mix. */
export const LADDER_MIN_PLAYERS = 2;

const ROOMS_COLLECTION = "gameRooms";

/** Rows per player, tuned with "medium mixing" -- see generateRungs. */
const ROWS_PER_PLAYER = 3;
const MIN_ROWS = 8;
/** Chance a given row/gap gets a rung, before the no-two-adjacent-gaps constraint thins that out. */
const RUNG_PROBABILITY = 0.45;

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * One row can have several rungs, but two rungs can never share a column
 * (a column can't swap two directions in the same row) -- so within a row,
 * chosen gap indices must never be adjacent. A single left-to-right sweep
 * enforces that for free: once a gap is used, its immediate neighbor gap
 * is skipped.
 */
function generateRungs(playerCount: number, rowCount: number): LadderRung[] {
  const rungs: LadderRung[] = [];
  for (let row = 0; row < rowCount; row++) {
    let lastUsedGap = -2;
    for (let gap = 0; gap < playerCount - 1; gap++) {
      if (gap - lastUsedGap < 2) continue;
      if (Math.random() < RUNG_PROBABILITY) {
        rungs.push({ row, gapIndex: gap });
        lastUsedGap = gap;
      }
    }
  }
  return rungs;
}

export function lobbyLadderState(): LadderState {
  return {
    outcomes: [],
    playerColumns: {},
    ladderStructure: [],
    rowCount: 0,
    revealed: {},
    startedAt: null,
    endedAt: null,
  };
}

/**
 * Generated once, here, by whoever starts the game -- written as the
 * concrete result (not a seed), so every client renders the identical
 * ladder without needing reproducible randomness across devices, same
 * reasoning as activeMoleGameState's topic/mole pick.
 *
 * Starting columns are randomly assigned (not join order) so no one's
 * position is tied to how early they joined the lobby.
 */
export function activeLadderState(players: string[], outcomes: string[]) {
  const columnOrder = shuffled(players);
  const playerColumns: Record<string, number> = {};
  columnOrder.forEach((personId, column) => {
    playerColumns[personId] = column;
  });

  const rowCount = Math.max(MIN_ROWS, players.length * ROWS_PER_PLAYER);

  return {
    outcomes,
    playerColumns,
    ladderStructure: generateRungs(players.length, rowCount),
    rowCount,
    revealed: {},
    // Server-resolved -- matches activeMoleGameState/activeTapTapState's
    // pattern of leaving the return type uninferred as the state's own
    // interface, since serverTimestamp() returns a FieldValue sentinel
    // (write-only), not the real Timestamp readers get back.
    startedAt: serverTimestamp(),
    endedAt: null,
  };
}

export interface LadderPathPoint {
  row: number;
  col: number;
}

/**
 * Traces one player's path from their starting column down through the
 * rungs to a final bottom column. Pure and deterministic -- same
 * rungs/start always produce the same result -- used both to render the
 * animated path and to look up that player's outcome.
 */
export function traceLadderPath(
  startColumn: number,
  rungs: LadderRung[],
  rowCount: number,
): { points: LadderPathPoint[]; finalColumn: number } {
  const gapsByRow = new Map<number, Set<number>>();
  for (const rung of rungs) {
    if (!gapsByRow.has(rung.row)) gapsByRow.set(rung.row, new Set());
    gapsByRow.get(rung.row)!.add(rung.gapIndex);
  }

  let col = startColumn;
  const points: LadderPathPoint[] = [{ row: 0, col }];
  for (let row = 0; row < rowCount; row++) {
    const gaps = gapsByRow.get(row);
    if (gaps?.has(col)) {
      col += 1;
      points.push({ row, col });
    } else if (gaps?.has(col - 1)) {
      col -= 1;
      points.push({ row, col });
    }
    points.push({ row: row + 1, col });
  }
  return { points, finalColumn: col };
}

/**
 * Marks one player's result as revealed. If that was the last player left
 * to reveal, finishes the room too (by convention every game's state has
 * an endedAt, and a finished room drops off the "open lobbies" list).
 */
export async function revealLadderResult(
  roomId: string,
  personId: string,
  players: string[],
  currentRevealed: Record<string, boolean>,
) {
  const allRevealed = players.every((id) => id === personId || currentRevealed[id]);
  await updateDoc(doc(db, ROOMS_COLLECTION, roomId), {
    [`state.revealed.${personId}`]: true,
    ...(allRevealed ? { status: "finished", "state.endedAt": serverTimestamp() } : {}),
  });
}
