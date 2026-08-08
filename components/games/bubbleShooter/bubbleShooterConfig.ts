/**
 * Pure geometry/state logic for Bubble Shooter (Bust-a-Move style) -- no
 * React, no canvas calls, so the hex-grid math, collision, and scoring can
 * be reasoned about independent of drawing. Mirrors the dinoRunnerConfig.ts
 * split (physics-ish pure functions, the canvas component just calls them
 * every animation frame).
 */

export const FIELD_WIDTH = 300;
export const FIELD_HEIGHT = 460;

/** Same 6 AEGIS face photos Candy Match uses as its tile art -- duplicated
 * here rather than imported, matching how twentyFortyEightConfig.ts
 * duplicates Suika's face path instead of cross-importing it. */
const BUBBLE_FACE_NAMES = ["Bon", "Ellie", "Heeding", "Jaehee", "Lucas", "Sunnie"];
export const BUBBLE_TYPE_COUNT = BUBBLE_FACE_NAMES.length;

export function bubbleFaceSrc(type: number): string {
  return `/AEGIS/${BUBBLE_FACE_NAMES[type % BUBBLE_TYPE_COUNT]}.png`;
}

/**
 * One fixed, high-contrast ring color per face type (red/yellow/purple/
 * blue/white-grey/green) so bubble type reads at a glance while aiming,
 * without having to study the tiny face art itself. Grey gets a slightly
 * darker shade than pure white since a near-white ring disappears against
 * the cream/paper background otherwise.
 */
const BUBBLE_RING_COLORS = ["#e63946", "#ffd60a", "#9b5de5", "#2f6fed", "#c9c9c9", "#2ecc71"];

export function bubbleRingColor(type: number): string {
  return BUBBLE_RING_COLORS[type % BUBBLE_TYPE_COUNT];
}

export function randomBubbleType(): number {
  return Math.floor(Math.random() * BUBBLE_TYPE_COUNT);
}

// ---------------------------------------------------------------------
// Hex grid geometry (offset "odd-r" rows: odd absolute row indices are
// shoved right by one radius, per https://www.redblobgames.com/grids/hexagons
// terminology). EVEN_ROW_COLS fills the full field width; ODD_ROW_COLS has
// one fewer column since it starts half a bubble further right.
// ---------------------------------------------------------------------

export const BUBBLE_RADIUS = FIELD_WIDTH / 16; // = FIELD_WIDTH / (EVEN_ROW_COLS * 2)
export const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
export const ROW_HEIGHT = BUBBLE_RADIUS * Math.sqrt(3);

export const EVEN_ROW_COLS = 8;
export const ODD_ROW_COLS = 7;

/** Center-y of whatever row currently sits at the top of the field. */
export const GRID_ORIGIN_Y = BUBBLE_RADIUS + 4;
/** The physical top boundary of the play field -- a ball reaching this has hit the ceiling. */
export const CEILING_TOP_Y = GRID_ORIGIN_Y - BUBBLE_RADIUS;

export const LAUNCHER_X = FIELD_WIDTH / 2;
export const LAUNCHER_Y = FIELD_HEIGHT - 36;
/** A settled bubble whose bottom edge crosses this line ends the run. */
export const DANGER_LINE_Y = LAUNCHER_Y - 60;

export const STARTING_ROWS = 5;
/** Ceiling drops (a new row is pushed in from the top) every N shots fired -- shot-based, not a wall-clock timer, so slow/careful aiming isn't punished by a ticking clock. Relaxed pace, per user's choice. */
export const SHOTS_PER_DROP = 10;

export const SHOT_SPEED = 620; // px/s

/** Row parity (0 = flush-left/even, 1 = shoved-right/odd), stable forever for a given absolute row index -- fixed at creation time so a bubble's horizontal alignment never flips as new rows get inserted above it. */
export function rowParity(row: number): 0 | 1 {
  return (((row % 2) + 2) % 2) as 0 | 1;
}

export function colsForRow(row: number): number {
  return rowParity(row) === 0 ? EVEN_ROW_COLS : ODD_ROW_COLS;
}

export function pixelX(row: number, col: number): number {
  return BUBBLE_RADIUS + col * BUBBLE_DIAMETER + (rowParity(row) === 1 ? BUBBLE_RADIUS : 0);
}

export function pixelY(row: number, topRow: number): number {
  return GRID_ORIGIN_Y + (row - topRow) * ROW_HEIGHT;
}

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export type Cell = { row: number; col: number };

export function isValidCell(row: number, col: number): boolean {
  return col >= 0 && col < colsForRow(row);
}

