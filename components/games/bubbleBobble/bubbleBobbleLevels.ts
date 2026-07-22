import { CANVAS_WIDTH } from "./bubbleBobbleConfig";

export interface Platform {
  x: number;
  /** Top surface y -- platforms are one-way (land only when falling onto this from above). */
  y: number;
  width: number;
}

export interface LevelDef {
  /** Filename under /bubble-bobble/assets. */
  background: string;
  /** First entry is always the full-width floor. */
  platforms: Platform[];
  enemyCount: number;
  playerSpawn: { x: number; y: number };
}

function floor(y: number): Platform {
  return { x: 0, y, width: CANVAS_WIDTH };
}

const FLOOR_Y = 536;
/** Floating-row baselines, top to bottom. */
const R1 = 120;
const R2 = 200;
const R3 = 280;
const R4 = 360;
const R5 = 440;

const PLAYER_START = { x: CANVAS_WIDTH / 2, y: FLOOR_Y };

// Every level's platforms are a *contiguous* stack of rows starting at R5
// (the row nearest the floor) -- the player's jump only clears one row's
// worth of height at a time (see JUMP_VELOCITY), so a level that put a
// platform at, say, R3 without anything at R5/R4 underneath it would be
// physically unreachable. More rows = more of the ladder built out, which
// is also how enemy count/difficulty escalates level to level.
export const BUBBLE_BOBBLE_LEVELS: LevelDef[] = [
  // Level 1 -- one row, to introduce jumping.
  {
    background: "bg-cave.png",
    enemyCount: 2,
    playerSpawn: PLAYER_START,
    platforms: [floor(FLOOR_Y), { x: 90, y: R5, width: 180 }],
  },
  // Level 2 -- two rows, a split lower row plus one upper platform.
  {
    background: "bg-cave-forest.png",
    enemyCount: 3,
    playerSpawn: PLAYER_START,
    platforms: [
      floor(FLOOR_Y),
      { x: 20, y: R5, width: 140 },
      { x: 200, y: R5, width: 140 },
      { x: 110, y: R4, width: 140 },
    ],
  },
  // Level 3 -- two rows, wider gap down low (wrap-friendly), narrower perch above.
  {
    background: "bg-cave-ice.png",
    enemyCount: 4,
    playerSpawn: PLAYER_START,
    platforms: [
      floor(FLOOR_Y),
      { x: 0, y: R5, width: 150 },
      { x: 210, y: R5, width: 150 },
      { x: 90, y: R4, width: 180 },
    ],
  },
  // Level 4 -- three rows, staggered.
  {
    background: "bg-cave-crystal.png",
    enemyCount: 5,
    playerSpawn: PLAYER_START,
    platforms: [
      floor(FLOOR_Y),
      { x: 30, y: R5, width: 120 },
      { x: 210, y: R5, width: 120 },
      { x: 120, y: R4, width: 120 },
      { x: 40, y: R3, width: 100 },
      { x: 220, y: R3, width: 100 },
    ],
  },
  // Level 5 -- three rows, a three-segment low row.
  {
    background: "bg-cave-swamp.png",
    enemyCount: 6,
    playerSpawn: PLAYER_START,
    platforms: [
      floor(FLOOR_Y),
      { x: 0, y: R5, width: 100 },
      { x: 150, y: R5, width: 60 },
      { x: 260, y: R5, width: 100 },
      { x: 60, y: R4, width: 100 },
      { x: 200, y: R4, width: 100 },
      { x: 110, y: R3, width: 140 },
    ],
  },
  // Level 6 -- four rows.
  {
    background: "bg-cave-sunset.png",
    enemyCount: 7,
    playerSpawn: PLAYER_START,
    platforms: [
      floor(FLOOR_Y),
      { x: 40, y: R5, width: 100 },
      { x: 220, y: R5, width: 100 },
      { x: 140, y: R4, width: 80 },
      { x: 20, y: R3, width: 90 },
      { x: 250, y: R3, width: 90 },
      { x: 110, y: R2, width: 140 },
    ],
  },
  // Level 7 -- four rows, narrower perches.
  {
    background: "bg-cave-deep.png",
    enemyCount: 8,
    playerSpawn: PLAYER_START,
    platforms: [
      floor(FLOOR_Y),
      { x: 0, y: R5, width: 90 },
      { x: 270, y: R5, width: 90 },
      { x: 110, y: R4, width: 140 },
      { x: 20, y: R3, width: 80 },
      { x: 260, y: R3, width: 80 },
      { x: 140, y: R2, width: 80 },
    ],
  },
  // Level 8 -- all five rows.
  {
    background: "bg-cave-storm.png",
    enemyCount: 9,
    playerSpawn: PLAYER_START,
    platforms: [
      floor(FLOOR_Y),
      { x: 60, y: R5, width: 90 },
      { x: 210, y: R5, width: 90 },
      { x: 0, y: R4, width: 80 },
      { x: 280, y: R4, width: 80 },
      { x: 130, y: R3, width: 100 },
      { x: 30, y: R2, width: 90 },
      { x: 240, y: R2, width: 90 },
      { x: 110, y: R1, width: 140 },
    ],
  },
  // Level 9 -- all five rows, tighter segments.
  {
    background: "bg-cave-lava.png",
    enemyCount: 10,
    playerSpawn: PLAYER_START,
    platforms: [
      floor(FLOOR_Y),
      { x: 20, y: R5, width: 90 },
      { x: 250, y: R5, width: 90 },
      { x: 110, y: R4, width: 140 },
      { x: 0, y: R3, width: 80 },
      { x: 280, y: R3, width: 80 },
      { x: 140, y: R2, width: 80 },
      { x: 30, y: R1, width: 100 },
      { x: 230, y: R1, width: 100 },
    ],
  },
  // Level 10 -- the finale: all five rows, narrowest segments, most enemies.
  {
    background: "bg-cave-gold.png",
    enemyCount: 11,
    playerSpawn: PLAYER_START,
    platforms: [
      floor(FLOOR_Y),
      { x: 10, y: R5, width: 100 },
      { x: 170, y: R5, width: 80 },
      { x: 280, y: R5, width: 80 },
      { x: 60, y: R4, width: 90 },
      { x: 230, y: R4, width: 90 },
      { x: 0, y: R3, width: 70 },
      { x: 150, y: R3, width: 70 },
      { x: 300, y: R3, width: 60 },
      { x: 90, y: R2, width: 80 },
      { x: 200, y: R2, width: 80 },
      { x: 30, y: R1, width: 90 },
      { x: 240, y: R1, width: 90 },
    ],
  },
];

