/**
 * 6x6 rather than the classic 8x8: an 8x8 board in the ~300px width shared
 * with Suika/2048 puts tiles under 35px, below a comfortable mobile tap
 * target. 6x6 in the same width lands tiles around 44px.
 */
export const GRID_SIZE = 6;

/** Dedicated candy-match face set (public/AEGIS) rather than Suika's tiles -- no size hierarchy here, just same-type matching. */
const CANDY_FACE_NAMES = ["Bon", "Ellie", "Heeding", "Jaehee", "Lucas", "Sunnie"];
export const CANDY_TYPE_COUNT = CANDY_FACE_NAMES.length;

export const MOVES_LIMIT = 20;

export function candyFaceSrc(type: number): string {
  return `/AEGIS/${CANDY_FACE_NAMES[type % CANDY_FACE_NAMES.length]}.png`;
}

/** The face photos are all similar-looking snapshots of the same small
 * group, hard to tell apart at a ~44px tile size -- a distinct color per
 * type (Candy-Crush-style) is what actually reads as a match at a glance. */
const CANDY_COLORS = ["#ef6461", "#f2994a", "#f2c94c", "#6fcf72", "#56ccf2", "#bb6bd9"];

export function candyColor(type: number): string {
  return CANDY_COLORS[type % CANDY_COLORS.length];
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

/** Flat bonus per tile cleared by a special candy's effect (beyond whatever normal match triggered it). */
export const SPECIAL_CLEAR_BONUS_PER_TILE = 20;

export type Position = { row: number; col: number };

/**
 * Special candies, Candy-Crush style:
 * - striped-row / striped-col: made from a 4-match, clears its whole row/column when triggered.
 * - wrapped: made from an L/T-shaped match (a row run and column run crossing), clears a 3x3 area.
 * - color-bomb: made from a 5+-match in a line, clears every tile of one type.
 * A special candy triggers either by being swapped directly, or by being swept into any later match/effect.
 */
export type SpecialType = "striped-row" | "striped-col" | "wrapped" | "color-bomb";

/** A candy tile carries a stable `id` across moves so the board can animate it sliding/falling (same React key == same DOM node == a CSS transform transition). */
export type Tile = {
  id: number;
  type: number;
  row: number;
  col: number;
  special?: SpecialType;
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

type MatchRun = {
  positions: [number, number][];
  orientation: "row" | "col";
  type: number;
};

/** Every qualifying run (3+ same-type tiles) found scanning rows then columns. A crossing cell (part of both a row run and a column run) appears in two separate runs -- that's how L/T shapes get detected downstream. */
function scanRuns(grid: (Tile | null)[][]): MatchRun[] {
  const runs: MatchRun[] = [];

  for (let r = 0; r < GRID_SIZE; r++) {
    let runStart = 0;
    for (let c = 1; c <= GRID_SIZE; c++) {
      const prevType = grid[r][c - 1]?.type;
      const curType = c < GRID_SIZE ? grid[r][c]?.type : undefined;
      if (curType !== prevType) {
        if (c - runStart >= 3 && prevType !== undefined) {
          const positions: [number, number][] = [];
          for (let k = runStart; k < c; k++) positions.push([r, k]);
          runs.push({ positions, orientation: "row", type: prevType });
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
        if (r - runStart >= 3 && prevType !== undefined) {
          const positions: [number, number][] = [];
          for (let k = runStart; k < r; k++) positions.push([k, c]);
          runs.push({ positions, orientation: "col", type: prevType });
        }
        runStart = r;
      }
    }
  }

  return runs;
}

type SpecialCreation = { row: number; col: number; special: SpecialType };

/**
 * From the runs found this step, decides which matched cells get cleared
 * normally and which single cell (per qualifying run/crossing) instead
 * becomes a new special candy rather than being cleared.
 */
function planClear(runs: MatchRun[]): { matchedPositions: Set<string>; creations: SpecialCreation[] } {
  const matchedPositions = new Set<string>();
  for (const run of runs) for (const [r, c] of run.positions) matchedPositions.add(`${r},${c}`);

  const rowCells = new Set<string>();
  const colCells = new Set<string>();
  for (const run of runs) {
    for (const [r, c] of run.positions) {
      (run.orientation === "row" ? rowCells : colCells).add(`${r},${c}`);
    }
  }
  const crossings = [...rowCells].filter((k) => colCells.has(k));

  const creations: SpecialCreation[] = [];
  const claimed = new Set<string>();

  for (const key of crossings) {
    const [r, c] = key.split(",").map(Number);
    creations.push({ row: r, col: c, special: "wrapped" });
    claimed.add(key);
  }

  for (const run of runs) {
    if (run.positions.length < 4) continue;
    const cellKeys = run.positions.map(([r, c]) => `${r},${c}`);
    const pick = cellKeys.find((k) => !claimed.has(k));
    if (!pick) continue; // every cell in this run already claimed by a crossing -- skip, the wrapped candy already covers it
    const [r, c] = pick.split(",").map(Number);
    const special: SpecialType =
      run.positions.length >= 5 ? "color-bomb" : run.orientation === "row" ? "striped-row" : "striped-col";
    creations.push({ row: r, col: c, special });
    claimed.add(pick);
  }

  return { matchedPositions, creations };
}

type EffectSeed = { row: number; col: number; colorBombTargetType?: number };

/**
 * Breadth-first expansion from a set of trigger cells: any special candy
 * among them (or reached through a chain) adds its effect area to the
 * cleared set, and any special candy caught in THAT area chains further.
 * A visited-set keeps this finite even with cyclic-looking chains.
 */
function expandSpecialEffects(tiles: Tile[], seeds: EffectSeed[]): Set<string> {
  const byPosition = new Map<string, Tile>();
  for (const t of tiles) byPosition.set(`${t.row},${t.col}`, t);

  const cleared = new Set<string>();
  const visited = new Set<string>();
  const queue = [...seeds];

  while (queue.length > 0) {
    const seed = queue.shift();
    if (!seed) break;
    const key = `${seed.row},${seed.col}`;
    cleared.add(key);
    if (visited.has(key)) continue;
    visited.add(key);

    const tile = byPosition.get(key);
    if (!tile?.special) continue;

    let effectCells: [number, number][] = [];
    if (tile.special === "striped-row") {
      effectCells = Array.from({ length: GRID_SIZE }, (_, c): [number, number] => [tile.row, c]);
    } else if (tile.special === "striped-col") {
      effectCells = Array.from({ length: GRID_SIZE }, (_, r): [number, number] => [r, tile.col]);
    } else if (tile.special === "wrapped") {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = tile.row + dr;
          const c = tile.col + dc;
          if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) effectCells.push([r, c]);
        }
      }
    } else if (tile.special === "color-bomb") {
      // If we know what it was swapped/matched with, clear that type;
      // otherwise (e.g. two bombs swapped together) fall back to its own type.
      const targetType = seed.colorBombTargetType ?? tile.type;
      effectCells = tiles.filter((t) => t.type === targetType).map((t): [number, number] => [t.row, t.col]);
    }

    for (const [r, c] of effectCells) {
      const cKey = `${r},${c}`;
      cleared.add(cKey);
      if (!visited.has(cKey)) queue.push({ row: r, col: c });
    }
  }

  return cleared;
}

