"use client";

import { useEffect, useRef } from "react";
import {
  BUBBLE_RADIUS,
  BUBBLE_TYPE_COUNT,
  CEILING_TOP_Y,
  DANGER_LINE_Y,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  FLOATING_BONUS_PER_BUBBLE,
  LAUNCHER_X,
  LAUNCHER_Y,
  SHOTS_PER_DROP,
  advanceShot,
  aimVelocity,
  bubbleFaceSrc,
  bubbleRingColor,
  cellKey,
  createInitialGrid,
  findConnectedGroup,
  findFloatingCells,
  insertRowAtTop,
  isGameOver,
  pixelX,
  pixelY,
  popScore,
  randomBubbleType,
  type Cell,
  type Vec,
} from "./bubbleShooterConfig";

type FlyingShot = { pos: Vec; vel: Vec; type: number };
type PopAnim = { row: number; col: number; type: number; startTime: number; kind: "pop" | "fall" };

const POP_DURATION_MS = 220;
const FALL_DURATION_MS = 450;
const MIN_DRAG_PX = 6;

export function BubbleShooterCanvas({
  onScoreChange,
  onNextTypeChange,
  onShotsUntilDropChange,
  onGameOver,
}: {
  onScoreChange: (score: number) => void;
  onNextTypeChange: (type: number) => void;
  onShotsUntilDropChange: (shotsLeft: number) => void;
  onGameOver: (finalScore: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;
    // Rebind to plain, non-nullable locals: TS narrowing from the guards
    // above doesn't survive into the closures below (rAF callbacks, event
    // handlers), but a fresh const with an inferred non-nullable type does.
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = context;

    const images = Array.from({ length: BUBBLE_TYPE_COUNT }, (_, i) => {
      const img = new window.Image();
      img.src = bubbleFaceSrc(i);
      return img;
    });

    let { grid, topRow } = createInitialGrid();
    let currentType = randomBubbleType();
    let nextType = randomBubbleType();
    let score = 0;
    let shotsFired = 0;
    let gameOver = false;
    let shot: FlyingShot | null = null;
    const popAnims: PopAnim[] = [];

    onNextTypeChange(nextType);
    onShotsUntilDropChange(SHOTS_PER_DROP - (shotsFired % SHOTS_PER_DROP));

    // Press-drag-release aiming: the launcher only rotates while held, and
    // fires on release. One event model for mouse and touch alike, per
    // pointer events, same as Suika's drop line.
    let isAiming = false;
    let aimDx = 0;
    let aimDy = -1;

    function fieldPointFromClient(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = FIELD_WIDTH / rect.width;
      const scaleY = FIELD_HEIGHT / rect.height;
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    }

    function handlePointerDown(e: PointerEvent) {
      if (gameOver || shot) return;
      isAiming = true;
      canvas.setPointerCapture(e.pointerId);
      const p = fieldPointFromClient(e.clientX, e.clientY);
      aimDx = p.x - LAUNCHER_X;
      aimDy = p.y - LAUNCHER_Y;
    }
    function handlePointerMove(e: PointerEvent) {
      if (!isAiming) return;
      const p = fieldPointFromClient(e.clientX, e.clientY);
      aimDx = p.x - LAUNCHER_X;
      aimDy = p.y - LAUNCHER_Y;
    }
    function handlePointerUp() {
      if (!isAiming) return;
      isAiming = false;
      if (gameOver || shot) return;
      const dragDist = Math.hypot(aimDx, aimDy);
      const vel = dragDist < MIN_DRAG_PX ? aimVelocity(0, -1) : aimVelocity(aimDx, aimDy);
      shot = { pos: { x: LAUNCHER_X, y: LAUNCHER_Y }, vel, type: currentType };
    }
    function handlePointerCancel() {
      isAiming = false;
    }
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerCancel);

    function resolveLanding(cell: Cell, type: number) {
      grid.set(cellKey(cell.row, cell.col), { type });
      shotsFired += 1;

      const group = findConnectedGroup(grid, cell.row, cell.col);
      let gained = 0;
      const now = performance.now();
      if (group.length >= 3) {
        for (const c of group) {
          grid.delete(cellKey(c.row, c.col));
          popAnims.push({ row: c.row, col: c.col, type, startTime: now, kind: "pop" });
        }
        gained += popScore(group.length);

        const floating = findFloatingCells(grid, topRow);
        for (const c of floating) {
          const bubble = grid.get(cellKey(c.row, c.col));
          grid.delete(cellKey(c.row, c.col));
          popAnims.push({
            row: c.row,
            col: c.col,
            type: bubble?.type ?? 0,
            startTime: now,
            kind: "fall",
          });
        }
        gained += floating.length * FLOATING_BONUS_PER_BUBBLE;
      }

      if (gained > 0) {
        score += gained;
        onScoreChange(score);
      }

      currentType = nextType;
      nextType = randomBubbleType();
      onNextTypeChange(nextType);

      if (shotsFired % SHOTS_PER_DROP === 0) {
        ({ grid, topRow } = insertRowAtTop(grid, topRow));
      }
      onShotsUntilDropChange(SHOTS_PER_DROP - (shotsFired % SHOTS_PER_DROP));

      if (isGameOver(grid, topRow)) {
        gameOver = true;
        onGameOver(score);
      }
    }

    function drawBubble(cx: number, cy: number, type: number, alpha: number, scale: number) {
      const r = BUBBLE_RADIUS * scale;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "#fffdf8";
      ctx.fill();
      const img = images[type];
      if (img.complete) {
        ctx.save();
        ctx.clip();
        ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
      }
      ctx.lineWidth = Math.max(3, r * 0.22);
      ctx.strokeStyle = bubbleRingColor(type);
      ctx.beginPath();
      ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(36,28,22,0.55)";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function draw(now: number) {
      ctx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

      ctx.save();
      ctx.strokeStyle = "rgba(36,28,22,0.25)";
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, CEILING_TOP_Y);
      ctx.lineTo(FIELD_WIDTH, CEILING_TOP_Y);
      ctx.stroke();
      ctx.strokeStyle = "rgba(234,90,50,0.55)";
      ctx.beginPath();
      ctx.moveTo(0, DANGER_LINE_Y);
      ctx.lineTo(FIELD_WIDTH, DANGER_LINE_Y);
      ctx.stroke();
      ctx.restore();

      for (const [key, bubble] of grid) {
        const [row, col] = key.split(",").map(Number);
        drawBubble(pixelX(row, col), pixelY(row, topRow), bubble.type, 1, 1);
      }

      for (let i = popAnims.length - 1; i >= 0; i--) {
        const p = popAnims[i];
        const elapsed = now - p.startTime;
        const duration = p.kind === "pop" ? POP_DURATION_MS : FALL_DURATION_MS;
        if (elapsed > duration) {
          popAnims.splice(i, 1);
          continue;
        }
        const t = elapsed / duration;
        const cx = pixelX(p.row, p.col);
        const baseCy = pixelY(p.row, topRow);
        if (p.kind === "pop") {
          drawBubble(cx, baseCy, p.type, 1 - t, 1 - t * 0.4);
        } else {
          drawBubble(cx, baseCy + t * t * 90, p.type, 1 - t, 1);
        }
      }

      if (!gameOver) {
        if (shot) {
          drawBubble(shot.pos.x, shot.pos.y, shot.type, 1, 1);
        } else {
          drawBubble(LAUNCHER_X, LAUNCHER_Y, currentType, 1, 1);
          if (isAiming) {
            const vel = aimVelocity(aimDx, aimDy);
            const mag = Math.hypot(vel.x, vel.y) || 1;
            const guideLen = 130;
            ctx.save();
            ctx.strokeStyle = "rgba(36,28,22,0.4)";
            ctx.setLineDash([6, 6]);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(LAUNCHER_X, LAUNCHER_Y);
            ctx.lineTo(
              LAUNCHER_X + (vel.x / mag) * guideLen,
              LAUNCHER_Y + (vel.y / mag) * guideLen,
            );
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }

    let rafId = 0;
    let lastTime = performance.now();

    function tick() {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 1 / 30);
      lastTime = now;

      if (!gameOver && shot) {
        const result = advanceShot(grid, topRow, shot.pos, shot.vel, dt);
        if (result.status === "flying") {
          shot.pos = result.pos;
          shot.vel = result.vel;
        } else {
          const landedType = shot.type;
          shot = null;
          resolveLanding(result.cell, landedType);
        }
      }

      draw(now);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [onGameOver, onNextTypeChange, onScoreChange, onShotsUntilDropChange]);

  return (
    <canvas
      ref={canvasRef}
      width={FIELD_WIDTH}
      height={FIELD_HEIGHT}
      className="touch-none rounded-card-sm border-2 border-ink bg-cream shadow-card"
      style={{
        width: "100%",
        maxWidth: FIELD_WIDTH,
        height: "auto",
        aspectRatio: `${FIELD_WIDTH} / ${FIELD_HEIGHT}`,
      }}
    />
  );
}
