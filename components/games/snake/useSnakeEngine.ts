"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Person } from "@/lib/types";
import {
  SNAKE_ARENA_SIZE,
  SNAKE_BASE_SPEED,
  SNAKE_BODY_RADIUS,
  SNAKE_BOOST_DROP_COST,
  SNAKE_BOOST_DROP_INTERVAL_MS,
  SNAKE_BOOST_MIN_SCORE,
  SNAKE_BOOST_SPEED_MULT,
  SNAKE_BOT_TARGET_COUNT,
  SNAKE_COLLISION_RADIUS,
  SNAKE_DEATH_ORB_COUNT,
  SNAKE_DEATH_ORB_SPREAD,
  SNAKE_EAT_RADIUS,
  SNAKE_HEAD_RADIUS,
  SNAKE_LEADERBOARD_SIZE,
  SNAKE_ORB_COLORS,
  SNAKE_ORB_RADIUS,
  SNAKE_RESPAWN_DELAY_MS,
  SNAKE_SEGMENT_SPACING,
  SNAKE_START_SCORE,
  SNAKE_SYNC_INTERVAL_MS,
  SNAKE_TURN_RATE,
  SNAKE_VIEWPORT_SIZE,
  colorForId,
  pickRandom,
  randomArenaPoint,
  segmentCountForScore,
  type Orb,
  type Point,
  type SnakeEntity,
} from "@/lib/snakeConfig";
import {
  addOrbs,
  claimOrb,
  listenOrbs,
  listenSnakes,
  registerSnakeDisconnectCleanup,
  removeSnakeNode,
  seedInitialOrbsIfNeeded,
  writeSnakeNode,
} from "@/lib/snakeRtdb";
import { drawBotFace, drawPlayerFace } from "@/components/games/snake/faceCache";
import { computeBotTargetHeading, initBotAiState, type BotAiState } from "@/components/games/snake/snakeAI";

const BOT_NAMES = ["Wiggly", "Noodle", "Squiggs", "Doodle", "Zigzag", "Mochi"];

interface SimSnake {
  id: string;
  isBot: boolean;
  personId: string | null;
  name: string;
  color: string;
  alive: boolean;
  x: number;
  y: number;
  heading: number;
  boosting: boolean;
  score: number;
  trail: Point[];
  diedAt: number | null;
  lastBoostDropAt: number;
  ai?: BotAiState;
}

export interface SnakeLeaderboardEntry {
  id: string;
  name: string;
  score: number;
  isBot: boolean;
  isSelf: boolean;
}

function spawnSnake(id: string, opts: { isBot: boolean; personId: string | null; name: string }): SimSnake {
  const spawn = randomArenaPoint();
  const heading = Math.random() * Math.PI * 2;
  return {
    id,
    isBot: opts.isBot,
    personId: opts.personId,
    name: opts.name,
    color: colorForId(id),
    alive: true,
    x: spawn.x,
    y: spawn.y,
    heading,
    boosting: false,
    score: SNAKE_START_SCORE,
    trail: [{ x: spawn.x, y: spawn.y }],
    diedAt: null,
    lastBoostDropAt: 0,
    ai: opts.isBot ? initBotAiState(heading) : undefined,
  };
}

function respawnSnake(entity: SimSnake) {
  const spawn = randomArenaPoint();
  entity.alive = true;
  entity.x = spawn.x;
  entity.y = spawn.y;
  entity.heading = Math.random() * Math.PI * 2;
  entity.boosting = false;
  entity.score = SNAKE_START_SCORE;
  entity.trail = [{ x: spawn.x, y: spawn.y }];
  entity.diedAt = null;
  entity.lastBoostDropAt = 0;
}

function toEntity(s: SimSnake): SnakeEntity {
  return {
    personId: s.personId,
    isBot: s.isBot,
    name: s.name,
    color: s.color,
    alive: s.alive,
    x: s.x,
    y: s.y,
    heading: s.heading,
    boosting: s.boosting,
    score: s.score,
    trail: s.trail,
    updatedAt: Date.now(),
  };
}

