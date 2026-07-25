/**
 * Shared constants + types for 지렁이게임 (Snake). All gameplay math lives in
 * components/games/snake/useSnakeEngine.ts -- this module only holds the
 * numbers/shapes that both the engine and the RTDB helpers (lib/snakeRtdb.ts)
 * need to agree on.
 */

export interface Point {
  x: number;
  y: number;
}

/** One synced snake -- a human player or a bot, same shape either way. */
export interface SnakeEntity {
  personId: string | null;
  isBot: boolean;
  name: string;
  color: string;
  alive: boolean;
  x: number;
  y: number;
  heading: number;
  boosting: boolean;
  score: number;
  /** Recent head positions spaced by SNAKE_SEGMENT_SPACING -- the body is rendered along these, not synced as a separate "segments" concept. */
  trail: Point[];
  updatedAt: number;
}

export interface Orb {
  x: number;
  y: number;
  value: number;
  color: string;
}

/** Logical units visible on screen at once -- the camera always shows roughly this much of the arena around the player's own head. */
export const SNAKE_VIEWPORT_SIZE = 400;
/** ~3x the viewport -- "medium" arena size. */
export const SNAKE_ARENA_SIZE = SNAKE_VIEWPORT_SIZE * 3;
export const SNAKE_WALL_MARGIN = 24;

export const SNAKE_SEGMENT_SPACING = 6;
export const SNAKE_MAX_TRAIL_POINTS = 260;
export const SNAKE_START_SCORE = 8;

export const SNAKE_BASE_SPEED = 90;
export const SNAKE_BOOST_SPEED_MULT = 1.8;
/** Max radians/sec the heading can turn -- clamped so steering feels responsive but never teleport-snaps. */
export const SNAKE_TURN_RATE = 5.5;

export const SNAKE_HEAD_RADIUS = 11;
export const SNAKE_BODY_RADIUS = 9;
export const SNAKE_EAT_RADIUS = SNAKE_HEAD_RADIUS + 6;
export const SNAKE_COLLISION_RADIUS = SNAKE_HEAD_RADIUS + SNAKE_BODY_RADIUS * 0.6;

export const SNAKE_ORB_RADIUS = 5;
export const SNAKE_ORB_COUNT_TARGET = 45;
export const SNAKE_DEATH_ORB_COUNT = 8;
export const SNAKE_DEATH_ORB_SPREAD = 28;
export const SNAKE_RESPAWN_DELAY_MS = 3000;

export const SNAKE_BOOST_MIN_SCORE = SNAKE_START_SCORE;
/** Gentle shrink, per the chosen boost preset: a small orb drops (and 1 score is spent) this often while boosting, not continuously. */
export const SNAKE_BOOST_DROP_INTERVAL_MS = 400;
export const SNAKE_BOOST_DROP_COST = 1;

export const SNAKE_BOT_TARGET_COUNT = 5;
export const SNAKE_LEADERBOARD_SIZE = 5;
/** How often each client flushes its own snake's position to RTDB. */
export const SNAKE_SYNC_INTERVAL_MS = 100;

export const SNAKE_COLORS = [
  "#EA5A32",
  "#3F9DA6",
  "#C8481F",
  "#7A8B4C",
  "#B25FA0",
  "#4C6FA8",
  "#D9A441",
  "#5FA06B",
];

export const SNAKE_ORB_COLORS = ["#EA5A32", "#3F9DA6", "#D9A441", "#5FA06B", "#B25FA0"];

export function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** How many trail points (spaced by SNAKE_SEGMENT_SPACING) a snake's body should have at a given score -- its visible length. */
export function segmentCountForScore(score: number): number {
  return Math.min(SNAKE_MAX_TRAIL_POINTS, Math.max(6, Math.round(6 + score * 1.6)));
}

export function randomArenaPoint(margin: number = SNAKE_WALL_MARGIN): Point {
  return {
    x: margin + Math.random() * (SNAKE_ARENA_SIZE - margin * 2),
    y: margin + Math.random() * (SNAKE_ARENA_SIZE - margin * 2),
  };
}

/** Deterministic-ish per-id color so a given person/bot tends to keep the same color across respawns in a session. */
export function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return SNAKE_COLORS[hash % SNAKE_COLORS.length];
}
