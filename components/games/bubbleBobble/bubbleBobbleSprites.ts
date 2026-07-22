/**
 * Programmatic sprite analysis for the Bubble Bobble art pack. Unlike Dino
 * Runner (whose sprites' face circles were hand-measured once and baked
 * into config as constants), this pack's enemies share one template with a
 * flat grey circular face-slot, and bubble-trapped.png carries a circular
 * "window" cut via alpha rather than color -- both are located here by
 * scanning each image's actual pixels, once per source, so nothing about
 * slot position needs to be hand-measured or kept in sync with the art.
 *
 * Every sprite is also measured for its own opaque content bounds, since
 * the source PNGs are square canvases with a lot of transparent padding
 * around the drawn character/object -- anchoring on the padded canvas
 * edges would make sprites of different poses/types jitter relative to
 * each other. Scaling and placement always go through that tight bbox.
 */

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FaceSlot {
  cx: number;
  cy: number;
  radius: number;
}

export interface SpriteAnalysis {
  naturalWidth: number;
  naturalHeight: number;
  /** Tight bbox of non-transparent pixels, in the image's own natural coordinates. */
  contentBounds: Bounds;
  /** Where a face photo should be composited, in the image's own natural coordinates. Null if this sprite has no slot (player, platform, backgrounds, empty bubble). */
  faceSlot: FaceSlot | null;
}

export type SlotMode = "none" | "greyCircle" | "alphaWindow";

const FULL_BOUNDS_FALLBACK = (w: number, h: number): Bounds => ({
  minX: 0,
  minY: 0,
  maxX: w,
  maxY: h,
});

const analysisCache = new Map<string, SpriteAnalysis>();

export function analyzeSprite(img: HTMLImageElement, slotMode: SlotMode): SpriteAnalysis {
  const key = `${img.src}::${slotMode}`;
  const cached = analysisCache.get(key);
  if (cached) return cached;
  const result = runAnalysis(img, slotMode);
  analysisCache.set(key, result);
  return result;
}

function runAnalysis(img: HTMLImageElement, slotMode: SlotMode): SpriteAnalysis {
  const width = img.naturalWidth;
  const height = img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || width === 0 || height === 0) {
    return { naturalWidth: width, naturalHeight: height, contentBounds: FULL_BOUNDS_FALLBACK(width, height), faceSlot: null };
  }
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);

  // Single pass: tight opaque-content bbox, plus (for greyCircle mode) the
  // grey-slot bbox at the same time -- both are simple per-pixel classifiers
  // over the same data, no reason to scan twice.
  let contentMinX = width, contentMinY = height, contentMaxX = -1, contentMaxY = -1;
  let greyMinX = width, greyMinY = height, greyMaxX = -1, greyMaxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a <= 10) continue;
      if (x < contentMinX) contentMinX = x;
      if (x > contentMaxX) contentMaxX = x;
      if (y < contentMinY) contentMinY = y;
      if (y > contentMaxY) contentMaxY = y;

      if (slotMode !== "greyCircle" || a < 200) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      // Low saturation (flat grey, not a saturated body color) and inside
      // the flat mid-grey band this art pack uses for its slots (excludes
      // near-white highlights and near-black ink outlines, both low-sat too).
      if (maxC - minC > 12) continue;
      if (r < 150 || r > 235) continue;
      if (x < greyMinX) greyMinX = x;
      if (x > greyMaxX) greyMaxX = x;
      if (y < greyMinY) greyMinY = y;
      if (y > greyMaxY) greyMaxY = y;
    }
  }

  const contentBounds: Bounds =
    contentMaxX >= contentMinX
      ? { minX: contentMinX, minY: contentMinY, maxX: contentMaxX, maxY: contentMaxY }
      : FULL_BOUNDS_FALLBACK(width, height);

  let faceSlot: FaceSlot | null = null;
  if (slotMode === "greyCircle" && greyMaxX >= greyMinX) {
    faceSlot = boundsToSlot(greyMinX, greyMinY, greyMaxX, greyMaxY);
  } else if (slotMode === "alphaWindow") {
    faceSlot = findAlphaWindow(data, width, height);
  }

  return { naturalWidth: width, naturalHeight: height, contentBounds, faceSlot };
}

function boundsToSlot(minX: number, minY: number, maxX: number, maxY: number): FaceSlot {
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    radius: (maxX - minX + (maxY - minY)) / 4,
  };
}

