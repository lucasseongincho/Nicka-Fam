/**
 * 6x6 rather than the classic 8x8: an 8x8 board in the ~300px width shared
 * with Suika/2048 puts tiles under 35px, below a comfortable mobile tap
 * target. 6x6 in the same width lands tiles around 44px.
 */
export const GRID_SIZE = 6;

/** How many of Suika's 11 face images are in play as candy types -- no size hierarchy here, just same-type matching. */
export const CANDY_TYPE_COUNT = 6;

export const MOVES_LIMIT = 20;

export function candyFaceSrc(type: number): string {
  return `/suika-faces/${type + 1}.png`;
}

export function randomCandyType(): number {
  return Math.floor(Math.random() * CANDY_TYPE_COUNT);
}

/**
 * Points for a single run of `length` same-type tiles, triangular like
 * Suika/2048's merge scoring: 3-match=30, 4-match=60, 5-match=100,
 * 6-match=150.
 */
export function matchScore(length: number): number {
  return (length * (length - 1) * 10) / 2;
}

/** Multiplier applied to a cascade step's raw match score. Step 1 (the swap's own match) is 1x, each further chained step adds 0.5x, capped at 3x. */
export function cascadeMultiplier(cascadeLevel: number): number {
  return Math.min(1 + (cascadeLevel - 1) * 0.5, 3);
}

export type Position = { row: number; col: number };

/** A candy tile carries a stable `id` across moves so the board can animate it sliding/falling (same React key == same DOM node == a CSS transform transition). */
export type Tile = {
  id: number;
  type: number;
  row: number;
  col: number;
};

let nextTileId = 1;

function createTile(type: number, row: number, col: number): Tile {
  return { id: nextTileId++, type, row, col };
}

function buildGrid(tiles: Tile[]): (Tile | null)[][] {
  const grid: (Tile | null)[][] = Array.from({ length: GRID_SIZE }, () =>
    Array<Tile | null>(GRID_SIZE).fill(null),
  );
  for (const t of tiles) grid[t.row][t.col] = t;
  return grid;
}

/** Every qualifying run (3+ same-type tiles) found in a row or column scan, plus the deduped set of cell positions they cover. A tile at the crossing of a horizontal and vertical run is counted in both runs' scores and appears once in `positions`. */
function findMatches(grid: (Tile | null)[][]): { positions: Set<string>; runLengths: number[] } {
  const positions = new Set<string>();
  const runLengths: number[] = [];

  for (let r = 0; r < GRID_SIZE; r++) {
    let runStart = 0;
    for (let c = 1; c <= GRID_SIZE; c++) {
      const prevType = grid[r][c - 1]?.type;
      const curType = c < GRID_SIZE ? grid[r][c]?.type : undefined;
      if (curType !== prevType) {
        const runLength = c - runStart;
        if (runLength >= 3 && prevType !== undefined) {
          runLengths.push(runLength);
          for (let k = runStart; k < c; k++) positions.add(`${r},${k}`);
        }
        runStart = c;
      }
    }
  }

  for (let c = 0; c < GRID_SIZE; c++) {
    let runStart = 0;
    for (let r = 1; r <= GRID_SIZE; r++) {
      const prevType = grid[r - 1][c]?.type;
      const curType = r < GRID_SIZE ? grid[r][c]?.type : undefined;
      if (curType !== prevType) {
        const runLength = r - runStart;
        if (runLength >= 3 && prevType !== undefined) {
          runLengths.push(runLength);
          for (let k = runStart; k < r; k++) positions.add(`${k},${c}`);
        }
        runStart = r;
      }
    }
  }

  return { positions, runLengths };
}

/** Drops surviving tiles in each column to the bottom (preserving order), then fills the vacated top cells with freshly spawned tiles. */
function applyGravityAndSpawn(tiles: Tile[]): Tile[] {
  const byColumn: Tile[][] = Array.from({ length: GRID_SIZE }, () => []);
  for (const t of tiles) byColumn[t.col].push(t);

  const result: Tile[] = [];
  for (let c = 0; c < GRID_SIZE; c++) {
    const colTiles = byColumn[c].sort((a, b) => a.row - b.row);
    const k = colTiles.length;
    for (let i = 0; i < k; i++) {
      result.push({ ...colTiles[i], row: GRID_SIZE - k + i, col: c });
    }
    for (let i = 0; i < GRID_SIZE - k; i++) {
      result.push(createTile(randomCandyType(), i, c));
    }
  }
  return result;
}

