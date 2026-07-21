"use client";

import { useEffect, useRef } from "react";
import { drawGround, drawObstacle, drawPlayer, drawSky } from "./dinoRunnerArt";
import type { PlayerPose } from "./dinoRunnerArt";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GRAVITY,
  GROUND_Y,
  JUMP_VELOCITY,
  OBSTACLE_DEFS,
  PLAYER_X,
  SKY_ORDER,
  SKY_TRANSITION_MS,
  boxesOverlap,
  obstacleBox,
  playerBox,
  randomObstacleType,
  randomSpawnGap,
  scoreForDistance,
  skyIndexForScore,
  speedAtElapsed,
} from "./dinoRunnerConfig";
import type { ObstacleType } from "./dinoRunnerConfig";

interface Obstacle {
  id: number;
  type: ObstacleType;
  x: number;
  personId: string;
}

export function DinoRunnerCanvas({
  personImages,
  activePersonId,
  otherPersonIds,
  onScoreChange,
  onGameOver,
}: {
  /** Preloaded photo images keyed by personId -- must already be loaded/settled before mount. */
  personImages: Map<string, HTMLImageElement>;
  activePersonId: string;
  /** Non-empty pool of personIds to randomly assign to spawned obstacles. */
  otherPersonIds: string[];
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = context;

    let vy = 0;
    let footY = GROUND_Y;
    let isJumping = false;
    let isDucking = false;

    let elapsed = 0;
    let distance = 0;
    let score = 0;
    let groundScroll = 0;

    let obstacles: Obstacle[] = [];
    let nextObstacleId = 0;
    let distanceSinceSpawn = 0;
    let nextGap = randomSpawnGap();

    let currentSkyIndex = 0;
    let transitionFromIndex = 0;
    let transitionStart = -Infinity;

    let gameOver = false;
    let rafId = 0;
    let lastTime = performance.now();
    let activeDuckPointerId: number | null = null;

    function pickObstaclePersonId() {
      return otherPersonIds[Math.floor(Math.random() * otherPersonIds.length)];
    }

    function jump() {
      if (gameOver || isJumping || isDucking) return;
      isJumping = true;
      vy = JUMP_VELOCITY;
    }

    function yFromClientY(clientY: number) {
      const rect = canvas.getBoundingClientRect();
      const scaleY = CANVAS_HEIGHT / rect.height;
      return (clientY - rect.top) * scaleY;
    }

    function handlePointerDown(e: PointerEvent) {
      if (gameOver) return;
      const y = yFromClientY(e.clientY);
      if (y < CANVAS_HEIGHT / 2) {
        jump();
      } else {
        isDucking = true;
        activeDuckPointerId = e.pointerId;
        canvas.setPointerCapture(e.pointerId);
      }
    }
    function handlePointerUp(e: PointerEvent) {
      if (e.pointerId === activeDuckPointerId) {
        isDucking = false;
        activeDuckPointerId = null;
      }
    }
    function handlePointerCancel(e: PointerEvent) {
      if (e.pointerId === activeDuckPointerId) {
        isDucking = false;
        activeDuckPointerId = null;
      }
    }
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerCancel);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (!e.repeat) jump();
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        isDucking = true;
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === "ArrowDown") isDucking = false;
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    function update(dt: number, now: number) {
      elapsed += dt;
      const speed = speedAtElapsed(elapsed);
      distance += speed * dt;
      groundScroll += speed * dt;

      const newScore = scoreForDistance(distance);
      if (newScore !== score) {
        score = newScore;
        onScoreChange(score);
      }

      if (isJumping) {
        vy += GRAVITY * dt;
        footY += vy * dt;
        if (footY >= GROUND_Y) {
          footY = GROUND_Y;
          vy = 0;
          isJumping = false;
        }
      }

      const currentPose: PlayerPose = isJumping ? "jump" : isDucking ? "duck" : "run";

      distanceSinceSpawn += speed * dt;
      if (distanceSinceSpawn >= nextGap) {
        distanceSinceSpawn = 0;
        nextGap = randomSpawnGap();
        const type = randomObstacleType();
        obstacles.push({
          id: nextObstacleId++,
          type,
          x: CANVAS_WIDTH + OBSTACLE_DEFS[type].width,
          personId: pickObstaclePersonId(),
        });
      }

      for (const o of obstacles) o.x -= speed * dt;
      obstacles = obstacles.filter((o) => o.x + OBSTACLE_DEFS[o.type].width / 2 > -20);

      const pBox = playerBox(currentPose, footY);
      for (const o of obstacles) {
        const oBox = obstacleBox(o.x, OBSTACLE_DEFS[o.type]);
        if (boxesOverlap(pBox, oBox)) {
          gameOver = true;
          onGameOver(score);
          break;
        }
      }

      const skyIdx = skyIndexForScore(score);
      if (skyIdx !== currentSkyIndex && now - transitionStart >= SKY_TRANSITION_MS) {
        transitionFromIndex = currentSkyIndex;
        transitionStart = now;
        currentSkyIndex = skyIdx;
      }
    }

    function draw(now: number) {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const transitionElapsed = now - transitionStart;
      if (transitionElapsed < SKY_TRANSITION_MS) {
        const p = transitionElapsed / SKY_TRANSITION_MS;
        drawSky(ctx, SKY_ORDER[transitionFromIndex], 1 - p, GROUND_Y);
        drawSky(ctx, SKY_ORDER[currentSkyIndex], p, GROUND_Y);
      } else {
        drawSky(ctx, SKY_ORDER[currentSkyIndex], 1, GROUND_Y);
      }

      drawGround(ctx, groundScroll, GROUND_Y);

      for (const o of obstacles) {
        drawObstacle(ctx, o.type, o.x, personImages.get(o.personId) ?? null);
      }

      const pose: PlayerPose = isJumping ? "jump" : isDucking ? "duck" : "run";
      drawPlayer(ctx, pose, PLAYER_X, footY, personImages.get(activePersonId) ?? null);
    }

    function tick(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (!gameOver) update(dt, now);
      draw(now);

      if (!gameOver) rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [personImages, activePersonId, otherPersonIds, onScoreChange, onGameOver]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="dino-canvas touch-none rounded-card-sm border-2 border-ink bg-cream shadow-card"
    />
  );
}