/** The 6 hex neighbors of a cell, filtered to columns that actually exist for each neighbor row. Does not check occupancy. */
export function neighborsOf(row: number, col: number): Cell[] {
  const evenRowDirs: [number, number][] = [
    [-1, -1],
    [-1, 0],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
  ];
  const oddRowDirs: [number, number][] = [
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, 0],
    [1, 1],
  ];
  const dirs = rowParity(row) === 0 ? evenRowDirs : oddRowDirs;
  return dirs
    .map(([dr, dc]): Cell => ({ row: row + dr, col: col + dc }))
    .filter((c) => isValidCell(c.row, c.col));
}

export type Bubble = { type: number };
export type Grid = Map<string, Bubble>;

export function getBubble(grid: Grid, row: number, col: number): Bubble | undefined {
  return grid.get(cellKey(row, col));
}

/** Fresh board: STARTING_ROWS full rows of random types, row 0 at the top. */
export function createInitialGrid(): { grid: Grid; topRow: number } {
  const grid: Grid = new Map();
  for (let row = 0; row < STARTING_ROWS; row++) {
    const cols = colsForRow(row);
    for (let col = 0; col < cols; col++) {
      grid.set(cellKey(row, col), { type: randomBubbleType() });
    }
  }
  return { grid, topRow: 0 };
}

/** Pushes a brand new, fully-populated row in at the top. Existing bubbles keep their absolute row/col (and therefore their fixed horizontal alignment) -- only topRow moves, which is what makes the whole cluster render one row further down. */
export function insertRowAtTop(grid: Grid, topRow: number): { grid: Grid; topRow: number } {
  const newTopRow = topRow - 1;
  const next: Grid = new Map(grid);
  const cols = colsForRow(newTopRow);
  for (let col = 0; col < cols; col++) {
    next.set(cellKey(newTopRow, col), { type: randomBubbleType() });
  }
  return { grid: next, topRow: newTopRow };
}

/** BFS over same-type neighbors starting at (row,col), including that cell itself. */
export function findConnectedGroup(grid: Grid, row: number, col: number): Cell[] {
  const start = getBubble(grid, row, col);
  if (!start) return [];
  const visited = new Set<string>([cellKey(row, col)]);
  const group: Cell[] = [{ row, col }];
  const queue: Cell[] = [{ row, col }];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur) break;
    for (const n of neighborsOf(cur.row, cur.col)) {
      const key = cellKey(n.row, n.col);
      if (visited.has(key)) continue;
      const bubble = getBubble(grid, n.row, n.col);
      if (!bubble || bubble.type !== start.type) continue;
      visited.add(key);
      group.push(n);
      queue.push(n);
    }
  }
  return group;
}

/** Every occupied cell not chain-connected back to the current top row -- these have nothing left holding them up and fall/pop as a group. */
export function findFloatingCells(grid: Grid, topRow: number): Cell[] {
  const visited = new Set<string>();
  const queue: Cell[] = [];
  for (const key of grid.keys()) {
    const [row, col] = key.split(",").map(Number);
    if (row === topRow) {
      visited.add(key);
      queue.push({ row, col });
    }
  }
  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur) break;
    for (const n of neighborsOf(cur.row, cur.col)) {
      const key = cellKey(n.row, n.col);
      if (visited.has(key) || !grid.has(key)) continue;
      visited.add(key);
      queue.push(n);
    }
  }
  const floating: Cell[] = [];
  for (const key of grid.keys()) {
    if (visited.has(key)) continue;
    const [row, col] = key.split(",").map(Number);
    floating.push({ row, col });
  }
  return floating;
}

export function isGameOver(grid: Grid, topRow: number): boolean {
  for (const key of grid.keys()) {
    const [row] = key.split(",").map(Number);
    if (pixelY(row, topRow) + BUBBLE_RADIUS >= DANGER_LINE_Y) return true;
  }
  return false;
}

// ---------------------------------------------------------------------
// Shot trajectory: wall-bounce reflection + circle-circle collision
// against the settled grid, geometry only (no physics engine).
// ---------------------------------------------------------------------

export type Vec = { x: number; y: number };

