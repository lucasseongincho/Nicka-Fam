import {
  BUBBLE_CONTENT_SIZE,
  ENEMY_CONTENT_HEIGHT,
  PLATFORM_TILE_HEIGHT,
  PLATFORM_TILE_WIDTH,
  PLAYER_CONTENT_HEIGHT,
} from "./bubbleBobbleConfig";
import type { EnemyType } from "./bubbleBobbleConfig";
import type { Platform } from "./bubbleBobbleLevels";
import { analyzeSprite, deriveCenteredSprite, deriveGroundSprite } from "./bubbleBobbleSprites";
import type { RenderPlacement } from "./bubbleBobbleSprites";

const ASSET_BASE = "/bubble-bobble/assets";
const INK = "#241c16";

const imageCache = new Map<string, HTMLImageElement>();
export function loadImage(filename: string): HTMLImageElement {
  const src = `${ASSET_BASE}/${filename}`;
  let img = imageCache.get(src);
  if (!img) {
    img = new window.Image();
    img.src = src;
    imageCache.set(src, img);
  }
  return img;
}

export function isReady(img: HTMLImageElement | HTMLCanvasElement): boolean {
  if (img instanceof HTMLCanvasElement) return true;
  return img.complete && img.naturalWidth > 0;
}

// ---------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------

export type PlayerPose = "idle" | "walk" | "jump" | "blow";

const PLAYER_SOURCES: Record<PlayerPose, string> = {
  idle: "player-idle.png",
  walk: "player-walk.png",
  jump: "player-jump.png",
  blow: "player-blow.png",
};

const playerPlacementCache = new Map<PlayerPose, RenderPlacement>();
function playerPlacement(pose: PlayerPose): RenderPlacement | null {
  const img = loadImage(PLAYER_SOURCES[pose]);
  if (!isReady(img)) return null;
  let placement = playerPlacementCache.get(pose);
  if (!placement) {
    placement = deriveGroundSprite(img, "none", PLAYER_CONTENT_HEIGHT);
    playerPlacementCache.set(pose, placement);
  }
  return placement;
}

/**
 * Draws the fixed-design player. No face slot on this character at all --
 * per the art pack, the player stays as the plain green design, never
 * gets a composited photo. `facingRight=false` flips the sprite horizontally
 * since all art is front-facing only (no separate left/right frames).
 */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  pose: PlayerPose,
  footX: number,
  footY: number,
  facingRight: boolean,
) {
  const img = loadImage(PLAYER_SOURCES[pose]);
  const placement = playerPlacement(pose);
  if (!placement || !isReady(img)) return;

  ctx.save();
  ctx.translate(footX, footY);
  if (!facingRight) ctx.scale(-1, 1);
  ctx.drawImage(img, placement.offsetX, placement.offsetY, placement.drawWidth, placement.drawHeight);
  ctx.restore();
}

// ---------------------------------------------------------------------
// Enemies -- base art measured once per type, then a photo is baked into
// the measured face slot once per (type, personId) combo the first time
// it's needed, so steady-state drawing is just a plain drawImage call.
// ---------------------------------------------------------------------

const ENEMY_SOURCES: Record<EnemyType, string> = {
  orange: "enemy-type1.png",
  spike: "enemy-type2.png",
};

const enemyPlacementCache = new Map<EnemyType, RenderPlacement>();
function enemyPlacement(type: EnemyType): RenderPlacement | null {
  const img = loadImage(ENEMY_SOURCES[type]);
  if (!isReady(img)) return null;
  let placement = enemyPlacementCache.get(type);
  if (!placement) {
    placement = deriveGroundSprite(img, "greyCircle", ENEMY_CONTENT_HEIGHT);
    enemyPlacementCache.set(type, placement);
  }
  return placement;
}