function generateSolvedGrid(): Tile[] {
  const typeGrid: number[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(-1));
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      let type: number;
      do {
        type = randomCandyType();
      } while (
        (c >= 2 && typeGrid[r][c - 1] === type && typeGrid[r][c - 2] === type) ||
        (r >= 2 && typeGrid[r - 1][c] === type && typeGrid[r - 2][c] === type)
      );
      typeGrid[r][c] = type;
    }
  }
  const tiles: Tile[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      tiles.push(createTile(typeGrid[r][c], r, c));
    }
  }
  return tiles;
}

/** True if swapping these two tiles' types anywhere on the board would create a match -- used both to validate a player's swap and to check the board isn't stuck. */
export function hasAnyValidMove(tiles: Tile[]): boolean {
  const grid = buildGrid(tiles);
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
      ] as const) {
        const r2 = r + dr;
        const c2 = c + dc;
        if (r2 >= GRID_SIZE || c2 >= GRID_SIZE) continue;
        const a = grid[r][c];
        const b = grid[r2][c2];
        if (!a || !b) continue;
        const swappedGrid = grid.map((row) => [...row]);
        swappedGrid[r][c] = b;
        swappedGrid[r2][c2] = a;
        if (findMatches(swappedGrid).positions.size > 0) return true;
      }
    }
  }
  return false;
}

/** Initial board: no pre-existing 3-in-a-row, and guaranteed to have at least one valid move. */
export function initialTiles(): Tile[] {
  let tiles = generateSolvedGrid();
  while (!hasAnyValidMove(tiles)) {
    tiles = generateSolvedGrid();
  }
  return tiles;
}

export function isAdjacent(a: Position, b: Position): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function swapPositions(tiles: Tile[], a: Position, b: Position): Tile[] {
  return tiles.map((t) => {
    if (t.row === a.row && t.col === a.col) return { ...t, row: b.row, col: b.col };
    if (t.row === b.row && t.col === b.col) return { ...t, row: a.row, col: a.col };
    return t;
  });
}

export function wouldMatch(tiles: Tile[]): boolean {
  return findMatches(buildGrid(tiles)).positions.size > 0;
}

export type CascadeStep = {
  /** ids of tiles cleared this step, for a brief clear animation before they're removed. */
  clearedTileIds: number[];
  scoreGained: number;
  cascadeLevel: number;
  /** Full tile list after this step's clear + gravity + spawn. */
  tilesAfter: Tile[];
  /** ids of tiles that are new this step (spawned to refill the top), for a pop/fall-in animation. */
  newlySpawnedIds: number[];
};

export type ResolveResult = {
  finalTiles: Tile[];
  totalScore: number;
  steps: CascadeStep[];
};

/** Repeatedly clears matches, drops tiles, and refills until the board is stable, scoring each cascade step with an increasing multiplier. */
export function resolveBoard(startingTiles: Tile[]): ResolveResult {
  let working = startingTiles;
  let cascadeLevel = 0;
  let totalScore = 0;
  const steps: CascadeStep[] = [];

  while (true) {
    const grid = buildGrid(working);
    const { positions, runLengths } = findMatches(grid);
    if (positions.size === 0) break;
    cascadeLevel += 1;

    const clearedTileIds = working
      .filter((t) => positions.has(`${t.row},${t.col}`))
      .map((t) => t.id);

    const multiplier = cascadeMultiplier(cascadeLevel);
    const rawScore = runLengths.reduce((sum, len) => sum + matchScore(len), 0);
    const scoreGained = Math.round(rawScore * multiplier);
    totalScore += scoreGained;

    const remaining = working.filter((t) => !positions.has(`${t.row},${t.col}`));
    const remainingIds = new Set(remaining.map((t) => t.id));
    const afterGravity = applyGravityAndSpawn(remaining);
    const newlySpawnedIds = afterGravity.filter((t) => !remainingIds.has(t.id)).map((t) => t.id);

    steps.push({ clearedTileIds, scoreGained, cascadeLevel, tilesAfter: afterGravity, newlySpawnedIds });
    working = afterGravity;
  }

  return { finalTiles: working, totalScore, steps };
}

/** Regenerates a fresh, guaranteed-playable board (used when the current one has no valid moves left) without ending the game or costing a move. */
export function reshuffle(): Tile[] {
  return initialTiles();
}
