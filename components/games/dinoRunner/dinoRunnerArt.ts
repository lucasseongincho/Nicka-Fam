import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GROUND_Y,
  OBSTACLE_DEFS,
  OBSTACLE_SPRITE_SOURCES,
  PLAYER_SPRITES,
  PLAYER_SPRITE_SOURCES,
} from "./dinoRunnerConfig";
import type { ObstacleType, PlayerPoseName, SkyType } from "./dinoRunnerConfig";

/**
 * All canvas drawing for Dino Runner. The player/obstacle/background art is
 * the user's own reference sheet, cropped and background-removed into
 * public/dino-runner/*.png (see dinoRunnerConfig.ts's *_SPRITE_SOURCES for
 * where each PNG's circular "FACE" placeholder sits) -- this module just
 * draws those images and composites a photo into that same circular spot.
 * ctx.clearRect happens once per frame in the caller, so sprites always
 * sit on a transparent (or already-painted) canvas, never a bounding box.
 */

const INK = "#241c16";
const FACE_FALLBACK = "#efe6d8";

const imageCache = new Map<string, HTMLImageElement>();
function loadImage(src: string): HTMLImageElement {
  let img = imageCache.get(src);
  if (!img) {
    img = new window.Image();
    img.src = src;
    imageCache.set(src, img);
  }
  return img;
}

function isReady(img: HTMLImageElement): boolean {
  return img.complete && img.naturalWidth > 0;
}

/**
 * Circular face-photo marker shared by the player and every obstacle type.
 * Coordinates are in the caller's current transform, so it composes with a
 * translate()'d local sprite space. Falls back to a plain filled ring if
 * the photo hasn't loaded yet, so nothing pops in abruptly mid-run.
 */
export function drawFaceMarker(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  img: HTMLImageElement | null,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  if (img && isReady(img)) {
    ctx.save();
    ctx.clip();
    const size = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - size) / 2;
    const sy = (img.naturalHeight - size) / 2;
    ctx.drawImage(img, sx, sy, size, size, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = FACE_FALLBACK;
    ctx.fill();
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------

export type PlayerPose = PlayerPoseName;

/**
 * Draws the player at (footX, footY) -- footY is the ground-contact point
 * for run/jump, or the crouch-contact point for duck.
 */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  pose: PlayerPose,
  footX: number,
  footY: number,
  faceImg: HTMLImageElement | null,
) {
  const img = loadImage(PLAYER_SPRITE_SOURCES[pose].src);
  const sprite = PLAYER_SPRITES[pose];

  ctx.save();
  ctx.translate(footX, footY);

  if (isReady(img)) {
    ctx.drawImage(img, -sprite.width / 2, -sprite.height, sprite.width, sprite.height);
  }
  drawFaceMarker(ctx, sprite.faceOffsetX, sprite.faceOffsetY, sprite.faceRadius, faceImg);

  ctx.restore();
}

// ---------------------------------------------------------------------
// Obstacles
// ---------------------------------------------------------------------

/**
 * Draws an obstacle whose bottom edge sits at `bottom` (GROUND_Y minus its
 * groundGap) and horizontal center at `centerX`. The face marker is placed
 * via that type's measured offset from the same bottom-center anchor.
 */
export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  type: ObstacleType,
  centerX: number,
  faceImg: HTMLImageElement | null,
) {
  const def = OBSTACLE_DEFS[type];
  const img = loadImage(OBSTACLE_SPRITE_SOURCES[type].src);
  const bottom = GROUND_Y - def.groundGap;

  ctx.save();
  ctx.translate(centerX, bottom);

  if (isReady(img)) {
    ctx.drawImage(img, -def.width / 2, -def.height, def.width, def.height);
  }
  drawFaceMarker(ctx, def.faceOffsetX, def.faceOffsetY, def.faceRadius, faceImg);

  ctx.restore();
}

// ---------------------------------------------------------------------
// Backgrounds
// ---------------------------------------------------------------------

const SKY_SOURCES: Record<SkyType, string> = {
  day: "/dino-runner/bg-day.png",
  sunset: "/dino-runner/bg-sunset.png",
  night: "/dino-runner/bg-night.png",
  desert: "/dino-runner/bg-desert.png",
};

const SKY_FALLBACK_COLOR: Record<SkyType, string> = {
  day: "#7ec4f0",
  sunset: "#c9678f",
  night: "#131f42",
  desert: "#eab567",
};

/**
 * Draws one full sky layer at the given opacity -- the caller draws the
 * outgoing sky at (1 - t) and the incoming sky at t during a background
 * transition, to crossfade between them.
 */
export function drawSky(ctx: CanvasRenderingContext2D, sky: SkyType, alpha: number, groundY: number) {
  const img = loadImage(SKY_SOURCES[sky]);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (isReady(img)) {
    ctx.drawImage(img, 0, 0, CANVAS_WIDTH, groundY);
  } else {
    ctx.fillStyle = SKY_FALLBACK_COLOR[sky];
    ctx.fillRect(0, 0, CANVAS_WIDTH, groundY);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------

const GROUND_TILE_SRC = "/dino-runner/ground-tile.png";

/** Scrolls continuously regardless of sky -- `scrollX` should be a positive, ever-increasing distance. */
export function drawGround(ctx: CanvasRenderingContext2D, scrollX: number, groundY: number) {
  const img = loadImage(GROUND_TILE_SRC);
  const thickness = CANVAS_HEIGHT - groundY;

  if (!isReady(img)) {
    ctx.fillStyle = "#c9a876";
    ctx.fillRect(0, groundY, CANVAS_WIDTH, thickness);
    return;
  }

  const scale = thickness / img.naturalHeight;
  const tileWidth = img.naturalWidth * scale;
  const offset = -(scrollX % tileWidth);
  for (let x = offset - tileWidth; x < CANVAS_WIDTH; x += tileWidth) {
    ctx.drawImage(img, x, groundY, tileWidth, thickness);
  }
}