/** Drops surviving tiles in each column to the bottom (preserving order), then fills the vacated top cells with freshly spawned (always plain) tiles. */
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

/** True if swapping these two tiles anywhere on the board would create a match -- used to check the board isn't stuck. A board with any special candy on it is never stuck, since swapping a special is always a valid move. */
export function hasAnyValidMove(tiles: Tile[]): boolean {
  if (tiles.some((t) => t.special)) return true;
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
        if (scanRuns(swappedGrid).length > 0) return true;
      }
    }
  }
  return false;
}

/** Initial board: no pre-existing 3-in-a-row, no specials, and guaranteed to have at least one valid move. */
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

/**
 * Checks a proposed swap: valid if it forms a normal match OR either tile
 * being swapped is a special candy (special candies always trigger on
 * swap, matching Candy Crush). Returns the effect seeds to feed into
 * resolveBoard's first cascade step for any directly-swapped specials.
 */
export function evaluateSwap(
  tiles: Tile[],
  from: Position,
  to: Position,
): { valid: boolean; seeds: EffectSeed[] } {
  const swapped = swapPositions(tiles, from, to);
  const grid = buildGrid(swapped);
  const runs = scanRuns(grid);

  const tileNowAtTo = swapped.find((t) => t.row === to.row && t.col === to.col);
  const tileNowAtFrom = swapped.find((t) => t.row === from.row && t.col === from.col);

  const seeds: EffectSeed[] = [];
  if (tileNowAtTo?.special) {
    seeds.push({
      row: to.row,
      col: to.col,
      colorBombTargetType: tileNowAtFrom?.special ? undefined : tileNowAtFrom?.type,
    });
  }
  if (tileNowAtFrom?.special) {
    seeds.push({
      row: from.row,
      col: from.col,
      colorBombTargetType: tileNowAtTo?.special ? undefined : tileNowAtTo?.type,
    });
  }

  return { valid: runs.length > 0 || seeds.length > 0, seeds };
}

