"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import {
  GRID_SIZE,
  emptyGrid,
  hasMovesAvailable,
  hasReachedMaxTier,
  move,
  spawnRandomTile,
  tileFaceSrc,
  type Direction,
  type Grid,
} from "./twentyFortyEightConfig";

/** Minimum swipe distance (css px) before it counts as a directional gesture, not a tap. */
const SWIPE_THRESHOLD = 24;

function initialGrid(): Grid {
  return spawnRandomTile(spawnRandomTile(emptyGrid()));
}

export function TwentyFortyEightBoard({
  onScoreChange,
  onGameOver,
  onWin,
}: {
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  onWin: () => void;
}) {
  const [grid, setGrid] = useState<Grid>(initialGrid);
  const [score, setScore] = useState(0);
  const gridRef = useRef(grid);
  const scoreRef = useRef(0);
  const wonRef = useRef(false);
  const gameOverRef = useRef(false);

  useEffect(() => {
    onScoreChange(score);
  }, [score, onScoreChange]);

  // Callbacks read through refs (kept current each render) so the keydown
  // listener below can be attached once at mount instead of re-subscribing
  // on every prop change.
  const onGameOverRef = useRef(onGameOver);
  const onWinRef = useRef(onWin);
  useEffect(() => {
    onGameOverRef.current = onGameOver;
    onWinRef.current = onWin;
  }, [onGameOver, onWin]);

  function applyMove(direction: Direction) {
    if (gameOverRef.current) return;
    const result = move(gridRef.current, direction);
    if (!result.changed) return;

    const spawned = spawnRandomTile(result.grid);
    gridRef.current = spawned;
    setGrid(spawned);

    if (result.scoreGained > 0) {
      scoreRef.current += result.scoreGained;
      setScore(scoreRef.current);
    }

    if (!wonRef.current && hasReachedMaxTier(spawned)) {
      wonRef.current = true;
      onWinRef.current();
    }

    if (!hasMovesAvailable(spawned)) {
      gameOverRef.current = true;
      onGameOverRef.current(scoreRef.current);
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      const direction: Direction | null =
        e.key === "ArrowUp"
          ? "up"
          : e.key === "ArrowDown"
            ? "down"
            : e.key === "ArrowLeft"
              ? "left"
              : e.key === "ArrowRight"
                ? "right"
                : null;
      if (!direction) return;
      e.preventDefault();
      applyMove(direction);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function handlePointerDown(e: ReactPointerEvent) {
    touchStart.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerUp(e: ReactPointerEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
    const direction: Direction =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    applyMove(direction);
  }

  return (
    <div
      className="grid aspect-square w-full max-w-[300px] touch-none select-none gap-2 rounded-card-sm border-2 border-ink bg-cream p-2 shadow-card"
      style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        touchStart.current = null;
      }}
    >
      {grid.map((row, r) =>
        row.map((tier, c) => (
          <div
            key={`${r}-${c}`}
            className="relative flex items-center justify-center rounded-card-sm border-2 border-ink/10 bg-paper"
          >
            {tier > 0 && (
              <Image
                src={tileFaceSrc(tier)}
                alt=""
                fill
                sizes="80px"
                className="animate-[tile-pop_160ms_ease-out] rounded-card-sm object-cover p-0.5"
              />
            )}
          </div>
        )),
      )}
    </div>
  );
}