/** Crops `photoImg` to a centered square and draws it filling the given circle, then rings it. */
function compositeFaceCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  photoImg: HTMLImageElement,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const size = Math.min(photoImg.naturalWidth, photoImg.naturalHeight);
  const sx = (photoImg.naturalWidth - size) / 2;
  const sy = (photoImg.naturalHeight - size) / 2;
  ctx.drawImage(photoImg, sx, sy, size, size, cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

const enemyFaceCanvasCache = new Map<string, HTMLCanvasElement>();

/**
 * Returns a canvas the same natural size as this enemy type's base art,
 * with `photoImg` composited into its measured grey face-slot -- baked
 * once per (type, personId) and reused for every enemy instance/frame that
 * needs it. Null while either source image hasn't finished loading yet.
 */
export function enemyFaceCanvas(type: EnemyType, personId: string, photoImg: HTMLImageElement): HTMLCanvasElement | null {
  const baseImg = loadImage(ENEMY_SOURCES[type]);
  if (!isReady(baseImg) || !isReady(photoImg)) return null;

  const key = `${type}:${personId}`;
  const cached = enemyFaceCanvasCache.get(key);
  if (cached) return cached;

  const analysis = analyzeSprite(baseImg, "greyCircle");
  const canvas = document.createElement("canvas");
  canvas.width = analysis.naturalWidth;
  canvas.height = analysis.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(baseImg, 0, 0);
  if (analysis.faceSlot) {
    const { cx, cy, radius } = analysis.faceSlot;
    compositeFaceCircle(ctx, cx, cy, radius, photoImg);
  }
  enemyFaceCanvasCache.set(key, canvas);
  return canvas;
}

/** Bounce offset for the simple idle/walk "bob" -- alternates without needing a multi-frame walk cycle. */
export function walkBobOffset(elapsedMs: number, moving: boolean): number {
  if (!moving) return 0;
  return Math.abs(Math.sin(elapsedMs / 130)) * -3;
}

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  type: EnemyType,
  faceCanvas: HTMLCanvasElement | null,
  footX: number,
  footY: number,
  facingRight: boolean,
  bobOffset: number,
) {
  const placement = enemyPlacement(type);
  const baseImg = loadImage(ENEMY_SOURCES[type]);
  if (!placement || !isReady(baseImg)) return;
  const source: CanvasImageSource = faceCanvas ?? baseImg;

  ctx.save();
  ctx.translate(footX, footY + bobOffset);
  if (!facingRight) ctx.scale(-1, 1);
  ctx.drawImage(source, placement.offsetX, placement.offsetY, placement.drawWidth, placement.drawHeight);
  ctx.restore();
}

// ---------------------------------------------------------------------
// Bubbles
// ---------------------------------------------------------------------

const emptyBubblePlacementCache = new Map<string, RenderPlacement>();
function emptyBubblePlacement(): RenderPlacement | null {
  const img = loadImage("bubble-empty.png");
  if (!isReady(img)) return null;
  let placement = emptyBubblePlacementCache.get("bubble");
  if (!placement) {
    placement = deriveCenteredSprite(img, "none", BUBBLE_CONTENT_SIZE);
    emptyBubblePlacementCache.set("bubble", placement);
  }
  return placement;
}

export function drawEmptyBubble(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const img = loadImage("bubble-empty.png");
  const placement = emptyBubblePlacement();
  if (!placement || !isReady(img)) return;
  ctx.drawImage(img, x + placement.offsetX, y + placement.offsetY, placement.drawWidth, placement.drawHeight);
}

let trappedBubblePlacementCache: RenderPlacement | null = null;
function trappedBubblePlacement(): RenderPlacement | null {
  const img = loadImage("bubble-trapped.png");
  if (!isReady(img)) return null;
  if (!trappedBubblePlacementCache) {
    trappedBubblePlacementCache = deriveCenteredSprite(img, "alphaWindow", BUBBLE_CONTENT_SIZE);
  }
  return trappedBubblePlacementCache;
}

const trappedBubbleFaceCanvasCache = new Map<string, HTMLCanvasElement>();

/** Same idea as enemyFaceCanvas -- bakes the trapped enemy's photo into bubble-trapped.png's alpha window, once per person. */
export function trappedBubbleFaceCanvas(personId: string, photoImg: HTMLImageElement): HTMLCanvasElement | null {
  const baseImg = loadImage("bubble-trapped.png");
  if (!isReady(baseImg) || !isReady(photoImg)) return null;

  const cached = trappedBubbleFaceCanvasCache.get(personId);
  if (cached) return cached;

  // The "window" is really just a position/size marker (a translucent cutout
  // in the source art) -- same treatment as the enemies' grey face-slot:
  // draw the base bubble art, then composite the photo on top at full
  // opacity within that circle, so the trapped face reads clearly rather
  // than being dimmed by the window's own low alpha.
  const analysis = analyzeSprite(baseImg, "alphaWindow");
  const canvas = document.createElement("canvas");
  canvas.width = analysis.naturalWidth;
  canvas.height = analysis.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(baseImg, 0, 0);
  if (analysis.faceSlot) {
    const { cx, cy, radius } = analysis.faceSlot;
    compositeFaceCircle(ctx, cx, cy, radius, photoImg);
  }
  trappedBubbleFaceCanvasCache.set(personId, canvas);
  return canvas;
}

