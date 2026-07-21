/**
 * Pure game constants and math for Dino Runner -- no React, no canvas calls,
 * so the physics/spawn/collision logic can be reasoned about (and unit
 * tested) independent of drawing. Mirrors the twentyFortyEightConfig.ts split.
 */

export const CANVAS_WIDTH = 640;
export const CANVAS_HEIGHT = 320;

/** Y coordinate of the ground surface -- where the player's feet land. Leaves
 * enough headroom above for the player's head to stay on-canvas at the peak
 * of a jump (see JUMP_VELOCITY/GRAVITY below). */
export const GROUND_Y = 230;
export const GROUND_THICKNESS = CANVAS_HEIGHT - GROUND_Y;

/** Fixed horizontal screen position (center-x) of the player -- the world scrolls, not the player. */
export const PLAYER_X = 100;

/** px/s^2 */
export const GRAVITY = 2600;
/** px/s, initial upward velocity applied on jump */
export const JUMP_VELOCITY = -820;

export const BASE_SPEED = 300;
export const MAX_SPEED = 780;
/** Seconds controlling how quickly speed approaches MAX_SPEED -- a soft,
 * ever-slowing ramp rather than a hard cap, so late-game still feels like
 * it's escalating without becoming unplayable. */
export const SPEED_RAMP_TAU = 25;

export function speedAtElapsed(elapsedSeconds: number): number {
  return (
    BASE_SPEED + (MAX_SPEED - BASE_SPEED) * (1 - Math.exp(-elapsedSeconds / SPEED_RAMP_TAU))
  );
}

/** Score increments as distance is covered, independent of frame rate. */
export function scoreForDistance(distancePx: number): number {
  return Math.floor(distancePx / 8);
}

export const MIN_SPAWN_GAP_PX = 380;
export const MAX_SPAWN_GAP_PX = 650;

export function randomSpawnGap(): number {
  return MIN_SPAWN_GAP_PX + Math.random() * (MAX_SPAWN_GAP_PX - MIN_SPAWN_GAP_PX);
}

// ---------------------------------------------------------------------
// Sprite art -- cropped straight from the user-provided reference sheet
// (public/dino-runner/*.png), grid background removed. Each source records
// where the sheet's circular "FACE / Photo Slot" placeholder sits in that
// PNG's own pixel coordinates (measured once from the source art), so a
// person's photo can be composited into exactly that spot at runtime.
// ---------------------------------------------------------------------

export interface SpriteSource {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  faceCx: number;
  faceCy: number;
  faceRadius: number;
}

export type PlayerPoseName = "run" | "jump" | "duck";

export const PLAYER_SPRITE_SOURCES: Record<PlayerPoseName, SpriteSource> = {
  run: {
    src: "/dino-runner/player-run.png",
    naturalWidth: 320,
    naturalHeight: 440,
    faceCx: 203.5,
    faceCy: 126,
    faceRadius: 43,
  },
  jump: {
    src: "/dino-runner/player-jump.png",
    naturalWidth: 255,
    naturalHeight: 400,
    faceCx: 151,
    faceCy: 79,
    faceRadius: 43.5,
  },
  duck: {
    src: "/dino-runner/player-duck.png",
    naturalWidth: 280,
    naturalHeight: 295,
    faceCx: 183,
    faceCy: 79.5,
    faceRadius: 43.5,
  },
};

export type ObstacleType = "cactus" | "boulder" | "crystal" | "bird" | "stump";
export const OBSTACLE_TYPES: ObstacleType[] = ["cactus", "boulder", "crystal", "bird", "stump"];

export function randomObstacleType(): ObstacleType {
  return OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
}

export const OBSTACLE_SPRITE_SOURCES: Record<ObstacleType, SpriteSource> = {
  cactus: {
    src: "/dino-runner/obstacle-cactus.png",
    naturalWidth: 260,
    naturalHeight: 335,
    faceCx: 138,
    faceCy: 127,
    faceRadius: 36,
  },
  boulder: {
    src: "/dino-runner/obstacle-boulder.png",
    naturalWidth: 230,
    naturalHeight: 235,
    faceCx: 121,
    faceCy: 64,
    faceRadius: 40,
  },
  stump: {
    src: "/dino-runner/obstacle-stump.png",
    naturalWidth: 205,
    naturalHeight: 160,
    faceCx: 97,
    faceCy: 75,
    faceRadius: 33,
  },
  bird: {
    // Mirrored horizontally from the source sheet so it faces the direction
    // it flies (obstacles scroll right-to-left toward the player).
    src: "/dino-runner/obstacle-bird.png",
    naturalWidth: 215,
    naturalHeight: 180,
    faceCx: 215 - 141,
    faceCy: 30,
    faceRadius: 23,
  },
  crystal: {
    src: "/dino-runner/obstacle-crystal.png",
    naturalWidth: 270,
    naturalHeight: 215,
    faceCx: 162,
    faceCy: 101,
    faceRadius: 33,
  },
};