/**
 * Finds bubble-trapped.png's circular "window" -- a region whose alpha sits
 * distinctly below the surrounding bubble fill (but above fully
 * transparent). Thresholding alpha globally would also catch the
 * anti-aliased fringe of the bubble's own outer silhouette (which ramps
 * through every alpha value between 0 and the fill's on its way to fully
 * opaque background), so instead this flood-fills outward from the image's
 * center pixel, only following neighbors whose alpha closely matches the
 * seed's. The fill region (a distinctly different, higher alpha) acts as a
 * wall the flood can never cross, so it can't leak out to that outer fringe.
 */
function findAlphaWindow(data: Uint8ClampedArray, width: number, height: number): FaceSlot | null {
  const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3];

  const seedX = Math.floor(width / 2);
  const seedY = Math.floor(height / 2);
  const seedAlpha = alphaAt(seedX, seedY);
  if (seedAlpha <= 0 || seedAlpha >= 250) return null; // seed isn't inside a translucent window

  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let qHead = 0;
  let qTail = 0;
  const tolerance = 10;

  const tryPush = (x: number, y: number) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    if (Math.abs(alphaAt(x, y) - seedAlpha) > tolerance) return;
    visited[idx] = 1;
    queue[qTail++] = idx;
  };

  visited[seedY * width + seedX] = 1;
  queue[qTail++] = seedY * width + seedX;

  let minX = seedX, minY = seedY, maxX = seedX, maxY = seedY;

  while (qHead < qTail) {
    const idx = queue[qHead++];
    const x = idx % width;
    const y = (idx / width) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    if (x > 0) tryPush(x - 1, y);
    if (x < width - 1) tryPush(x + 1, y);
    if (y > 0) tryPush(x, y - 1);
    if (y < height - 1) tryPush(x, y + 1);
  }

  return boundsToSlot(minX, minY, maxX, maxY);
}

/**
 * A sprite's on-screen placement/scale, derived from its analysis + a
 * target content size. Deliberately doesn't carry the image itself --
 * geometry only depends on the *base* sprite's natural dimensions and
 * content bounds, so this same placement is reused to draw a per-instance
 * composited canvas (base art + a photo baked into the face slot), which
 * shares those exact dimensions. See bubbleBobbleArt.ts.
 */
export interface RenderPlacement {
  /** Scaled draw width/height for the full natural image (including its transparent padding). */
  drawWidth: number;
  drawHeight: number;
  /** Offset from the entity's anchor point to the image's scaled top-left corner. */
  offsetX: number;
  offsetY: number;
  faceSlot: FaceSlot | null;
}

/**
 * Anchor is bottom-center of the sprite's own opaque content (for
 * ground-standing characters). `targetContentHeight` is the desired
 * in-game pixel height of that content -- the whole natural image (padding
 * included) is scaled by the same factor so the face slot lines up.
 */
export function deriveGroundSprite(
  img: HTMLImageElement,
  slotMode: SlotMode,
  targetContentHeight: number,
): RenderPlacement {
  const analysis = analyzeSprite(img, slotMode);
  const contentHeight = Math.max(1, analysis.contentBounds.maxY - analysis.contentBounds.minY);
  return placementFromAnalysis(analysis, targetContentHeight / contentHeight, "bottom");
}

/** Anchor is the center of the sprite's own opaque content (for floating objects like bubbles). */
export function deriveCenteredSprite(
  img: HTMLImageElement,
  slotMode: SlotMode,
  targetContentSize: number,
): RenderPlacement {
  const analysis = analyzeSprite(img, slotMode);
  const { contentBounds } = analysis;
  const contentWidth = Math.max(1, contentBounds.maxX - contentBounds.minX);
  const contentHeight = Math.max(1, contentBounds.maxY - contentBounds.minY);
  const scale = targetContentSize / Math.max(contentWidth, contentHeight);
  return placementFromAnalysis(analysis, scale, "center");
}

function placementFromAnalysis(
  analysis: SpriteAnalysis,
  scale: number,
  anchor: "bottom" | "center",
): RenderPlacement {
  const { naturalWidth, naturalHeight, contentBounds, faceSlot } = analysis;
  const contentCenterX = (contentBounds.minX + contentBounds.maxX) / 2;
  const anchorY = anchor === "bottom" ? contentBounds.maxY : (contentBounds.minY + contentBounds.maxY) / 2;

  return {
    drawWidth: naturalWidth * scale,
    drawHeight: naturalHeight * scale,
    offsetX: -contentCenterX * scale,
    offsetY: -anchorY * scale,
    faceSlot: faceSlot ? { cx: faceSlot.cx * scale, cy: faceSlot.cy * scale, radius: faceSlot.radius * scale } : null,
  };
}
