"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  GRID_SIZE,
  candyFaceSrc,
  hasAnyValidMove,
  initialTiles,
  isAdjacent,
  reshuffle,
  resolveBoard,
  swapPositions,
  wouldMatch,
  type Position,
  type Tile,
} from "./candyMatchConfig";

/** Must match the gap-1 / p-2 / inset-2 Tailwind classes below (4px / 8px) -- used to compute each tile's slide offset in JS. */
const CELL_GAP_PX = 4;
const SWAP_DURATION_MS = 150;
const CLEAR_DURATION_MS = 200;
const FALL_DURATION_MS = 220;

function tileBoxSize() {
  return `calc((100% - ${(GRID_SIZE - 1) * CELL_GAP_PX}px) / ${GRID_SIZE})`;
}

function tileOffset(row: number, col: number) {
  return {
    x: `calc(${col} * (100% + ${CELL_GAP_PX}px))`,
    y: `calc(${row} * (100% + ${CELL_GAP_PX}px))`,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function CandyMatchBoard({
  onScoreChange,
  onMovesChange,
  onGameOver,
  onReshuffle,
  movesLimit,
}: {
  onScoreChange: (score: number) => void;
  onMovesChange: (movesLeft: number) => void;
  onGameOver: (finalScore: number) => void;
  onReshuffle: () => void;
  movesLimit: number;
}) {
  const [tiles, setTiles] = useState<Tile[]>(initialTiles);
  const [selected, setSelected] = useState<Position | null>(null);
  const [clearingIds, setClearingIds] = useState<Set<number>>(new Set());
  const [spawnedIds, setSpawnedIds] = useState<Set<number>>(
    () => new Set(tiles.map((t) => t.id)),
  );
  const [busy, setBusy] = useState(false);

  const tilesRef = useRef(tiles);
  const scoreRef = useRef(0);
  const movesLeftRef = useRef(movesLimit);
  const busyRef = useRef(false);
  const gameOverRef = useRef(false);
  const spawnTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onScoreChangeRef = useRef(onScoreChange);
  const onMovesChangeRef = useRef(onMovesChange);
  const onGameOverRef = useRef(onGameOver);
  const onReshuffleRef = useRef(onReshuffle);
  useEffect(() => {
    onScoreChangeRef.current = onScoreChange;
    onMovesChangeRef.current = onMovesChange;
    onGameOverRef.current = onGameOver;
    onReshuffleRef.current = onReshuffle;
  }, [onScoreChange, onMovesChange, onGameOver, onReshuffle]);

  useEffect(() => {
    onMovesChangeRef.current(movesLeftRef.current);
    spawnTimeoutRef.current = setTimeout(() => setSpawnedIds(new Set()), 200);
    return () => clearTimeout(spawnTimeoutRef.current);
  }, []);

  async function attemptSwap(from: Position, to: Position) {
    busyRef.current = true;
    setBusy(true);

    const swapped = swapPositions(tilesRef.current, from, to);
    tilesRef.current = swapped;
    setTiles(swapped);
    await sleep(SWAP_DURATION_MS);

    if (!wouldMatch(swapped)) {
      const reverted = swapPositions(swapped, from, to);
      tilesRef.current = reverted;
      setTiles(reverted);
      await sleep(SWAP_DURATION_MS);
      busyRef.current = false;
      setBusy(false);
      return;
    }

    const { steps } = resolveBoard(swapped);
    for (const step of steps) {
      setClearingIds(new Set(step.clearedTileIds));
      await sleep(CLEAR_DURATION_MS);

      tilesRef.current = step.tilesAfter;
      setTiles(step.tilesAfter);
      setClearingIds(new Set());
      setSpawnedIds(new Set(step.newlySpawnedIds));

      scoreRef.current += step.scoreGained;
      onScoreChangeRef.current(scoreRef.current);

      await sleep(FALL_DURATION_MS);
      setSpawnedIds(new Set());
    }

    movesLeftRef.current -= 1;
    onMovesChangeRef.current(movesLeftRef.current);

    if (!hasAnyValidMove(tilesRef.current) && movesLeftRef.current > 0) {
      const fresh = reshuffle();
      tilesRef.current = fresh;
      setTiles(fresh);
      setSpawnedIds(new Set(fresh.map((t) => t.id)));
      onReshuffleRef.current();
      await sleep(200);
      setSpawnedIds(new Set());
    }

    busyRef.current = false;
    setBusy(false);

    if (movesLeftRef.current <= 0) {
      gameOverRef.current = true;
      onGameOverRef.current(scoreRef.current);
    }
  }

  function handleTileTap(pos: Position) {
    if (busyRef.current || gameOverRef.current) return;
    if (!selected) {
      setSelected(pos);
      return;
    }
    if (selected.row === pos.row && selected.col === pos.col) {
      setSelected(null);
      return;
    }
    if (!isAdjacent(selected, pos)) {
      setSelected(pos);
      return;
    }
    setSelected(null);
    void attemptSwap(selected, pos);
  }

  return (
    <div className="relative aspect-square w-full max-w-[300px] select-none rounded-card-sm border-2 border-ink bg-cream p-2 shadow-card">
      <div
        className="grid h-full w-full gap-1"
        style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
          const row = Math.floor(i / GRID_SIZE);
          const col = i % GRID_SIZE;
          const isSelected = selected?.row === row && selected?.col === col;
          return (
            <button
              key={i}
              type="button"
              disabled={busy}
              onClick={() => handleTileTap({ row, col })}
              className={`cursor-pointer rounded-card-sm border-2 bg-paper transition-colors disabled:cursor-default ${
                isSelected ? "border-orange" : "border-ink/10"
              }`}
            />
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-2">
        {tiles.map((tile) => {
          const { x, y } = tileOffset(tile.row, tile.col);
          const isClearing = clearingIds.has(tile.id);
          const isSpawning = spawnedIds.has(tile.id);
          return (
            <div
              key={tile.id}
              className="absolute transition-transform ease-in-out"
              style={{
                width: tileBoxSize(),
                height: tileBoxSize(),
                transform: `translate(${x}, ${y})`,
                transitionDuration: `${SWAP_DURATION_MS}ms`,
              }}
            >
              <div
                className={`relative h-full w-full rounded-card-sm transition-all ${
                  isClearing
                    ? "scale-0 opacity-0 duration-200"
                    : isSpawning
                      ? "animate-[tile-pop_180ms_ease-out]"
                      : ""
                }`}
              >
                <Image
                  src={candyFaceSrc(tile.type)}
                  alt=""
                  fill
                  sizes="60px"
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