export const BUBBLE_BOBBLE_LEVEL_COUNT = BUBBLE_BOBBLE_LEVELS.length;

/**
 * Once the player clears every hand-built level, play loops back to level 1
 * with escalating enemy counts (see BubbleBobbleCanvas) rather than
 * repeating the exact same difficulty forever.
 */
export function levelForIndex(index: number): { def: LevelDef; loop: number } {
  const loop = Math.floor(index / BUBBLE_BOBBLE_LEVEL_COUNT);
  const def = BUBBLE_BOBBLE_LEVELS[index % BUBBLE_BOBBLE_LEVEL_COUNT];
  return { def, loop };
}

/**
 * Deterministically spreads `count` enemy spawn points across a level's
 * non-floor platforms (so enemies don't spawn stacked on the player's floor
 * start position). Cycles through platforms round-robin, jittering each
 * pass's x position by the golden ratio so repeated passes over the same
 * platform don't stack enemies on top of each other either.
 */
export function computeEnemySpawnPoints(level: LevelDef): { x: number; y: number }[] {
  const perches = level.platforms.slice(1);
  if (perches.length === 0) return [];
  const points: { x: number; y: number }[] = [];
  const margin = 18;
  for (let i = 0; i < level.enemyCount; i++) {
    const platform = perches[i % perches.length];
    const usableWidth = Math.max(1, platform.width - margin * 2);
    const jitter = ((i * 0.61803398875) % 1) * usableWidth;
    points.push({ x: platform.x + margin + jitter, y: platform.y });
  }
  return points;
}
