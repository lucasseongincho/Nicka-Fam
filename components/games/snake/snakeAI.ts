import { SNAKE_ARENA_SIZE, type Orb, type Point } from "@/lib/snakeConfig";

/**
 * Deliberately simple bot brain: seek the nearest orb, wander when there's
 * nothing nearby, and steer away from a wall or another snake's body if
 * one shows up directly ahead. Not meant to be skilled -- just enough to
 * make the arena feel populated, per the feature spec.
 */

const DETECTION_RADIUS = 160;
const LOOKAHEAD_DIST = 45;
const AVOID_PROBE_ANGLE = 0.9;
const DANGER_MARGIN = 30;

export interface BotAiState {
  wanderTargetHeading: number;
  nextWanderChangeAt: number;
}

export function initBotAiState(heading: number): BotAiState {
  return { wanderTargetHeading: heading, nextWanderChangeAt: 0 };
}

function projectPoint(x: number, y: number, heading: number, dist: number): Point {
  return { x: x + Math.cos(heading) * dist, y: y + Math.sin(heading) * dist };
}

function distToNearestWall(p: Point): number {
  return Math.min(p.x, SNAKE_ARENA_SIZE - p.x, p.y, SNAKE_ARENA_SIZE - p.y);
}

function distToNearestHazard(p: Point, hazardPoints: Point[]): number {
  let min = Infinity;
  for (const h of hazardPoints) {
    const d = Math.hypot(h.x - p.x, h.y - p.y);
    if (d < min) min = d;
  }
  return min;
}

function clearanceAt(p: Point, hazardPoints: Point[]): number {
  return Math.min(distToNearestWall(p), distToNearestHazard(p, hazardPoints));
}

export function computeBotTargetHeading(
  bot: { x: number; y: number; heading: number },
  aiState: BotAiState,
  orbs: Orb[],
  hazardPoints: Point[],
  now: number,
): number {
  const ahead = projectPoint(bot.x, bot.y, bot.heading, LOOKAHEAD_DIST);
  if (clearanceAt(ahead, hazardPoints) < DANGER_MARGIN) {
    const left = projectPoint(bot.x, bot.y, bot.heading - AVOID_PROBE_ANGLE, LOOKAHEAD_DIST);
    const right = projectPoint(bot.x, bot.y, bot.heading + AVOID_PROBE_ANGLE, LOOKAHEAD_DIST);
    const leftClearance = clearanceAt(left, hazardPoints);
    const rightClearance = clearanceAt(right, hazardPoints);
    return leftClearance >= rightClearance
      ? bot.heading - AVOID_PROBE_ANGLE
      : bot.heading + AVOID_PROBE_ANGLE;
  }

  let nearestOrb: Orb | null = null;
  let nearestDist = DETECTION_RADIUS;
  for (const orb of orbs) {
    const d = Math.hypot(orb.x - bot.x, orb.y - bot.y);
    if (d < nearestDist) {
      nearestOrb = orb;
      nearestDist = d;
    }
  }
  if (nearestOrb) return Math.atan2(nearestOrb.y - bot.y, nearestOrb.x - bot.x);

  if (now >= aiState.nextWanderChangeAt) {
    aiState.wanderTargetHeading = bot.heading + (Math.random() - 0.5) * 1.4;
    aiState.nextWanderChangeAt = now + 1200 + Math.random() * 1200;
  }
  return aiState.wanderTargetHeading;
}
