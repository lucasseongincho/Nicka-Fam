/**
 * Display diameter (px) for each of the 11 stages, smallest to largest.
 * Scaled to ~73% of the original curve (40..230) so the largest piece still
 * leaves comfortable roll/settle room inside the field instead of nearly
 * spanning its width -- same growth shape, just smaller throughout.
 */
export const SUIKA_DIAMETERS = [29, 37, 45, 55, 67, 80, 95, 111, 128, 147, 168];

export const SUIKA_STAGE_COUNT = SUIKA_DIAMETERS.length;

/** Only the 5 smallest stages are ever handed to the player to drop. */
export const SUIKA_DROPPABLE_STAGES = 5;

export function suikaFaceSrc(stage: number): string {
  return `/suika-faces/${stage + 1}.png`;
}

export function randomDroppableStage(): number {
  return Math.floor(Math.random() * SUIKA_DROPPABLE_STAGES);
}

/**
 * Points for a merge that produces `resultStage` (1-based count of the
 * resulting piece: 1 for image 2, up to 10 for image 11). Triangular, so
 * late-game merges pay off disproportionately -- matches the original
 * Suika Game's escalating reward feel. Chosen with the user: 1,3,6,10,15,
 * 21,28,36,45,55 for stages 2..11, and 66 for the final same-tier merge of
 * two image-11s (which has nowhere further to go).
 */
export function mergeScore(resultStage: number): number {
  return (resultStage * (resultStage + 1)) / 2;
}

export const SUIKA_FIELD_WIDTH = 300;
export const SUIKA_FIELD_HEIGHT = 420;
export const SUIKA_WALL_THICKNESS = 16;
/** Game-over threshold: a piece resting with its top above this y loses. */
export const SUIKA_DROP_LINE_Y = 70;
/** Where the "current" piece hovers/spawns from. */
export const SUIKA_DROP_SPAWN_Y = 34;
/** How long a piece must rest above the line before it's counted an overflow. */
export const SUIKA_OVER_LINE_MS = 1000;
/** Minimum time between drops, so taps can't spam pieces on top of each other. */
export const SUIKA_DROP_COOLDOWN_MS = 350;