export function drawTrappedBubble(
  ctx: CanvasRenderingContext2D,
  faceCanvas: HTMLCanvasElement | null,
  x: number,
  y: number,
) {
  const baseImg = loadImage("bubble-trapped.png");
  const placement = trappedBubblePlacement();
  if (!placement || !isReady(baseImg)) return;
  const source: CanvasImageSource = faceCanvas ?? baseImg;
  ctx.drawImage(source, x + placement.offsetX, y + placement.offsetY, placement.drawWidth, placement.drawHeight);
}

// ---------------------------------------------------------------------
// Platforms
// ---------------------------------------------------------------------

export function drawPlatform(ctx: CanvasRenderingContext2D, platform: Platform) {
  const img = loadImage("platform-tile.png");
  ctx.save();
  ctx.beginPath();
  ctx.rect(platform.x, platform.y, platform.width, PLATFORM_TILE_HEIGHT);
  ctx.clip();
  if (isReady(img)) {
    for (let x = platform.x; x < platform.x + platform.width; x += PLATFORM_TILE_WIDTH) {
      ctx.drawImage(img, x, platform.y, PLATFORM_TILE_WIDTH, PLATFORM_TILE_HEIGHT);
    }
  } else {
    ctx.fillStyle = "#b98a52";
    ctx.fillRect(platform.x, platform.y, platform.width, PLATFORM_TILE_HEIGHT);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------

/** Cover-fit: the source art is landscape and the canvas is portrait, so scale to fill and crop the overflow rather than stretching (which would squash the art). */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  filename: string,
  canvasWidth: number,
  canvasHeight: number,
) {
  const img = loadImage(filename);
  if (!isReady(img)) {
    ctx.fillStyle = "#2c2440";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    return;
  }
  const scale = Math.max(canvasWidth / img.naturalWidth, canvasHeight / img.naturalHeight);
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  const dx = (canvasWidth - drawW) / 2;
  const dy = (canvasHeight - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);
}

// ---------------------------------------------------------------------
// Pop effect -- code-driven (no static art): the enemy's own composited
// sprite quickly scales down and fades while a handful of small particles
// burst outward.
// ---------------------------------------------------------------------

export interface PopParticle {
  dx: number;
  dy: number;
  size: number;
}

export interface PopEffect {
  x: number;
  y: number;
  startTime: number;
  type: EnemyType;
  faceCanvas: HTMLCanvasElement | null;
  particles: PopParticle[];
}

const POP_DURATION_MS = 380;

export function createPopEffect(
  x: number,
  y: number,
  startTime: number,
  type: EnemyType,
  faceCanvas: HTMLCanvasElement | null,
): PopEffect {
  const particles: PopParticle[] = Array.from({ length: 10 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 26;
    return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, size: 2 + Math.random() * 2.5 };
  });
  return { x, y, startTime, type, faceCanvas, particles };
}

/** Returns false once the effect has finished and should be removed. */
export function drawPopEffect(ctx: CanvasRenderingContext2D, effect: PopEffect, now: number): boolean {
  const t = (now - effect.startTime) / POP_DURATION_MS;
  if (t >= 1) return false;

  const placement = enemyPlacement(effect.type);
  if (placement) {
    const scale = 1 - t;
    const alpha = 1 - t;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(effect.x, effect.y);
    ctx.scale(scale, scale);
    const source: CanvasImageSource = effect.faceCanvas ?? loadImage(ENEMY_SOURCES[effect.type]);
    ctx.drawImage(source, placement.offsetX, placement.offsetY, placement.drawWidth, placement.drawHeight);
    ctx.restore();
  }

  ctx.save();
  for (const p of effect.particles) {
    const px = effect.x + p.dx * t;
    const py = effect.y + p.dy * t;
    ctx.beginPath();
    ctx.arc(px, py, p.size * (1 - t * 0.6), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(234,150,50,${1 - t})`;
    ctx.fill();
  }
  ctx.restore();

  return true;
}
