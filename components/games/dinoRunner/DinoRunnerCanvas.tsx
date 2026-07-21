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
  const jumpButtonRef = useRef<HTMLButtonElement>(null);
  const duckButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const jumpButtonEl = jumpButtonRef.current;
    const duckButtonEl = duckButtonRef.current;
    if (!canvasEl || !jumpButtonEl || !duckButtonEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;
    // Rebind to plain, non-nullable locals: TS narrowing from the guards
    // above doesn't survive into the closures below (event handlers), but a
    // fresh const with an inferred non-nullable type does.
    const jumpButton: HTMLButtonElement = jumpButtonEl;
    const duckButton: HTMLButtonElement = duckButtonEl;
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

    // Real <button> overlays rather than raw canvas pointer-position math --
    // this is what actually gets touch-action/user-select/tap-highlight
    // right on mobile instead of fighting the browser's own gesture
    // handling. preventDefault on pointerdown keeps them from taking focus,
    // which matters because a focused button re-fires on every subsequent
    // Space *keyup* (see handleKeyUp below) -- without this a tapped button
    // would reappear as an accidental "click" the next time Space is hit.
    function handleJumpPointerDown(e: PointerEvent) {
      e.preventDefault();
      if (gameOver) return;
      jump();
    }
    function handleDuckPointerDown(e: PointerEvent) {
      e.preventDefault();
      if (gameOver) return;
      isDucking = true;
      activeDuckPointerId = e.pointerId;
      duckButton.setPointerCapture(e.pointerId);
    }
    function handleDuckPointerUp(e: PointerEvent) {
      if (e.pointerId === activeDuckPointerId) {
        isDucking = false;
        activeDuckPointerId = null;
      }
    }
    function handleDuckPointerCancel(e: PointerEvent) {
      if (e.pointerId === activeDuckPointerId) {
        isDucking = false;
        activeDuckPointerId = null;
      }
    }
    jumpButton.addEventListener("pointerdown", handleJumpPointerDown);
    duckButton.addEventListener("pointerdown", handleDuckPointerDown);
    duckButton.addEventListener("pointerup", handleDuckPointerUp);
    duckButton.addEventListener("pointercancel", handleDuckPointerCancel);

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
      // preventDefault here too, not just keydown -- browsers activate a
      // focused button's click on Space's keyUP, and something (e.g. the
      // play/leaderboard toggle) is basically always focused from before
      // the run started. Without this, every jump press also re-clicks
      // whatever's focused.
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        isDucking = false;
      }
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
      jumpButton.removeEventListener("pointerdown", handleJumpPointerDown);
      duckButton.removeEventListener("pointerdown", handleDuckPointerDown);
      duckButton.removeEventListener("pointerup", handleDuckPointerUp);
      duckButton.removeEventListener("pointercancel", handleDuckPointerCancel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [personImages, activePersonId, otherPersonIds, onScoreChange, onGameOver]);

  return (
    <div className="dino-canvas-wrap">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="dino-canvas touch-none rounded-card-sm border-2 border-ink bg-cream shadow-card"
      />
      <button
        ref={jumpButtonRef}
        type="button"
        aria-label="Jump"
        tabIndex={-1}
        className="dino-control-btn left-0 w-1/2 cursor-pointer appearance-none border-0 bg-transparent p-0"
      >
        <span className="absolute bottom-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/25 text-sm text-card">
          ⬆
        </span>
      </button>
      <button
        ref={duckButtonRef}
        type="button"
        aria-label="Duck"
        tabIndex={-1}
        className="dino-control-btn right-0 w-1/2 cursor-pointer appearance-none border-0 bg-transparent p-0"
      >
        <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/25 text-sm text-card">
          ⬇
        </span>
      </button>
    </div>
  );
}
