"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Image from "next/image";
import {
  GRID_SIZE,
  candyColor,
  candyFaceSrc,
  evaluateSwap,
  hasAnyValidMove,
  initialTiles,
  reshuffle,
  resolveBoard,
  swapPositions,
  type Position,
  type SpecialType,
  type Tile,
} from "./candyMatchConfig";

const SWAP_DURATION_MS = 150;
const CLEAR_DURATION_MS = 200;
const FALL_DURATION_MS = 220;
/** Minimum drag distance (css px) before it counts as a directional swipe, not a tap. */
const DRAG_THRESHOLD = 14;

const SPECIAL_BADGES: Record<SpecialType, string> = {
  "striped-row": "↔️",
  "striped-col": "↕️",
  wrapped: "💣",
  "color-bomb": "🌈",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type CellBox = { x: number; y: number; size: number };

/**
 * Measures each background cell's actual rendered box (relative to the
 * tile layer) rather than recomputing position from a percentage-in-calc
 * expression a second time -- a prior version positioned tiles with
 * `translate(calc(col * (100% + gap)))`, which is exact algebraically but
 * on iOS Safari the measured board didn't match: real device screenshots
 * showed the last column clipped, meaning WebKit was resolving that nested
 * calc()/percentage differently than Chrome (which reproduces it exactly).
 * Reading the live DOM sidesteps needing every engine to agree on the math.
 */
function useCellBoxes(
  gridRef: React.RefObject<HTMLDivElement | null>,
  layerRef: React.RefObject<HTMLDivElement | null>,
) {
  const [boxes, setBoxes] = useState<CellBox[]>([]);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    const layer = layerRef.current;
    if (!grid || !layer) return;

    function measure() {
      if (!grid || !layer) return;
      const layerRect = layer.getBoundingClientRect();
      const next = Array.from(grid.children).map((child) => {
        const r = child.getBoundingClientRect();
        return { x: r.left - layerRect.left, y: r.top - layerRect.top, size: r.width };
      });
      setBoxes(next);
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    return () => ro.disconnect();
  }, [gridRef, layerRef]);

  return boxes;
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
  const [draggingPos, setDraggingPos] = useState<Position | null>(null);
  const [clearingIds, setClearingIds] = useState<Set<number>>(new Set());
  const [spawnedIds, setSpawnedIds] = useState<Set<number>>(
    () => new Set(tiles.map((t) => t.id)),
  );
  const [createdSpecialIds, setCreatedSpecialIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const tilesRef = useRef(tiles);
  const scoreRef = useRef(0);
  const movesLeftRef = useRef(movesLimit);
  const busyRef = useRef(false);
  const gameOverRef = useRef(false);
  const spawnTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const gridRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const cellBoxes = useCellBoxes(gridRef, layerRef);

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

    const { valid, seeds } = evaluateSwap(tilesRef.current, from, to);
    const swapped = swapPositions(tilesRef.current, from, to);
    tilesRef.current = swapped;
    setTiles(swapped);
    await sleep(SWAP_DURATION_MS);

    if (!valid) {
      const reverted = swapPositions(swapped, from, to);
      tilesRef.current = reverted;
      setTiles(reverted);
      await sleep(SWAP_DURATION_MS);
      busyRef.current = false;
      setBusy(false);
      return;
    }

    const { steps } = resolveBoard(swapped, seeds);
    for (const step of steps) {
      setClearingIds(new Set(step.clearedTileIds));
      setCreatedSpecialIds(new Set(step.createdSpecialIds));
      await sleep(CLEAR_DURATION_MS);

      tilesRef.current = step.tilesAfter;
      setTiles(step.tilesAfter);
      setClearingIds(new Set());
      setSpawnedIds(new Set(step.newlySpawnedIds));

      scoreRef.current += step.scoreGained;
      onScoreChangeRef.current(scoreRef.current);

      await sleep(FALL_DURATION_MS);
      setSpawnedIds(new Set());
      setCreatedSpecialIds(new Set());
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

  const dragStartRef = useRef<{ row: number; col: number; x: number; y: number } | null>(null);

  function handlePointerDown(e: ReactPointerEvent<HTMLButtonElement>, row: number, col: number) {
    if (busyRef.current || gameOverRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { row, col, x: e.clientX, y: e.clientY };
    setDraggingPos({ row, col });
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    setDraggingPos(null);
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_THRESHOLD) return;

    const horizontal = Math.abs(dx) > Math.abs(dy);
    const dRow = horizontal ? 0 : dy > 0 ? 1 : -1;
    const dCol = horizontal ? (dx > 0 ? 1 : -1) : 0;
    const to = { row: start.row + dRow, col: start.col + dCol };
    if (to.row < 0 || to.row >= GRID_SIZE || to.col < 0 || to.col >= GRID_SIZE) return;

    void attemptSwap({ row: start.row, col: start.col }, to);
  }

  function handlePointerCancel() {
    dragStartRef.current = null;
    setDraggingPos(null);
  }

  return (
    <div className="relative aspect-square w-full max-w-[300px] touch-none select-none overflow-hidden rounded-card-sm border-2 border-ink bg-cream p-2 shadow-card">
      <div
        ref={gridRef}
        className="grid h-full w-full gap-1"
        style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
          const row = Math.floor(i / GRID_SIZE);
          const col = i % GRID_SIZE;
          const isDragging = draggingPos?.row === row && draggingPos?.col === col;
          return (
            <button
              key={i}
              type="button"
              disabled={busy}
              onPointerDown={(e) => handlePointerDown(e, row, col)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              className={`cursor-pointer rounded-card-sm border-2 border-transparent bg-transparent transition-colors disabled:cursor-default ${
                isDragging ? "border-orange" : ""
              }`}
            />
          );
        })}
      </div>

      <div ref={layerRef} className="pointer-events-none absolute inset-2">
        {tiles.map((tile) => {
          const box = cellBoxes[tile.row * GRID_SIZE + tile.col];
          const isClearing = clearingIds.has(tile.id);
          const isSpawning = spawnedIds.has(tile.id);
          const isCreatedSpecial = createdSpecialIds.has(tile.id);
          return (
            <div
              key={tile.id}
              className="absolute transition-transform ease-in-out"
              style={{
                width: box ? `${box.size}px` : `${100 / GRID_SIZE}%`,
                height: box ? `${box.size}px` : `${100 / GRID_SIZE}%`,
                transform: box ? `translate(${box.x}px, ${box.y}px)` : undefined,
                transitionDuration: `${SWAP_DURATION_MS}ms`,
              }}
            >
              <div
                className={`relative h-full w-full rounded-full transition-all ${
                  isClearing
                    ? "scale-0 opacity-0 duration-200"
                    : isCreatedSpecial
                      ? "animate-[tile-merge-pulse_200ms_ease-out]"
                      : isSpawning
                        ? "animate-[tile-pop_180ms_ease-out]"
                        : ""
                } ${tile.special ? "ring-2 ring-orange ring-offset-1" : ""}`}
                style={{ backgroundColor: candyColor(tile.type) }}
              >
                <Image
                  src={candyFaceSrc(tile.type)}
                  alt=""
                  fill
                  sizes="60px"
                  className="rounded-full object-cover p-1"
                />
                {tile.special && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-card text-[10px] leading-none shadow-card">
                    {SPECIAL_BADGES[tile.special]}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
