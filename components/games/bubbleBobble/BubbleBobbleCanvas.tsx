"use client";

import { useEffect, useRef } from "react";
import {
  createPopEffect,
  drawBackground,
  drawEmptyBubble,
  drawEnemy,
  drawPlatform,
  drawPlayer,
  drawPopEffect,
  drawTrappedBubble,
  enemyFaceCanvas,
  loadImage,
  trappedBubbleFaceCanvas,
  walkBobOffset,
} from "./bubbleBobbleArt";
import type { PlayerPose, PopEffect } from "./bubbleBobbleArt";
import {
  BUBBLE_COOLDOWN_MS,
  BUBBLE_FLOAT_SPEED,
  BUBBLE_LIFETIME_MS,
  BUBBLE_RADIUS,
  BUBBLE_SHOOT_SPEED,
  BUBBLE_TRAVEL_DISTANCE,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  ENEMY_HALF_HEIGHT,
  ENEMY_HALF_WIDTH,
  ENEMY_HOP_VELOCITY,
  ENEMY_MOVE_SPEED,
  GRAVITY,
  JUMP_VELOCITY,
  MOVE_SPEED,
  PLAYER_HALF_HEIGHT,
  PLAYER_HALF_WIDTH,
  POP_SCORE,
  TRAPPED_BUBBLE_BOB_HZ,
  TRAPPED_BUBBLE_BOB_PX,
  TRAPPED_BUBBLE_LIFETIME_MS,
  TRAP_SCORE,
  boxAt,
  boxesOverlap,
  circlesOverlap,
  randomEnemyType,
  randomHopIntervalMs,
  wrapX,
} from "./bubbleBobbleConfig";
import type { EnemyType } from "./bubbleBobbleConfig";
import {
  BUBBLE_BOBBLE_LEVEL_COUNT,
  computeEnemySpawnPoints,
  levelForIndex,
} from "./bubbleBobbleLevels";
import type { LevelDef, Platform } from "./bubbleBobbleLevels";

interface Enemy {
  id: number;
  type: EnemyType;
  personId: string;
  x: number;
  y: number; // foot position
  vx: number;
  vy: number;
  facingRight: boolean;
  platform: Platform | null;
  nextHopAt: number;
}

interface FlyingBubble {
  id: number;
  x: number;
  y: number;
  dir: 1 | -1;
  phase: "traveling" | "floating";
  traveled: number;
  createdAt: number;
}

interface TrappedBubble {
  id: number;
  x: number;
  y: number;
  type: EnemyType;
  personId: string;
  createdAt: number;
}

/** Extra enemies added per completed loop through all 10 hand-built levels, so the replay stays escalating rather than static. */
const ENEMY_COUNT_LOOP_BONUS = 2;
const LEVEL_CLEAR_BANNER_MS = 1400;

