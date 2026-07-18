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

export type Direction = "up" | "down" | "left" | "right";

/**
 * A tile carries a stable `id` across moves so the board can animate it
 * sliding from its old row/col to its new one (same React key == same DOM
 * node == a CSS transform transition instead of an unmount/remount).
 */
export type Tile = {
  id: number;
  tier: number;
  row: number;
  col: number;
};

let nextTileId = 1;

function createTile(tier: number, row: number, col: number): Tile {
  return { id: nextTileId++, tier, row, col };
}

function buildGrid(tiles: Tile[]): (Tile | null)[][] {
  const grid: (Tile | null)[][] = Array.from({ length: GRID_SIZE }, () =>
    Array<Tile | null>(GRID_SIZE).fill(null),
  );
  for (const t of tiles) grid[t.row][t.col] = t;
  return grid;
}

function emptyCellPositions(tiles: Tile[]): [number, number][] {
  const occupied = new Set(tiles.map((t) => `${t.row},${t.col}`));
  const cells: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!occupied.has(`${r},${c}`)) cells.push([r, c]);
    }
  }
  return cells;
}

export function spawnTile(tiles: Tile[]): Tile | null {
  const cells = emptyCellPositions(tiles);
  if (cells.length === 0) return null;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  return createTile(randomSpawnTier(), r, c);
}

export function initialTiles(): Tile[] {
  const tiles: Tile[] = [];
  const first = spawnTile(tiles);
  if (first) tiles.push(first);
  const second = spawnTile(tiles);
  if (second) tiles.push(second);
  return tiles;
}

/** Cell coordinates for each line (row or column) in the order tiles collapse toward -- e.g. "left" walks each row from column 0 outward. */
function lineCells(direction: Direction): [number, number][][] {
  const lines: [number, number][][] = [];
  if (direction === "left" || direction === "right") {
    const cols = direction === "left" ? [0, 1, 2, 3] : [3, 2, 1, 0];
    for (let r = 0; r < GRID_SIZE; r++) lines.push(cols.map((c) => [r, c]));
  } else {
    const rows = direction === "up" ? [0, 1, 2, 3] : [3, 2, 1, 0];
    for (let c = 0; c < GRID_SIZE; c++) lines.push(rows.map((r) => [r, c]));
  }
  return lines;
}

export type MoveResult = {
  /** Surviving tiles (including newly-merged ones), with row/col updated to their post-move position. */
  tiles: Tile[];
  /** Tiles consumed by a merge this move, with row/col set to the tile they merged into -- render these briefly so they visibly slide into place before vanishing. */
  removed: Tile[];
  /** ids of surviving tiles that just merged this move, for a small pulse effect. */
  mergedIds: Set<number>;
  scoreGained: number;
  changed: boolean;
};

export function move(tiles: Tile[], direction: Direction): MoveResult {
  const grid = buildGrid(tiles);
  const survivors: Tile[] = [];
  const removed: Tile[] = [];
  const mergedIds = new Set<number>();
  let scoreGained = 0;

  for (const cells of lineCells(direction)) {
    const lineTiles = cells
      .map(([r, c]) => grid[r][c])
      .filter((t): t is Tile => t !== null);

    let slot = 0;
    let i = 0;
    while (i < lineTiles.length) {
      const current = lineTiles[i];
      const next = lineTiles[i + 1];
      const [targetRow, targetCol] = cells[slot];

      if (next && next.tier === current.tier) {
        const mergedTier = Math.min(current.tier + 1, MAX_TIER);
        scoreGained += mergeScore(mergedTier);
        survivors.push({ id: current.id, tier: mergedTier, row: targetRow, col: targetCol });
        removed.push({ ...next, row: targetRow, col: targetCol });
        mergedIds.add(current.id);
        i += 2;
      } else {
        survivors.push({ id: current.id, tier: current.tier, row: targetRow, col: targetCol });
        i += 1;
      }
      slot += 1;
    }
  }

  const changed =
    removed.length > 0 ||
    survivors.some((s) => {
      const original = tiles.find((t) => t.id === s.id);
      return !original || original.row !== s.row || original.col !== s.col;
    });

  return { tiles: survivors, removed, mergedIds, scoreGained, changed };
}

/** True if there's an empty cell or any two orthogonally-adjacent tiles share a tier (i.e. some move would still change the board). */
export function hasMovesAvailable(tiles: Tile[]): boolean {
  if (tiles.length < GRID_SIZE * GRID_SIZE) return true;
  const grid = buildGrid(tiles);
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const tier = grid[r][c]?.tier;
      if (c + 1 < GRID_SIZE && grid[r][c + 1]?.tier === tier) return true;
      if (r + 1 < GRID_SIZE && grid[r + 1][c]?.tier === tier) return true;
    }
  }
  return false;
}

export function hasReachedMaxTier(tiles: Tile[]): boolean {
  return tiles.some((t) => t.tier === MAX_TIER);
}