/** In-game px radius every sprite's composited face photo renders at. Every
 * source above gets scaled so its OWN face-circle matches this radius,
 * which keeps a friend's face reading as the same size everywhere -- on
 * the player and on every obstacle type -- even though the source art's
 * circles aren't drawn at a consistent pixel size relative to each sprite. */
export const TARGET_FACE_RADIUS = 9;

/** The composited photo's actual on-screen radius -- bigger than
 * TARGET_FACE_RADIUS (which only sets each sprite's overall body scale) so
 * faces stay readable at game scale. The photo circle overflows slightly
 * past the original placeholder outline; that's intentional. */
export const FACE_DISPLAY_RADIUS = 16;

export interface RenderSprite {
  width: number;
  height: number;
  /** Face-marker center, relative to the sprite's own bottom-center anchor point (0,0). */
  faceOffsetX: number;
  faceOffsetY: number;
  faceRadius: number;
}

export function deriveRenderSprite(source: SpriteSource): RenderSprite {
  const scale = TARGET_FACE_RADIUS / source.faceRadius;
  const width = source.naturalWidth * scale;
  const height = source.naturalHeight * scale;
  return {
    width,
    height,
    faceOffsetX: source.faceCx * scale - width / 2,
    faceOffsetY: source.faceCy * scale - height,
    faceRadius: FACE_DISPLAY_RADIUS,
  };
}

export const PLAYER_SPRITES: Record<PlayerPoseName, RenderSprite> = {
  run: deriveRenderSprite(PLAYER_SPRITE_SOURCES.run),
  jump: deriveRenderSprite(PLAYER_SPRITE_SOURCES.jump),
  duck: deriveRenderSprite(PLAYER_SPRITE_SOURCES.duck),
};

export interface ObstacleDef extends RenderSprite {
  type: ObstacleType;
  /** Ground obstacles must be jumped over; elevated ones must be ducked under. */
  elevated: boolean;
  /** Gap between the ground and the obstacle's bottom edge (0 = sitting on the ground). */
  groundGap: number;
}

// groundGap=75 for bird (the only elevated type) is tuned against
// PLAYER_SPRITES.duck's height so a duck clears it (with margin) while
// standing/running does not -- see the collision math in playerBox/obstacleBox below.
const ELEVATED_GROUND_GAP = 75;

export const OBSTACLE_DEFS: Record<ObstacleType, ObstacleDef> = {
  cactus: { type: "cactus", elevated: false, groundGap: 0, ...deriveRenderSprite(OBSTACLE_SPRITE_SOURCES.cactus) },
  boulder: { type: "boulder", elevated: false, groundGap: 0, ...deriveRenderSprite(OBSTACLE_SPRITE_SOURCES.boulder) },
  stump: { type: "stump", elevated: false, groundGap: 0, ...deriveRenderSprite(OBSTACLE_SPRITE_SOURCES.stump) },
  bird: { type: "bird", elevated: true, groundGap: ELEVATED_GROUND_GAP, ...deriveRenderSprite(OBSTACLE_SPRITE_SOURCES.bird) },
  crystal: { type: "crystal", elevated: false, groundGap: 0, ...deriveRenderSprite(OBSTACLE_SPRITE_SOURCES.crystal) },
};

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Shrinking both boxes before testing overlap gives forgiving, "feels fair" collisions. */
const COLLISION_SHRINK = 0.8;

function shrink(box: Box): Box {
  const w = (box.right - box.left) * (1 - COLLISION_SHRINK);
  const h = (box.bottom - box.top) * (1 - COLLISION_SHRINK);
  return {
    left: box.left + w / 2,
    right: box.right - w / 2,
    top: box.top + h / 2,
    bottom: box.bottom - h / 2,
  };
}

export function boxesOverlap(a: Box, b: Box): boolean {
  const sa = shrink(a);
  const sb = shrink(b);
  return sa.left < sb.right && sa.right > sb.left && sa.top < sb.bottom && sa.bottom > sb.top;
}

/** `pose` selects which sprite's own rendered width/height forms the hitbox
 * (run and duck sit flush on the ground; jump's box follows footY upward). */
export function playerBox(pose: PlayerPoseName, footY: number): Box {
  const sprite = PLAYER_SPRITES[pose];
  return {
    left: PLAYER_X - sprite.width / 2,
    right: PLAYER_X + sprite.width / 2,
    top: footY - sprite.height,
    bottom: footY,
  };
}

export function obstacleBox(centerX: number, def: ObstacleDef): Box {
  const bottom = GROUND_Y - def.groundGap;
  return {
    left: centerX - def.width / 2,
    right: centerX + def.width / 2,
    top: bottom - def.height,
    bottom,
  };
}

export type SkyType = "day" | "sunset" | "night" | "desert";
export const SKY_ORDER: SkyType[] = ["day", "sunset", "night", "desert"];
/** Points survived before the background cycles to the next sky. */
export const SKY_CYCLE_SCORE = 1000;
export const SKY_TRANSITION_MS = 1200;

export function skyIndexForScore(score: number): number {
  return Math.floor(score / SKY_CYCLE_SCORE) % SKY_ORDER.length;
}