export function BubbleBobbleCanvas({
  personImages,
  otherPersonIds,
  onScoreChange,
  onLevelChange,
  onLevelCleared,
  onGameOver,
}: {
  /** Preloaded photo images keyed by personId -- must already be loaded/settled before mount. */
  personImages: Map<string, HTMLImageElement>;
  /** Non-empty pool of personIds to randomly assign to spawned enemies (excludes the active player). */
  otherPersonIds: string[];
  onScoreChange: (score: number) => void;
  onLevelChange: (levelNumber: number, loop: number) => void;
  onLevelCleared: (clearedLevelNumber: number, isWin: boolean) => void;
  onGameOver: (finalScore: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const blowButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const joystickBaseEl = joystickBaseRef.current;
    const joystickKnobEl = joystickKnobRef.current;
    const blowEl = blowButtonRef.current;
    if (!canvasEl || !joystickBaseEl || !joystickKnobEl || !blowEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;
    const joystickBase: HTMLDivElement = joystickBaseEl;
    const joystickKnob: HTMLDivElement = joystickKnobEl;
    const blowButton: HTMLButtonElement = blowEl;

    let rafId = 0;
    let lastTime = performance.now();
    let gameOver = false;
    let score = 0;

    let levelIndex = 0;
    let level: LevelDef = levelForIndex(0).def;
    let levelClearing = false;
    let levelClearAt = 0;

    let nextEnemyId = 0;
    let nextBubbleId = 0;
    let enemies: Enemy[] = [];
    let flyingBubbles: FlyingBubble[] = [];
    let trappedBubbles: TrappedBubble[] = [];
    const popEffects: PopEffect[] = [];

    // Player state
    let px = CANVAS_WIDTH / 2;
    let py = 0;
    let pvy = 0;
    let pGrounded = true;
    let pFacingRight = true;
    let blowingUntil = 0;
    let lastBlowAt = -Infinity;

    let movingLeft = false;
    let movingRight = false;

    function pickPersonId(): string {
      return otherPersonIds[Math.floor(Math.random() * otherPersonIds.length)];
    }

    function loadLevel(index: number, now: number) {
      const { def, loop } = levelForIndex(index);
      level = def;
      levelIndex = index;
      const enemyCount = def.enemyCount + loop * ENEMY_COUNT_LOOP_BONUS;
      const spawnPoints = computeEnemySpawnPoints({ ...def, enemyCount });

      enemies = spawnPoints.map((pt, i) => ({
        id: nextEnemyId++,
        type: randomEnemyType(),
        personId: pickPersonId(),
        x: pt.x,
        y: pt.y,
        vx: (i % 2 === 0 ? 1 : -1) * ENEMY_MOVE_SPEED,
        vy: 0,
        facingRight: i % 2 === 0,
        platform: null,
        nextHopAt: now + randomHopIntervalMs(),
      }));
      flyingBubbles = [];
      trappedBubbles = [];

      px = def.playerSpawn.x;
      py = def.playerSpawn.y;
      pvy = 0;
      pGrounded = true;

      onLevelChange((index % BUBBLE_BOBBLE_LEVEL_COUNT) + 1, loop);
    }

    loadLevel(0, lastTime);

    // ---------------------------------------------------------------
    // Input
    // ---------------------------------------------------------------

    function jump() {
      if (gameOver || levelClearing || !pGrounded) return;
      pvy = JUMP_VELOCITY;
      pGrounded = false;
    }

    function blow(now: number) {
      if (gameOver || levelClearing) return;
      if (now - lastBlowAt < BUBBLE_COOLDOWN_MS) return;
      lastBlowAt = now;
      blowingUntil = now + 220;
      flyingBubbles.push({
        id: nextBubbleId++,
        x: px + (pFacingRight ? 1 : -1) * (PLAYER_HALF_WIDTH + 4),
        y: py - PLAYER_HALF_HEIGHT * 1.3,
        dir: pFacingRight ? 1 : -1,
        phase: "traveling",
        traveled: 0,
        createdAt: now,
      });
    }

    // Virtual joystick -- one thumb-friendly control standing in for the
    // old separate left/right/jump buttons (three tiny targets were hard to
    // hit reliably on mobile). Horizontal drag past a deadzone drives
    // movingLeft/movingRight continuously, same as the old hold-to-move
    // buttons; dragging up past a bigger threshold triggers a single jump,
    // edge-detected (jumpArmed) so holding the stick up doesn't spam jumps
    // every frame -- it re-arms once the stick drops back near neutral.
    const JOYSTICK_MAX_RADIUS = 38;
    const JOYSTICK_MOVE_DEADZONE = 14;
    const JOYSTICK_JUMP_THRESHOLD = 26;
    const JOYSTICK_JUMP_REARM_THRESHOLD = 12;
    let joystickPointerId: number | null = null;
    let joystickCenterX = 0;
    let joystickCenterY = 0;
    let jumpArmed = true;

    function setJoystickKnob(dx: number, dy: number) {
      joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
    function resetJoystick() {
      movingLeft = false;
      movingRight = false;
      jumpArmed = true;
      joystickPointerId = null;
      setJoystickKnob(0, 0);
    }
    function updateJoystick(clientX: number, clientY: number) {
      let dx = clientX - joystickCenterX;
      let dy = clientY - joystickCenterY;
      const dist = Math.hypot(dx, dy);
      if (dist > JOYSTICK_MAX_RADIUS) {
        const scale = JOYSTICK_MAX_RADIUS / dist;
        dx *= scale;
        dy *= scale;
      }
      setJoystickKnob(dx, dy);
      movingLeft = dx < -JOYSTICK_MOVE_DEADZONE;
      movingRight = dx > JOYSTICK_MOVE_DEADZONE;
      if (dy < -JOYSTICK_JUMP_THRESHOLD) {
        if (jumpArmed) {
          jump();
          jumpArmed = false;
        }
      } else if (dy > -JOYSTICK_JUMP_REARM_THRESHOLD) {
        jumpArmed = true;
      }
    }
    function handleJoystickDown(e: PointerEvent) {
      e.preventDefault();
      const rect = joystickBase.getBoundingClientRect();
      joystickCenterX = rect.left + rect.width / 2;
      joystickCenterY = rect.top + rect.height / 2;
      joystickPointerId = e.pointerId;
      joystickBase.setPointerCapture(e.pointerId);
      updateJoystick(e.clientX, e.clientY);
    }
    function handleJoystickMove(e: PointerEvent) {
      if (e.pointerId !== joystickPointerId) return;
      updateJoystick(e.clientX, e.clientY);
    }
    function handleJoystickUp(e: PointerEvent) {
      if (e.pointerId !== joystickPointerId) return;
      resetJoystick();
    }
    function handleBlowDown(e: PointerEvent) {
      e.preventDefault();
      blow(performance.now());
    }
    joystickBase.addEventListener("pointerdown", handleJoystickDown);
    joystickBase.addEventListener("pointermove", handleJoystickMove);
    joystickBase.addEventListener("pointerup", handleJoystickUp);
    joystickBase.addEventListener("pointercancel", handleJoystickUp);
    blowButton.addEventListener("pointerdown", handleBlowDown);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        movingLeft = true;
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        movingRight = true;
      } else if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        if (!e.repeat) jump();
      } else if (e.code === "KeyX" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
        e.preventDefault();
        if (!e.repeat) blow(performance.now());
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === "ArrowLeft" || e.code === "KeyA") movingLeft = false;
      else if (e.code === "ArrowRight" || e.code === "KeyD") movingRight = false;
      else if (e.code === "Space" || e.code === "ArrowUp") e.preventDefault();
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // ---------------------------------------------------------------
    // Physics helpers
    // ---------------------------------------------------------------

    /** One-way platform landing: only snaps when falling onto a platform's top surface from above this frame. */
    function resolveGrounding(
      x: number,
      halfW: number,
      prevFootY: number,
      footY: number,
      vy: number,
      platforms: Platform[],
    ): { footY: number; vy: number; grounded: boolean; platform: Platform | null } {
      if (vy < 0) return { footY, vy, grounded: false, platform: null };
      for (const platform of platforms) {
        if (x + halfW <= platform.x || x - halfW >= platform.x + platform.width) continue;
        if (prevFootY <= platform.y + 0.5 && footY >= platform.y) {
          return { footY: platform.y, vy: 0, grounded: true, platform };
        }
      }
      return { footY, vy, grounded: false, platform: null };
    }

    // ---------------------------------------------------------------
    // Update
    // ---------------------------------------------------------------

    function updatePlayer(dt: number) {
      const vx = movingRight && !movingLeft ? MOVE_SPEED : movingLeft && !movingRight ? -MOVE_SPEED : 0;
      if (vx !== 0) pFacingRight = vx > 0;
      px = wrapX(px + vx * dt, PLAYER_HALF_WIDTH);

      const prevFootY = py;
      pvy += GRAVITY * dt;
      const nextFootY = py + pvy * dt;
      const resolved = resolveGrounding(px, PLAYER_HALF_WIDTH, prevFootY, nextFootY, pvy, level.platforms);
      py = resolved.footY;
      pvy = resolved.vy;
      pGrounded = resolved.grounded;
    }

    function updateEnemy(enemy: Enemy, dt: number, now: number) {
      // Turn around before walking off the platform it was standing on last frame.
      if (enemy.platform) {
        const nextX = enemy.x + Math.sign(enemy.vx) * ENEMY_HALF_WIDTH;
        if (nextX < enemy.platform.x || nextX > enemy.platform.x + enemy.platform.width) {
          enemy.vx = -enemy.vx;
        }
      }
      enemy.facingRight = enemy.vx >= 0;
      enemy.x = wrapX(enemy.x + enemy.vx * dt, ENEMY_HALF_WIDTH);

      if (now >= enemy.nextHopAt) {
        enemy.nextHopAt = now + randomHopIntervalMs();
        if (enemy.platform) {
          enemy.vy = ENEMY_HOP_VELOCITY;
          enemy.platform = null;
          if (Math.random() < 0.4) enemy.vx = -enemy.vx;
        }
      }

      const prevFootY = enemy.y;
      enemy.vy += GRAVITY * dt;
      const nextFootY = enemy.y + enemy.vy * dt;
      const resolved = resolveGrounding(enemy.x, ENEMY_HALF_WIDTH, prevFootY, nextFootY, enemy.vy, level.platforms);
      enemy.y = resolved.footY;
      enemy.vy = resolved.vy;
      enemy.platform = resolved.platform;
    }

    function trapEnemy(enemy: Enemy, now: number) {
      enemies = enemies.filter((e) => e.id !== enemy.id);
      trappedBubbles.push({
        id: nextBubbleId++,
        x: enemy.x,
        y: enemy.y - ENEMY_HALF_HEIGHT,
        type: enemy.type,
        personId: enemy.personId,
        createdAt: now,
      });
      score += TRAP_SCORE;
      onScoreChange(score);
    }

    function releaseEnemy(bubble: TrappedBubble, now: number) {
      trappedBubbles = trappedBubbles.filter((b) => b.id !== bubble.id);
      enemies.push({
        id: nextEnemyId++,
        type: bubble.type,
        personId: bubble.personId,
        x: bubble.x,
        y: bubble.y,
        vx: (Math.random() < 0.5 ? 1 : -1) * ENEMY_MOVE_SPEED,
        vy: 0,
        facingRight: true,
        platform: null,
        nextHopAt: now + randomHopIntervalMs(),
      });
    }

    function popBubble(bubble: TrappedBubble, now: number) {
      trappedBubbles = trappedBubbles.filter((b) => b.id !== bubble.id);
      score += POP_SCORE;
      onScoreChange(score);
      const photoImg = personImages.get(bubble.personId);
      const face = photoImg ? enemyFaceCanvas(bubble.type, bubble.personId, photoImg) : null;
      popEffects.push(createPopEffect(bubble.x, bubble.y, now, bubble.type, face));
      maybeClearLevel(now);
    }

    function maybeClearLevel(now: number) {
      if (enemies.length === 0 && trappedBubbles.length === 0 && !levelClearing) {
        levelClearing = true;
        levelClearAt = now;
        const clearedDisplayNumber = (levelIndex % BUBBLE_BOBBLE_LEVEL_COUNT) + 1;
        const isWin = clearedDisplayNumber === BUBBLE_BOBBLE_LEVEL_COUNT;
        onLevelCleared(clearedDisplayNumber, isWin);
      }
    }

    function update(dt: number, now: number) {
      updatePlayer(dt);

      for (const enemy of enemies) updateEnemy(enemy, dt, now);

      // Flying (empty) bubbles: travel forward, then float, then expire.
      flyingBubbles = flyingBubbles.filter((b) => {
        if (now - b.createdAt > BUBBLE_LIFETIME_MS) return false;
        if (b.phase === "traveling") {
          const step = BUBBLE_SHOOT_SPEED * dt;
          b.x = wrapX(b.x + b.dir * step, BUBBLE_RADIUS);
          b.traveled += step;
          if (b.traveled >= BUBBLE_TRAVEL_DISTANCE) b.phase = "floating";
        } else {
          b.y -= BUBBLE_FLOAT_SPEED * dt;
          if (b.y < -40) return false;
        }
        return true;
      });

      // Bubble vs enemy -- catches the first alive enemy it overlaps.
      for (const bubble of flyingBubbles) {
        const hit = enemies.find((e) =>
          circlesOverlap(bubble.x, bubble.y, BUBBLE_RADIUS, e.x, e.y - ENEMY_HALF_HEIGHT, ENEMY_HALF_WIDTH),
        );
        if (hit) {
          flyingBubbles = flyingBubbles.filter((b) => b.id !== bubble.id);
          trapEnemy(hit, now);
        }
      }

      // Trapped bubbles: gentle bob, release on timeout, pop on player touch.
      for (const bubble of trappedBubbles) {
        if (now - bubble.createdAt > TRAPPED_BUBBLE_LIFETIME_MS) {
          releaseEnemy(bubble, now);
          continue;
        }
        const bobY = bubble.y + Math.sin(now / 1000 * TRAPPED_BUBBLE_BOB_HZ * Math.PI * 2) * TRAPPED_BUBBLE_BOB_PX;
        const playerBox = boxAt(px, py - PLAYER_HALF_HEIGHT, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT);
        const bubbleBox = boxAt(bubble.x, bobY, BUBBLE_RADIUS, BUBBLE_RADIUS);
        if (boxesOverlap(playerBox, bubbleBox)) {
          popBubble(bubble, now);
        }
      }

      // Player vs any still-loose enemy -- single hit ends the run.
      if (!gameOver && !levelClearing) {
        const playerBox = boxAt(px, py - PLAYER_HALF_HEIGHT, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT);
        for (const enemy of enemies) {
          const enemyBox = boxAt(enemy.x, enemy.y - ENEMY_HALF_HEIGHT, ENEMY_HALF_WIDTH, ENEMY_HALF_HEIGHT);
          if (boxesOverlap(playerBox, enemyBox)) {
            gameOver = true;
            onGameOver(score);
            break;
          }
        }
      }

      if (levelClearing && now - levelClearAt >= LEVEL_CLEAR_BANNER_MS) {
        levelClearing = false;
        loadLevel(levelIndex + 1, now);
      }
    }

    // ---------------------------------------------------------------
    // Draw
    // ---------------------------------------------------------------

    function draw(now: number) {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawBackground(ctx, level.background, CANVAS_WIDTH, CANVAS_HEIGHT);
      for (const platform of level.platforms) drawPlatform(ctx, platform);

      for (const bubble of trappedBubbles) {
        const bobY = bubble.y + Math.sin(now / 1000 * TRAPPED_BUBBLE_BOB_HZ * Math.PI * 2) * TRAPPED_BUBBLE_BOB_PX;
        const photoImg = personImages.get(bubble.personId);
        const face = photoImg ? trappedBubbleFaceCanvas(bubble.personId, photoImg) : null;
        drawTrappedBubble(ctx, face, bubble.x, bobY);
      }

      for (const enemy of enemies) {
        const photoImg = personImages.get(enemy.personId);
        const face = photoImg ? enemyFaceCanvas(enemy.type, enemy.personId, photoImg) : null;
        const moving = enemy.platform !== null && enemy.vx !== 0;
        drawEnemy(ctx, enemy.type, face, enemy.x, enemy.y, enemy.facingRight, walkBobOffset(now, moving));
      }

      const pMoving = pGrounded && (movingLeft || movingRight);
      const pose: PlayerPose = now < blowingUntil ? "blow" : !pGrounded ? "jump" : "idle";
      const bob = pose === "idle" ? walkBobOffset(now, pMoving) : 0;
      drawPlayer(ctx, pMoving && pose === "idle" ? "walk" : pose, px, py + bob, pFacingRight);

      for (const bubble of flyingBubbles) drawEmptyBubble(ctx, bubble.x, bubble.y);

      for (let i = popEffects.length - 1; i >= 0; i--) {
        if (!drawPopEffect(ctx, popEffects[i], now)) popEffects.splice(i, 1);
      }
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
      joystickBase.removeEventListener("pointerdown", handleJoystickDown);
      joystickBase.removeEventListener("pointermove", handleJoystickMove);
      joystickBase.removeEventListener("pointerup", handleJoystickUp);
      joystickBase.removeEventListener("pointercancel", handleJoystickUp);
      blowButton.removeEventListener("pointerdown", handleBlowDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- imperative rAF loop reads these via closures set up once at mount, same pattern as DinoRunnerCanvas/SuikaCanvas.
  }, []);

  // Kick off image loads for every asset up front (idempotent -- loadImage caches by src).
  useEffect(() => {
    [
      "player-idle.png",
      "player-walk.png",
      "player-jump.png",
      "player-blow.png",
      "enemy-type1.png",
      "enemy-type2.png",
      "bubble-empty.png",
      "bubble-trapped.png",
      "platform-tile.png",
      "bg-cave.png",
      "bg-cave-crystal.png",
      "bg-cave-deep.png",
      "bg-cave-forest.png",
      "bg-cave-gold.png",
      "bg-cave-ice.png",
      "bg-cave-lava.png",
      "bg-cave-storm.png",
      "bg-cave-sunset.png",
      "bg-cave-swamp.png",
    ].forEach(loadImage);
  }, []);

  return (
    <div className="bbobble-canvas-wrap">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="bbobble-canvas touch-none rounded-card-sm border-2 border-ink bg-cream shadow-card"
      />
      <div
        ref={joystickBaseRef}
        role="presentation"
        aria-label="Move and jump"
        className="bbobble-joystick-base touch-none"
      >
        <span className="bbobble-joystick-hint">⬆</span>
        <div ref={joystickKnobRef} className="bbobble-joystick-knob" />
      </div>
      <button
        ref={blowButtonRef}
        type="button"
        aria-label="Blow bubble"
        tabIndex={-1}
        className="bbobble-control-btn bbobble-control-blow cursor-pointer appearance-none border-0 bg-transparent p-0"
      >
        <span className="bbobble-control-icon">🫧</span>
      </button>
    </div>
  );
}