function clampAngleTurn(current: number, target: number, maxDelta: number): number {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + Math.max(-maxDelta, Math.min(maxDelta, diff));
}

function recordTrailPoint(entity: SimSnake) {
  const last = entity.trail[entity.trail.length - 1];
  if (!last || Math.hypot(entity.x - last.x, entity.y - last.y) >= SNAKE_SEGMENT_SPACING) {
    entity.trail.push({ x: entity.x, y: entity.y });
    const maxPoints = segmentCountForScore(entity.score);
    if (entity.trail.length > maxPoints) entity.trail.splice(0, entity.trail.length - maxPoints);
  }
}

function moveForward(entity: SimSnake, dt: number) {
  const speed =
    entity.boosting && entity.score > SNAKE_BOOST_MIN_SCORE
      ? SNAKE_BASE_SPEED * SNAKE_BOOST_SPEED_MULT
      : SNAKE_BASE_SPEED;
  entity.x += Math.cos(entity.heading) * speed * dt;
  entity.y += Math.sin(entity.heading) * speed * dt;
  recordTrailPoint(entity);
}

function isOutOfBounds(entity: { x: number; y: number }): boolean {
  return entity.x < 0 || entity.x > SNAKE_ARENA_SIZE || entity.y < 0 || entity.y > SNAKE_ARENA_SIZE;
}

function collidesWithHazards(entity: { x: number; y: number }, hazards: Point[]): boolean {
  for (const h of hazards) {
    if (Math.hypot(h.x - entity.x, h.y - entity.y) < SNAKE_COLLISION_RADIUS) return true;
  }
  return false;
}

/**
 * Drives the whole match for the local client: physics, steering, wall/body
 * collision, orb consumption, boost shrink, bot AI (when host), throttled
 * RTDB sync, and canvas rendering with a camera that follows the player's
 * own head. Everything hot (position, trails) lives in refs, not React
 * state -- HUD-relevant values (score/leaderboard/alive) are pushed to
 * state on a ~250ms throttle so the surrounding UI doesn't re-render at
 * frame rate.
 */
