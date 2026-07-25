"use client";

import { useRef } from "react";
import type { Person } from "@/lib/types";
import { useSnakeEngine } from "@/components/games/snake/useSnakeEngine";
import { SnakeHud } from "@/components/games/snake/SnakeHud";

/**
 * Canvas + HUD for one person's view of a shared match. Steering is
 * drag-based: hold anywhere on the arena and the snake's head steers
 * toward wherever the pointer currently is, relative to the (camera-
 * centered) head -- release and it keeps going straight in the last
 * heading. Boost is a separate press-and-hold button so it can't be
 * triggered by steering gestures.
 */
export function SnakeArena({
  roomId,
  activePerson,
  isHost,
  people,
  onLeave,
}: {
  roomId: string;
  activePerson: Person;
  isHost: boolean;
  people: Person[];
  onLeave: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useSnakeEngine({
    roomId,
    personId: activePerson.id,
    personName: activePerson.name,
    personPhotoUrl: activePerson.photoUrl,
    isHost,
    people,
    canvasRef,
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-heading text-lg font-semibold text-ink">지렁이게임</p>
        <button
          onClick={onLeave}
          className="cursor-pointer font-body text-sm font-medium text-orange"
        >
          leave arena
        </button>
      </div>

      <div className="relative aspect-square w-full overflow-hidden rounded-card border-2 border-ink bg-ink shadow-card">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none"
          {...engine.pointerHandlers}
        />

        <div className="pointer-events-none absolute left-3 top-3 rounded-pill border-2 border-ink bg-card/90 px-3 py-1 font-heading text-sm font-semibold text-ink">
          score {engine.score}
        </div>

        {!engine.alive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-ink/65 text-center">
            <p className="font-heading text-2xl font-bold text-card">you got got</p>
            <p className="text-sm text-card/70">
              respawning in {Math.max(1, Math.ceil(engine.respawnRemainingMs / 1000))}s
            </p>
          </div>
        )}

        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            engine.setBoosting(true);
          }}
          onPointerUp={() => engine.setBoosting(false)}
          onPointerLeave={() => engine.setBoosting(false)}
          onPointerCancel={() => engine.setBoosting(false)}
          className="absolute bottom-3 right-3 cursor-pointer touch-none select-none rounded-pill border-2 border-ink bg-orange px-4 py-2.5 font-heading text-sm font-semibold text-card shadow-button active:scale-95"
        >
          boost
        </button>
      </div>

      <SnakeHud leaderboard={engine.leaderboard} />
    </div>
  );
}