/** Reflects a moving circle off the left/right field walls, clamping position back inside. */
export function reflectOffWalls(x: number, vx: number): { x: number; vx: number } {
  if (x - BUBBLE_RADIUS < 0) return { x: BUBBLE_RADIUS, vx: Math.abs(vx) };
  if (x + BUBBLE_RADIUS > FIELD_WIDTH) return { x: FIELD_WIDTH - BUBBLE_RADIUS, vx: -Math.abs(vx) };
  return { x, vx };
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** The nearest settled bubble within collision range of (x,y), if any. */
export function findHitCell(grid: Grid, topRow: number, x: number, y: number): Cell | null {
  let best: Cell | null = null;
  let bestDist = Infinity;
  for (const key of grid.keys()) {
    const [row, col] = key.split(",").map(Number);
    const cx = pixelX(row, col);
    const cy = pixelY(row, topRow);
    const d = dist(x, y, cx, cy);
    if (d < BUBBLE_DIAMETER && d < bestDist) {
      best = { row, col };
      bestDist = d;
    }
  }
  return best;
}

/** Among the empty neighbors of `hit`, the one geometrically closest to (x,y) -- "snaps into the nearest open grid position adjacent to what it touched." Falls back to any empty neighbor (ignoring distance), then null if the hit cell is somehow fully surrounded. */
export function nearestEmptyNeighbor(grid: Grid, hit: Cell, x: number, y: number, topRow: number): Cell | null {
  const empties = neighborsOf(hit.row, hit.col).filter((c) => !grid.has(cellKey(c.row, c.col)));
  if (empties.length === 0) return null;
  let best = empties[0];
  let bestDist = Infinity;
  for (const c of empties) {
    const d = dist(x, y, pixelX(c.row, c.col), pixelY(c.row, topRow));
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

/** Nearest empty column in `row` to pixel-x `x` -- used when the shot reaches the ceiling without touching an existing bubble first. */
export function nearestEmptyInRow(grid: Grid, row: number, x: number): Cell | null {
  const cols = colsForRow(row);
  let best: Cell | null = null;
  let bestDist = Infinity;
  for (let col = 0; col < cols; col++) {
    if (grid.has(cellKey(row, col))) continue;
    const d = Math.abs(pixelX(row, col) - x);
    if (d < bestDist) {
      best = { row, col };
      bestDist = d;
    }
  }
  return best;
}

export type ShotStepResult =
  | { status: "flying"; pos: Vec; vel: Vec }
  | { status: "landed"; cell: Cell };

/** Advances a flying shot by one frame: moves it, bounces off walls, and checks for a landing (either hitting a settled bubble or reaching the ceiling). Pure function -- the canvas component just calls this every rAF tick and reacts to the result. */
export function advanceShot(grid: Grid, topRow: number, pos: Vec, vel: Vec, dt: number): ShotStepResult {
  let x = pos.x + vel.x * dt;
  const y = pos.y + vel.y * dt;
  const bounced = reflectOffWalls(x, vel.x);
  x = bounced.x;
  const vx = bounced.vx;

  const hit = findHitCell(grid, topRow, x, y);
  if (hit) {
    const target = nearestEmptyNeighbor(grid, hit, x, y, topRow) ?? nearestEmptyInRow(grid, topRow, x);
    if (target) return { status: "landed", cell: target };
  }

  if (y - BUBBLE_RADIUS <= CEILING_TOP_Y) {
    const target = nearestEmptyInRow(grid, topRow, x);
    if (target) return { status: "landed", cell: target };
  }

  return { status: "flying", pos: { x, y }, vel: { x: vx, y: vel.y } };
}

/** Clamps a raw drag-vector into a launch velocity that always points upward -- angle measured from straight up, capped left/right so a shot can never fire sideways into an instant wall bounce loop. */
const MAX_AIM_ANGLE_RAD = (80 * Math.PI) / 180;

export function aimVelocity(dx: number, dy: number): Vec {
  const upward = Math.max(-dy, 1);
  let angle = Math.atan2(dx, upward);
  angle = Math.max(-MAX_AIM_ANGLE_RAD, Math.min(MAX_AIM_ANGLE_RAD, angle));
  return { x: Math.sin(angle) * SHOT_SPEED, y: -Math.cos(angle) * SHOT_SPEED };
}

// ---------------------------------------------------------------------
// Scoring -- same triangular formula as Candy Match's matchScore, so the
// two face-photo games feel consistent: 3-pop=30, 4-pop=60, 5-pop=100,
// 6-pop=150, etc. Floating bubbles knocked loose score a flat bonus each,
// mirroring Candy Match's SPECIAL_CLEAR_BONUS_PER_TILE.
// ---------------------------------------------------------------------

export function popScore(count: number): number {
  return (count * (count - 1) * 10) / 2;
}

export const FLOATING_BONUS_PER_BUBBLE = 20;