export function useSnakeEngine({
  roomId,
  personId,
  personName,
  personPhotoUrl,
  isHost,
  people,
  canvasRef,
}: {
  roomId: string;
  personId: string;
  personName: string;
  personPhotoUrl: string;
  isHost: boolean;
  people: Person[];
  canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  const [alive, setAlive] = useState(true);
  const [respawnRemainingMs, setRespawnRemainingMs] = useState(0);
  const [score, setScore] = useState(SNAKE_START_SCORE);
  const [leaderboard, setLeaderboard] = useState<SnakeLeaderboardEntry[]>([]);

  const localRef = useRef<SimSnake>(spawnSnake(personId, { isBot: false, personId, name: personName }));
  const botsRef = useRef<Map<string, SimSnake>>(new Map());
  const remoteSnakesRef = useRef<Record<string, SnakeEntity>>({});
  const remoteOrbsRef = useRef<Record<string, Orb>>({});
  const pendingOrbClaims = useRef<Set<string>>(new Set());
  const pointerRef = useRef<{ active: boolean; dx: number; dy: number }>({ active: false, dx: 0, dy: 0 });
  const isHostRef = useRef(isHost);
  const peopleByIdRef = useRef<Map<string, Person>>(new Map());
  const lastBotMaintenanceAt = useRef(0);
  const rafRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    peopleByIdRef.current = new Map(people.map((p) => [p.id, p]));
  }, [people]);

  useEffect(() => {
    unmountedRef.current = false;
    localRef.current = spawnSnake(personId, { isBot: false, personId, name: personName });
    botsRef.current = new Map();

    void writeSnakeNode(roomId, personId, toEntity(localRef.current));
    registerSnakeDisconnectCleanup(roomId, personId);
    void seedInitialOrbsIfNeeded(roomId);

    const unsubSnakes = listenSnakes(roomId, (snakes) => {
      remoteSnakesRef.current = snakes;
    });
    const unsubOrbs = listenOrbs(roomId, (orbs) => {
      remoteOrbsRef.current = orbs;
    });

    function buildWorldView(): Record<string, { x: number; y: number; heading: number; trail: Point[] }> {
      const view: Record<string, { x: number; y: number; heading: number; trail: Point[] }> = {};
      for (const [id, s] of Object.entries(remoteSnakesRef.current)) {
        if (id === personId || botsRef.current.has(id)) continue;
        if (!s.alive) continue;
        view[id] = s;
      }
      for (const bot of botsRef.current.values()) {
        if (bot.alive) view[bot.id] = bot;
      }
      if (localRef.current.alive) view[personId] = localRef.current;
      return view;
    }

    function flattenHazards(
      worldView: Record<string, { trail: Point[] }>,
      excludeId: string,
    ): Point[] {
      const points: Point[] = [];
      for (const [id, s] of Object.entries(worldView)) {
        if (id === excludeId) continue;
        for (const p of s.trail) points.push(p);
      }
      return points;
    }

    function handleDeath(entity: SimSnake, now: number) {
      entity.alive = false;
      entity.diedAt = now;
      const drops: Orb[] = Array.from({ length: SNAKE_DEATH_ORB_COUNT }, () => ({
        x: entity.x + (Math.random() - 0.5) * SNAKE_DEATH_ORB_SPREAD * 2,
        y: entity.y + (Math.random() - 0.5) * SNAKE_DEATH_ORB_SPREAD * 2,
        value: 1,
        color: entity.color,
      }));
      void addOrbs(roomId, drops);
    }

    function checkOrbConsumption(entity: SimSnake) {
      for (const [orbId, orb] of Object.entries(remoteOrbsRef.current)) {
        if (pendingOrbClaims.current.has(orbId)) continue;
        if (Math.hypot(orb.x - entity.x, orb.y - entity.y) >= SNAKE_EAT_RADIUS) continue;

        pendingOrbClaims.current.add(orbId);
        void claimOrb(roomId, orbId).then((won) => {
          pendingOrbClaims.current.delete(orbId);
          if (!won || unmountedRef.current) return;
          entity.score += orb.value;
          void addOrbs(roomId, [
            { ...randomArenaPoint(SNAKE_ORB_RADIUS * 2), value: 1, color: pickRandom(SNAKE_ORB_COLORS) },
          ]);
        });
        break;
      }
    }

    function applyBoostShrink(entity: SimSnake, now: number) {
      if (!entity.boosting || entity.score <= SNAKE_BOOST_MIN_SCORE) return;
      if (now - entity.lastBoostDropAt < SNAKE_BOOST_DROP_INTERVAL_MS) return;
      entity.lastBoostDropAt = now;
      entity.score -= SNAKE_BOOST_DROP_COST;
      const tail = entity.trail[0] ?? { x: entity.x, y: entity.y };
      void addOrbs(roomId, [{ x: tail.x, y: tail.y, value: SNAKE_BOOST_DROP_COST, color: entity.color }]);
    }

    function maintainBotCount(now: number) {
      if (!isHostRef.current) return;
      if (now - lastBotMaintenanceAt.current < 1000) return;
      lastBotMaintenanceAt.current = now;

      const humanCount = Math.max(
        1,
        Object.values(remoteSnakesRef.current).filter((s) => !s.isBot).length,
      );
      const needed = Math.max(0, SNAKE_BOT_TARGET_COUNT - humanCount);
      const currentIds = Array.from(botsRef.current.keys());

      if (currentIds.length < needed) {
        for (let i = currentIds.length; i < needed; i++) {
          const id = `bot-${Math.random().toString(36).slice(2, 8)}`;
          const bot = spawnSnake(id, { isBot: true, personId: null, name: BOT_NAMES[i % BOT_NAMES.length] });
          botsRef.current.set(id, bot);
          void writeSnakeNode(roomId, id, toEntity(bot));
        }
      } else if (currentIds.length > needed) {
        for (let i = 0; i < currentIds.length - needed; i++) {
          const id = currentIds[i];
          botsRef.current.delete(id);
          void removeSnakeNode(roomId, id);
        }
      }
    }

    function updateHudState(now: number) {
      const entries = new Map<string, SnakeLeaderboardEntry>();
      for (const [id, s] of Object.entries(remoteSnakesRef.current)) {
        if (botsRef.current.has(id)) continue;
        entries.set(id, { id, name: s.name, score: s.score, isBot: s.isBot, isSelf: id === personId });
      }
      for (const bot of botsRef.current.values()) {
        entries.set(bot.id, { id: bot.id, name: bot.name, score: bot.score, isBot: true, isSelf: false });
      }
      entries.set(personId, {
        id: personId,
        name: personName,
        score: localRef.current.score,
        isBot: false,
        isSelf: true,
      });

      setLeaderboard(
        Array.from(entries.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, SNAKE_LEADERBOARD_SIZE),
      );
      setScore(localRef.current.score);
      setAlive(localRef.current.alive);
      setRespawnRemainingMs(
        localRef.current.diedAt !== null
          ? Math.max(0, SNAKE_RESPAWN_DELAY_MS - (now - localRef.current.diedAt))
          : 0,
      );
    }

    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth || 1;
      const cssH = canvas.clientHeight || 1;
      const targetW = Math.round(cssW * dpr);
      const targetH = Math.round(cssH * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const scale = cssW / SNAKE_VIEWPORT_SIZE;
      const camera = localRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#241c16";
      ctx.fillRect(0, 0, cssW, cssH);

      ctx.save();
      ctx.translate(cssW / 2, cssH / 2);
      ctx.scale(scale, scale);
      ctx.translate(-camera.x, -camera.y);

      ctx.fillStyle = "#fbf3e7";
      ctx.fillRect(0, 0, SNAKE_ARENA_SIZE, SNAKE_ARENA_SIZE);
      ctx.strokeStyle = "rgba(36,28,22,0.4)";
      ctx.lineWidth = 2;
      for (let gx = 0; gx <= SNAKE_ARENA_SIZE; gx += 60) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, SNAKE_ARENA_SIZE);
        ctx.stroke();
      }
      for (let gy = 0; gy <= SNAKE_ARENA_SIZE; gy += 60) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(SNAKE_ARENA_SIZE, gy);
        ctx.stroke();
      }
      ctx.strokeStyle = "#241c16";
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, SNAKE_ARENA_SIZE - 6, SNAKE_ARENA_SIZE - 6);

      for (const orb of Object.values(remoteOrbsRef.current)) {
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, SNAKE_ORB_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = orb.color;
        ctx.fill();
      }

      const worldView = buildWorldView();
      for (const [id, s] of Object.entries(worldView)) {
        ctx.fillStyle =
          id === personId
            ? localRef.current.color
            : (botsRef.current.get(id)?.color ?? remoteSnakesRef.current[id]?.color ?? "#EA5A32");
        for (const p of s.trail) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, SNAKE_BODY_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (const [id, s] of Object.entries(worldView)) {
        if (id === personId) {
          drawPlayerFace(ctx, personPhotoUrl, s.x, s.y, SNAKE_HEAD_RADIUS, localRef.current.color);
        } else if (botsRef.current.has(id)) {
          const bot = botsRef.current.get(id)!;
          drawBotFace(ctx, s.x, s.y, SNAKE_HEAD_RADIUS, bot.color, s.heading);
        } else {
          const person = peopleByIdRef.current.get(id);
          const color = remoteSnakesRef.current[id]?.color ?? "#EA5A32";
          if (person) drawPlayerFace(ctx, person.photoUrl, s.x, s.y, SNAKE_HEAD_RADIUS, color);
          else drawBotFace(ctx, s.x, s.y, SNAKE_HEAD_RADIUS, color, s.heading);
        }
      }

      ctx.restore();
    }

    let lastFrameTime = performance.now();
    let lastSyncAt = 0;
    let lastHudAt = 0;

    function tick(now: number) {
      if (unmountedRef.current) return;
      const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      const local = localRef.current;
      if (local.alive) {
        if (pointerRef.current.active) {
          const targetHeading = Math.atan2(pointerRef.current.dy, pointerRef.current.dx);
          local.heading = clampAngleTurn(local.heading, targetHeading, SNAKE_TURN_RATE * dt);
        }
        moveForward(local, dt);

        const worldView = buildWorldView();
        const hazards = flattenHazards(worldView, personId);
        if (isOutOfBounds(local) || collidesWithHazards(local, hazards)) {
          handleDeath(local, now);
        } else {
          checkOrbConsumption(local);
          applyBoostShrink(local, now);
        }
      } else if (local.diedAt !== null && now - local.diedAt >= SNAKE_RESPAWN_DELAY_MS) {
        respawnSnake(local);
      }

      if (isHostRef.current) {
        maintainBotCount(now);
        const orbList = Object.values(remoteOrbsRef.current);
        for (const bot of botsRef.current.values()) {
          if (bot.alive) {
            const worldView = buildWorldView();
            const hazards = flattenHazards(worldView, bot.id);
            const targetHeading = computeBotTargetHeading(bot, bot.ai!, orbList, hazards, now);
            bot.heading = clampAngleTurn(bot.heading, targetHeading, SNAKE_TURN_RATE * dt * 0.8);
            moveForward(bot, dt);
            if (isOutOfBounds(bot) || collidesWithHazards(bot, hazards)) {
              handleDeath(bot, now);
            } else {
              checkOrbConsumption(bot);
            }
          } else if (bot.diedAt !== null && now - bot.diedAt >= SNAKE_RESPAWN_DELAY_MS) {
            respawnSnake(bot);
          }
        }
      }

      if (now - lastSyncAt >= SNAKE_SYNC_INTERVAL_MS) {
        lastSyncAt = now;
        void writeSnakeNode(roomId, personId, toEntity(localRef.current));
        if (isHostRef.current) {
          for (const bot of botsRef.current.values()) void writeSnakeNode(roomId, bot.id, toEntity(bot));
        }
      }

      if (now - lastHudAt >= 250) {
        lastHudAt = now;
        updateHudState(now);
      }

      draw();
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      unmountedRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      unsubSnakes();
      unsubOrbs();
      void removeSnakeNode(roomId, personId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed only on roomId/personId; isHost/people/name/photo are read live via refs (see effects above) so a prop change never re-joins the match mid-run.
  }, [roomId, personId]);

  const setPointerFromClient = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    pointerRef.current.dx = clientX - rect.left - rect.width / 2;
    pointerRef.current.dy = clientY - rect.top - rect.height / 2;
  };

  const pointerHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => {
      pointerRef.current.active = true;
      setPointerFromClient(e.currentTarget, e.clientX, e.clientY);
    },
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!pointerRef.current.active) return;
      setPointerFromClient(e.currentTarget, e.clientX, e.clientY);
    },
    onPointerUp: () => {
      pointerRef.current.active = false;
    },
    onPointerCancel: () => {
      pointerRef.current.active = false;
    },
  };

  const setBoosting = (boosting: boolean) => {
    localRef.current.boosting = boosting;
  };

  return { alive, respawnRemainingMs, score, leaderboard, pointerHandlers, setBoosting };
}
