/**
 * Loads and caches player photos for circular head compositing, and draws
 * bots' generic placeholder face procedurally (no image asset needed --
 * just a flat color circle with two dot eyes, deliberately plain so it
 * reads at a glance as "not a real person").
 */

const imageCache = new Map<string, HTMLImageElement>();

export function getFaceImage(url: string): HTMLImageElement {
  const cached = imageCache.get(url);
  if (cached) return cached;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  imageCache.set(url, img);
  return img;
}

/** Draws a player's photo clipped to a circle at (x, y) with the given radius, plus a border ring matching the snake's color. */
export function drawPlayerFace(
  ctx: CanvasRenderingContext2D,
  photoUrl: string,
  x: number,
  y: number,
  radius: number,
  ringColor: string,
) {
  const img = getFaceImage(photoUrl);

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (img.complete && img.naturalWidth > 0) {
    ctx.clip();
    ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = "#efe6d8";
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = ringColor;
  ctx.stroke();
  ctx.restore();
}

/** Bots' plain/neutral look: a flat color circle with two simple dot eyes, no photo. */
export function drawBotFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  heading: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#241c16";
  ctx.globalAlpha = 0.35;
  ctx.stroke();
  ctx.globalAlpha = 1;

  const eyeOffset = radius * 0.45;
  const eyeForward = radius * 0.35;
  const perpAngle = heading + Math.PI / 2;
  for (const side of [-1, 1]) {
    const ex = x + Math.cos(heading) * eyeForward + Math.cos(perpAngle) * eyeOffset * side;
    const ey = y + Math.sin(heading) * eyeForward + Math.sin(perpAngle) * eyeOffset * side;
    ctx.beginPath();
    ctx.arc(ex, ey, radius * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = "#241c16";
    ctx.fill();
  }
  ctx.restore();
}
