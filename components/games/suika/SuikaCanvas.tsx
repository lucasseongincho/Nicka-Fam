"use client";

import { useEffect, useRef } from "react";
import Matter from "matter-js";
import {
  SUIKA_DIAMETERS,
  SUIKA_DROP_COOLDOWN_MS,
  SUIKA_DROP_LINE_Y,
  SUIKA_DROP_SPAWN_Y,
  SUIKA_FIELD_HEIGHT,
  SUIKA_FIELD_WIDTH,
  SUIKA_OVER_LINE_MS,
  SUIKA_STAGE_COUNT,
  SUIKA_WALL_THICKNESS,
  mergeScore,
  randomDroppableStage,
  suikaFaceSrc,
} from "./suikaConfig";

type PieceBody = Matter.Body & {
  stage: number;
  overLineSince: number | null;
};

export function SuikaCanvas({
  onScoreChange,
  onNextStageChange,
  onGameOver,
}: {
  onScoreChange: (score: number) => void;
  onNextStageChange: (stage: number) => void;
  onGameOver: (finalScore: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;
    // Rebind to plain, non-nullable locals: TS narrowing from the guards
    // above doesn't survive into the closures below (requestAnimationFrame
    // callbacks, event handlers), but a fresh const with an inferred
    // non-nullable type does.
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = context;

    const images = Array.from({ length: SUIKA_STAGE_COUNT }, (_, i) => {
      const img = new window.Image();
      img.src = suikaFaceSrc(i);
      return img;
    });

    const engine = Matter.Engine.create();
    engine.gravity.y = 1;
    const world = engine.world;

    const wallOptions = { isStatic: true, friction: 0.4 };
    Matter.World.add(world, [
      Matter.Bodies.rectangle(
        SUIKA_FIELD_WIDTH / 2,
        SUIKA_FIELD_HEIGHT + SUIKA_WALL_THICKNESS / 2,
        SUIKA_FIELD_WIDTH,
        SUIKA_WALL_THICKNESS,
        wallOptions,
      ),
      Matter.Bodies.rectangle(
        -SUIKA_WALL_THICKNESS / 2,
        SUIKA_FIELD_HEIGHT / 2,
        SUIKA_WALL_THICKNESS,
        SUIKA_FIELD_HEIGHT * 2,
        wallOptions,
      ),
      Matter.Bodies.rectangle(
        SUIKA_FIELD_WIDTH + SUIKA_WALL_THICKNESS / 2,
        SUIKA_FIELD_HEIGHT / 2,
        SUIKA_WALL_THICKNESS,
        SUIKA_FIELD_HEIGHT * 2,
        wallOptions,
      ),
    ]);

    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    let currentStage = randomDroppableStage();
    let nextStage = randomDroppableStage();
    let score = 0;
    let canDrop = true;
    let gameOver = false;
    let pointerX = SUIKA_FIELD_WIDTH / 2;
    let rafId = 0;
    let dropTimeoutId: ReturnType<typeof setTimeout> | undefined;

    onNextStageChange(nextStage);

    const minX = () => SUIKA_WALL_THICKNESS / 2;
    const maxX = () => SUIKA_FIELD_WIDTH - SUIKA_WALL_THICKNESS / 2;

    function clampForRadius(x: number, radius: number) {
      return Math.min(Math.max(x, minX() + radius), maxX() - radius);
    }

    function addPiece(stage: number, x: number, y: number) {
      const radius = SUIKA_DIAMETERS[stage] / 2;
      const body = Matter.Bodies.circle(clampForRadius(x, radius), y, radius, {
        restitution: 0.2,
        friction: 0.4,
        frictionAir: 0.0008,
      }) as PieceBody;
      body.stage = stage;
      body.overLineSince = null;
      Matter.World.add(world, body);
      return body;
    }

    function handleDrop() {
      if (gameOver || !canDrop) return;
      canDrop = false;
      addPiece(currentStage, pointerX, SUIKA_DROP_SPAWN_Y);
      currentStage = nextStage;
      nextStage = randomDroppableStage();
      onNextStageChange(nextStage);
      dropTimeoutId = setTimeout(() => {
        canDrop = true;
      }, SUIKA_DROP_COOLDOWN_MS);
    }

    function xFromClientX(clientX: number) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = SUIKA_FIELD_WIDTH / rect.width;
      return (clientX - rect.left) * scaleX;
    }

    function handlePointerMove(e: PointerEvent) {
      pointerX = xFromClientX(e.clientX);
    }
    function handlePointerDown(e: PointerEvent) {
      pointerX = xFromClientX(e.clientX);
      handleDrop();
    }
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerdown", handlePointerDown);

    const merging = new Set<number>();
    function handleCollisions(event: Matter.IEventCollision<Matter.Engine>) {
      for (const pair of event.pairs) {
        const a = pair.bodyA as PieceBody;
        const b = pair.bodyB as PieceBody;
        if (a.isStatic || b.isStatic) continue;
        if (a.stage === undefined || b.stage === undefined) continue;
        if (a.stage !== b.stage) continue;
        if (merging.has(a.id) || merging.has(b.id)) continue;
        merging.add(a.id);
        merging.add(b.id);

        const stage = a.stage;
        const midX = (a.position.x + b.position.x) / 2;
        const midY = (a.position.y + b.position.y) / 2;
        Matter.World.remove(world, a);
        Matter.World.remove(world, b);

        const resultStage = stage + 1;
        score += mergeScore(resultStage > SUIKA_STAGE_COUNT - 1 ? SUIKA_STAGE_COUNT : resultStage);
        onScoreChange(score);

        if (resultStage <= SUIKA_STAGE_COUNT - 1) {
          addPiece(resultStage, midX, midY);
        }
      }
      merging.clear();
    }
    Matter.Events.on(engine, "collisionStart", handleCollisions);

    function checkGameOver(bodies: PieceBody[], now: number) {
      if (gameOver) return;
      for (const body of bodies) {
        const radius = SUIKA_DIAMETERS[body.stage] / 2;
        const top = body.position.y - radius;
        const speed = Matter.Vector.magnitude(body.velocity);
        const settled = speed < 0.05;
        if (top < SUIKA_DROP_LINE_Y && settled) {
          if (body.overLineSince === null) body.overLineSince = now;
          else if (now - body.overLineSince > SUIKA_OVER_LINE_MS) {
            gameOver = true;
            onGameOver(score);
            return;
          }
        } else {
          body.overLineSince = null;
        }
      }
    }

    function draw(bodies: PieceBody[]) {
      ctx.clearRect(0, 0, SUIKA_FIELD_WIDTH, SUIKA_FIELD_HEIGHT);

      ctx.save();
      ctx.strokeStyle = "rgba(234,90,50,0.55)";
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, SUIKA_DROP_LINE_Y);
      ctx.lineTo(SUIKA_FIELD_WIDTH, SUIKA_DROP_LINE_Y);
      ctx.stroke();
      ctx.restore();

      for (const body of bodies) {
        const d = SUIKA_DIAMETERS[body.stage];
        const img = images[body.stage];
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle);
        if (img.complete) {
          ctx.drawImage(img, -d / 2, -d / 2, d, d);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, d / 2, 0, Math.PI * 2);
          ctx.fillStyle = "#efe6d8";
          ctx.fill();
        }
        ctx.restore();
      }

      if (!gameOver) {
        const d = SUIKA_DIAMETERS[currentStage];
        const radius = d / 2;
        const x = clampForRadius(pointerX, radius);
        const img = images[currentStage];
        ctx.save();
        ctx.globalAlpha = 0.85;
        if (img.complete) ctx.drawImage(img, x - radius, SUIKA_DROP_SPAWN_Y - radius, d, d);
        ctx.restore();
      }
    }

    function tick() {
      const now = performance.now();
      const bodies = Matter.Composite.allBodies(world).filter(
        (b) => !b.isStatic,
      ) as PieceBody[];
      checkGameOver(bodies, now);
      draw(bodies);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      if (dropTimeoutId) clearTimeout(dropTimeoutId);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      Matter.Events.off(engine, "collisionStart", handleCollisions);
      Matter.Runner.stop(runner);
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
    };
  }, [onGameOver, onNextStageChange, onScoreChange]);

  return (
    <canvas
      ref={canvasRef}
      width={SUIKA_FIELD_WIDTH}
      height={SUIKA_FIELD_HEIGHT}
      className="touch-none rounded-card-sm border-2 border-ink bg-cream shadow-card"
      style={{
        width: "100%",
        maxWidth: SUIKA_FIELD_WIDTH,
        height: "auto",
        aspectRatio: `${SUIKA_FIELD_WIDTH} / ${SUIKA_FIELD_HEIGHT}`,
      }}
    />
  );
}