export type CascadeStep = {
  /** ids of tiles cleared this step, for a brief clear animation before they're removed. */
  clearedTileIds: number[];
  /** ids of tiles that just became a special candy this step (they survive, not cleared), for a little flourish. */
  createdSpecialIds: number[];
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

/**
 * Repeatedly clears matches (expanding through any special-candy chain
 * reactions), drops tiles, and refills until the board is stable, scoring
 * each cascade step with an increasing multiplier. `initialSeeds` (from a
 * directly-swapped special candy) only apply to the first step.
 */
export function resolveBoard(startingTiles: Tile[], initialSeeds: EffectSeed[] = []): ResolveResult {
  let working = startingTiles;
  let cascadeLevel = 0;
  let totalScore = 0;
  const steps: CascadeStep[] = [];
  let pendingSeeds = initialSeeds;

  while (true) {
    const grid = buildGrid(working);
    const runs = scanRuns(grid);
    const extraSeeds = pendingSeeds;
    pendingSeeds = [];
    if (runs.length === 0 && extraSeeds.length === 0) break;

    cascadeLevel += 1;
    const { matchedPositions, creations } = planClear(runs);
    const creationKeys = new Set(creations.map((cr) => `${cr.row},${cr.col}`));

    const runTypeByPosition = new Map<string, number>();
    for (const run of runs) for (const [r, c] of run.positions) runTypeByPosition.set(`${r},${c}`, run.type);

    const seeds: EffectSeed[] = [...extraSeeds];
    for (const key of matchedPositions) {
      if (creationKeys.has(key)) continue;
      const [r, c] = key.split(",").map(Number);
      seeds.push({ row: r, col: c, colorBombTargetType: runTypeByPosition.get(key) });
    }

    const clearedPositions = expandSpecialEffects(working, seeds);
    for (const key of creationKeys) clearedPositions.delete(key);

    if (clearedPositions.size === 0) break;

    const rawMatchScore = runs.reduce((sum, run) => sum + matchScore(run.positions.length), 0);
    let extraClearedCount = 0;
    for (const key of clearedPositions) if (!matchedPositions.has(key)) extraClearedCount += 1;

    const multiplier = cascadeMultiplier(cascadeLevel);
    const scoreGained = Math.round((rawMatchScore + extraClearedCount * SPECIAL_CLEAR_BONUS_PER_TILE) * multiplier);
    totalScore += scoreGained;

    const createdSpecialIds: number[] = [];
    const withCreations = working.map((t) => {
      const key = `${t.row},${t.col}`;
      const special = creationKeys.has(key) ? creations.find((cr) => `${cr.row},${cr.col}` === key)!.special : undefined;
      if (special) {
        createdSpecialIds.push(t.id);
        return { ...t, special };
      }
      return t;
    });

    const clearedTileIds = withCreations.filter((t) => clearedPositions.has(`${t.row},${t.col}`)).map((t) => t.id);
    const remaining = withCreations.filter((t) => !clearedPositions.has(`${t.row},${t.col}`));
    const remainingIds = new Set(remaining.map((t) => t.id));
    const afterGravity = applyGravityAndSpawn(remaining);
    const newlySpawnedIds = afterGravity.filter((t) => !remainingIds.has(t.id)).map((t) => t.id);

    steps.push({
      clearedTileIds,
      createdSpecialIds,
      scoreGained,
      cascadeLevel,
      tilesAfter: afterGravity,
      newlySpawnedIds,
    });
    working = afterGravity;
  }

  return { finalTiles: working, totalScore, steps };
}

/** Regenerates a fresh, guaranteed-playable board (used when the current one has no valid moves left) without ending the game or costing a move. */
export function reshuffle(): Tile[] {
  return initialTiles();
}
