/**
 * Pure game constants and math for Bubble Bobble -- no React, no canvas
 * calls, so the physics/collision logic can be reasoned about independent
 * of drawing. Mirrors the dinoRunnerConfig.ts / twentyFortyEightConfig.ts split.
 */

export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 560;

export const GRAVITY = 1500;
export const MOVE_SPEED = 150;
/** Max jump height = v^2/2g ~= 154px -- comfortably clears the 80px gap between
 * adjacent platform rows (see bubbleBobbleLevels.ts) plus the 96px gap from
 * the floor up to the lowest row, so every level is climbable one row at a
 * time via one-way platforms (jump straight up through, land only when falling). */
export const JUMP_VELOCITY = -680;

/** In-game pixel height/size targets that every sprite's own opaque content is scaled to -- see bubbleBobbleSprites.ts. */
export const PLAYER_CONTENT_HEIGHT = 46;
export const ENEMY_CONTENT_HEIGHT = 40;
export const BUBBLE_CONTENT_SIZE = 38;

/** Collision half-extents, a bit smaller than the drawn sprite so near-misses feel fair. */
export const PLAYER_HALF_WIDTH = 15;
export const PLAYER_HALF_HEIGHT = 22;
export const ENEMY_HALF_WIDTH = 14;
export const ENEMY_HALF_HEIGHT = 18;
export const BUBBLE_RADIUS = BUBBLE_CONTENT_SIZE / 2;

export const PLATFORM_TILE_WIDTH = 72;
export const PLATFORM_TILE_HEIGHT = 22;
/** Collision surface thickness -- matches the drawn tile height. */
export const PLATFORM_THICKNESS = PLATFORM_TILE_HEIGHT;

// ---------------------------------------------------------------------
// Bubble projectile
// ---------------------------------------------------------------------

export const BUBBLE_SHOOT_SPEED = 260;
/** Horizontal distance a blown bubble travels before it stops drifting forward and just floats. */
export const BUBBLE_TRAVEL_DISTANCE = 90;
export const BUBBLE_FLOAT_SPEED = 55;
/** An empty bubble that never catches anything pops on its own after this long. */
export const BUBBLE_LIFETIME_MS = 4500;
/** Minimum time between blows, so the blow button can't spam bubbles. */
export const BUBBLE_COOLDOWN_MS = 550;
/** A trapped bubble that isn't popped in time releases its enemy (which resumes wandering, unscored). */
export const TRAPPED_BUBBLE_LIFETIME_MS = 9000;
/** Gentle vertical bob amplitude/speed for a hovering trapped bubble. */
export const TRAPPED_BUBBLE_BOB_PX = 6;
export const TRAPPED_BUBBLE_BOB_HZ = 0.6;

// ---------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------

export type EnemyType = "orange" | "spike";
export const ENEMY_TYPES: EnemyType[] = ["orange", "spike"];

export const ENEMY_MOVE_SPEED = 70;
/** Hop height ~= 104px -- like the player's jump, clears one 80px row gap so enemies wander the full height of a level rather than only ever drifting down. */
export const ENEMY_HOP_VELOCITY = -560;
export const ENEMY_MIN_HOP_INTERVAL_MS = 2200;
export const ENEMY_MAX_HOP_INTERVAL_MS = 4800;

export function randomEnemyType(): EnemyType {
  return ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
}

export function randomHopIntervalMs(): number {
  return (
    ENEMY_MIN_HOP_INTERVAL_MS + Math.random() * (ENEMY_MAX_HOP_INTERVAL_MS - ENEMY_MIN_HOP_INTERVAL_MS)
  );
}

// ---------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------

export const TRAP_SCORE = 10;
export const POP_SCORE = 30;

// ---------------------------------------------------------------------
// Collision
// ---------------------------------------------------------------------

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function boxAt(cx: number, cy: number, halfW: number, halfH: number): Box {
  return { left: cx - halfW, right: cx + halfW, top: cy - halfH, bottom: cy + halfH };
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function circlesOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy < r * r;
}

/**
 * Wraps a horizontal position once the entity has moved fully off one edge
 * of the screen, so it slides out one side and back in the other rather
 * than teleporting while half-visible.
 */
export function wrapX(x: number, halfWidth: number): number {
  if (x + halfWidth < 0) return x + CANVAS_WIDTH + halfWidth * 2;
  if (x - halfWidth > CANVAS_WIDTH) return x - CANVAS_WIDTH - halfWidth * 2;
  return x;
}
