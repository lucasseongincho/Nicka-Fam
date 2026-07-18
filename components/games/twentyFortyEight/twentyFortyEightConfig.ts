export const GRID_SIZE = 4;

/**
 * Highest tier, matching the 11 face images borrowed from Suika. Two
 * max-tier tiles can still merge (for a big score payoff via mergeScore),
 * they just don't produce a 12th tier -- there's no art for it -- so the
 * result stays capped at MAX_TIER. That keeps merges (and the game)
 * possible indefinitely after the player first reaches it.
 */
export const MAX_TIER = 11;

/** Chance a freshly spawned tile is tier 1 rather than tier 2 -- mirrors original 2048's 90/10 split between "2" and "4". */
export const SPAWN_TIER_1_WEIGHT = 0.9;

export function tileFaceSrc(tier: number): string {
  return `/suika-faces/${tier}.png`;
}

/**
 * Points awarded for a merge that produces `resultTier`. Triangular, same
 * formula as Suika's mergeScore, so the two games' scores feel consistent
 * given they share tier art. A max-tier-into-max-tier merge is worth 66,
 * same ceiling as Suika's final bonus merge.
 */
export function mergeScore(resultTier: number): number {
  return (resultTier * (resultTier + 1)) / 2;
}

export function randomSpawnTier(): number {
  return Math.random() < SPAWN_TIER_1_WEIGHT ? 1 : 2;
}

/** 0 = empty cell, else the tier (1..MAX_TIER) occupying it. Rows top-to-bottom, columns left-to-right. */
export type Grid = number[][];

export function emptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

export function emptyCells(grid: Grid): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

export function spawnRandomTile(grid: Grid): Grid {
  const cells = emptyCells(grid);
  if (cells.length === 0) return grid;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  const next = grid.map((row) => [...row]);
  next[r][c] = randomSpawnTier();
  return next;
}

export type Direction = "up" | "down" | "left" | "right";

/** Slides+merges one row toward index 0 ("left"). Each tile merges at most once per move, matching standard 2048 behavior. */
function slideRowLeft(row: number[]): { row: number[]; scoreGained: number; changed: boolean } {
  const values = row.filter((v) => v !== 0);
  const result: number[] = [];
  let scoreGained = 0;
  let i = 0;
  while (i < values.length) {
    const current = values[i];
    const next = values[i + 1];
    if (next !== undefined && next === current) {
      const merged = Math.min(current + 1, MAX_TIER);
      result.push(merged);
      scoreGained += mergeScore(merged);
      i += 2;
    } else {
      result.push(current);
      i += 1;
    }
  }
  while (result.length < GRID_SIZE) result.push(0);
  const changed = result.some((v, idx) => v !== row[idx]);
  return { row: result, scoreGained, changed };
}

function transpose(grid: Grid): Grid {
  return grid[0].map((_, c) => grid.map((row) => row[c]));
}

function reverseRows(grid: Grid): Grid {
  return grid.map((row) => [...row].reverse());
}

export function move(grid: Grid, direction: Direction): { grid: Grid; scoreGained: number; changed: boolean } {
  let working = grid;
  if (direction === "up" || direction === "down") working = transpose(working);
  if (direction === "right" || direction === "down") working = reverseRows(working);

  let scoreGained = 0;
  let changed = false;
  const processed = working.map((row) => {
    const res = slideRowLeft(row);
    scoreGained += res.scoreGained;
    if (res.changed) changed = true;
    return res.row;
  });

  let result = processed;
  if (direction === "right" || direction === "down") result = reverseRows(result);
  if (direction === "up" || direction === "down") result = transpose(result);

  return { grid: result, scoreGained, changed };
}

/** True if there's an empty cell or any two orthogonally-adjacent tiles share a tier (i.e. some move would still change the board). */
export function hasMovesAvailable(grid: Grid): boolean {
  if (emptyCells(grid).length > 0) return true;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = grid[r][c];
      if (c + 1 < GRID_SIZE && grid[r][c + 1] === v) return true;
      if (r + 1 < GRID_SIZE && grid[r + 1][c] === v) return true;
    }
  }
  return false;
}

export function hasReachedMaxTier(grid: Grid): boolean {
  return grid.some((row) => row.some((v) => v === MAX_TIER));
}
