"use client";

import { useRef } from "react";
import type { Person } from "@/lib/types";
import { useSnakeEngine } from "@/components/games/snake/useSnakeEngine";
import { useIsLandscape } from "@/components/games/snake/useIsLandscape";
import { Joystick } from "@/components/games/snake/Joystick";

/**
 * Fullscreen (breaks out of the app shell's max-w-md) canvas + HUD for one
 * person's view of a shared match. Landscape-only: the play box needs the
 * device's full width to be worth rotating for, so this takes over the
 * whole viewport rather than sitting inline in the normal page column.
 * Steering is joystick-driven (bottom-left), boost is a separate
 * press-and-hold button (bottom-right) -- kept on opposite corners so
 * neither thumb ever covers the middle of the play box where the actual
 * gameplay is.
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
  const isLandscape = useIsLandscape();
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
    <div className="fixed inset-0 z-40 overflow-hidden bg-ink">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none select-none" />

      <div className="pointer-events-none absolute left-3 top-3 rounded-pill border-2 border-ink bg-card/90 px-3 py-1 font-heading text-sm font-semibold text-ink">
        score {engine.score}
      </div>

      <button
        onClick={onLeave}
        className="absolute right-3 top-3 cursor-pointer rounded-pill border-2 border-ink bg-card/90 px-3 py-1 font-heading text-sm font-semibold text-ink"
      >
        leave arena
      </button>

      <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center gap-0.5 rounded-card-sm border-2 border-card/70 bg-ink/60 px-3 py-1.5">
        {engine.leaderboard.slice(0, 3).map((entry, i) => (
          <div key={entry.id} className="flex items-center gap-1.5 text-xs text-card/90">
            <span className="text-card/50">{i + 1}</span>
            <span className={entry.isSelf ? "font-semibold text-orange" : ""}>{entry.name}</span>
            {entry.isBot && <span>🤖</span>}
            <span className="font-heading font-semibold">{entry.score}</span>
          </div>
        ))}
      </div>

      {!engine.alive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-ink/65 text-center">
          <p className="font-heading text-2xl font-bold text-card">you got got</p>
          <p className="text-sm text-card/70">
            respawning in {Math.max(1, Math.ceil(engine.respawnRemainingMs / 1000))}s
          </p>
        </div>
      )}

      <div className="absolute bottom-5 left-5">
        <Joystick onChange={engine.setSteering} />
      </div>

      <button
        onPointerDown={(e) => {
          e.stopPropagation();
          engine.setBoosting(true);
        }}
        onPointerUp={() => engine.setBoosting(false)}
        onPointerLeave={() => engine.setBoosting(false)}
        onPointerCancel={() => engine.setBoosting(false)}
        className="absolute bottom-6 right-6 cursor-pointer touch-none select-none rounded-pill border-2 border-ink bg-orange px-5 py-3 font-heading text-sm font-semibold text-card shadow-button active:scale-95"
      >
        boost
      </button>

      {!isLandscape && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-ink px-8 text-center">
          <div className="text-4xl">📱↻</div>
          <p className="font-heading text-lg font-semibold text-card">rotate your phone</p>
          <p className="max-w-[240px] text-sm text-card/70">
            지렁이게임 plays sideways — turn your device to landscape to keep going.
          </p>
        </div>
      )}
    </div>
  );
}
