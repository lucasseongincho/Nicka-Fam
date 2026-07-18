"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import {
  GRID_SIZE,
  hasMovesAvailable,
  hasReachedMaxTier,
  initialTiles,
  move,
  spawnTile,
  tileFaceSrc,
  type Direction,
  type Tile,
} from "./twentyFortyEightConfig";

/** Minimum swipe distance (css px) before it counts as a directional gesture, not a tap. */
const SWIPE_THRESHOLD = 24;

/** Must match the gap-2 / p-2 / inset-2 Tailwind classes below (8px each) -- used to compute each tile's slide offset in JS. */
const CELL_GAP_PX = 8;
const SLIDE_TRANSITION_MS = 150;
const MERGE_PULSE_MS = 200;

function tileBoxSize() {
  return `calc((100% - ${(GRID_SIZE - 1) * CELL_GAP_PX}px) / ${GRID_SIZE})`;
}

function tileOffset(row: number, col: number) {
  return {
    x: `calc(${col} * (100% + ${CELL_GAP_PX}px))`,
    y: `calc(${row} * (100% + ${CELL_GAP_PX}px))`,
  };
}

const POP_ANIMATION_MS = 160;

export function TwentyFortyEightBoard({
  onScoreChange,
  onGameOver,
  onWin,
}: {
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  onWin: () => void;
}) {
  const [tiles, setTiles] = useState<Tile[]>(initialTiles);
  const [removedTiles, setRemovedTiles] = useState<Tile[]>([]);
  const [mergedIds, setMergedIds] = useState<Set<number>>(new Set());
  const [spawnedIds, setSpawnedIds] = useState<Set<number>>(
    () => new Set(tiles.map((t) => t.id)),
  );
  const [score, setScore] = useState(0);
  const tilesRef = useRef(tiles);
  const scoreRef = useRef(0);
  const wonRef = useRef(false);
  const gameOverRef = useRef(false);
  const removeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mergeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const spawnTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    onScoreChange(score);
  }, [score, onScoreChange]);

  useEffect(() => {
    spawnTimeoutRef.current = setTimeout(() => setSpawnedIds(new Set()), POP_ANIMATION_MS);
    return () => {
      clearTimeout(removeTimeoutRef.current);
      clearTimeout(mergeTimeoutRef.current);
      clearTimeout(spawnTimeoutRef.current);
    };
  }, []);

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
    const result = move(tilesRef.current, direction);
    if (!result.changed) return;

    const spawned = spawnTile(result.tiles);
    const nextTiles = spawned ? [...result.tiles, spawned] : result.tiles;
    tilesRef.current = nextTiles;
    setTiles(nextTiles);

    clearTimeout(removeTimeoutRef.current);
    setRemovedTiles(result.removed);
    removeTimeoutRef.current = setTimeout(() => setRemovedTiles([]), SLIDE_TRANSITION_MS);

    clearTimeout(mergeTimeoutRef.current);
    setMergedIds(result.mergedIds);
    mergeTimeoutRef.current = setTimeout(() => setMergedIds(new Set()), MERGE_PULSE_MS);

    clearTimeout(spawnTimeoutRef.current);
    setSpawnedIds(spawned ? new Set([spawned.id]) : new Set());
    if (spawned) {
      spawnTimeoutRef.current = setTimeout(() => setSpawnedIds(new Set()), POP_ANIMATION_MS);
    }

    if (result.scoreGained > 0) {
      scoreRef.current += result.scoreGained;
      setScore(scoreRef.current);
    }

    if (!wonRef.current && hasReachedMaxTier(nextTiles)) {
      wonRef.current = true;
      onWinRef.current();
    }

    if (!hasMovesAvailable(nextTiles)) {
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
      className="relative aspect-square w-full max-w-[300px] touch-none select-none rounded-card-sm border-2 border-ink bg-cream p-2 shadow-card"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        touchStart.current = null;
      }}
    >
      <div
        className="grid h-full w-full gap-2"
        style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => (
          <div key={i} className="rounded-card-sm border-2 border-ink/10 bg-paper" />
        ))}
      </div>

      <div className="absolute inset-2">
        {[...removedTiles, ...tiles].map((tile) => {
          const { x, y } = tileOffset(tile.row, tile.col);
          return (
            <div
              key={tile.id}
              className="absolute transition-transform ease-in-out"
              style={{
                width: tileBoxSize(),
                height: tileBoxSize(),
                transform: `translate(${x}, ${y})`,
                transitionDuration: `${SLIDE_TRANSITION_MS}ms`,
              }}
            >
              <div
                className={`relative h-full w-full rounded-card-sm ${
                  mergedIds.has(tile.id)
                    ? "animate-[tile-merge-pulse_200ms_ease-out]"
                    : spawnedIds.has(tile.id)
                      ? "animate-[tile-pop_160ms_ease-out]"
                      : ""
                }`}
              >
                <Image
                  src={tileFaceSrc(tile.tier)}
                  alt=""
                  fill
                  sizes="80px"
                  className="rounded-card-sm object-cover p-0.5"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
