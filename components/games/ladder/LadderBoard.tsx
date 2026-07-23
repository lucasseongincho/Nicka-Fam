"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { traceLadderPath } from "@/lib/ladder";
import type { LadderPathPoint } from "@/lib/ladder";
import type { LadderState, Person } from "@/lib/types";

const COL_WIDTH_MAX = 56;
const COL_WIDTH_MIN = 36;
const LADDER_WIDTH_TARGET = 260;
const ROW_HEIGHT = 16;
const TOP_MARGIN = 40;
const BOTTOM_MARGIN = 58;
const SIDE_PADDING = 22;

/** SVG path draw-in over ~1.6s using stroke-dashoffset -- no animation library needed. Only used for the viewer's own just-clicked reveal; everyone else's (and a revisited own) path renders already-settled. */
function AnimatedPath({
  points,
  xForColumn,
  yForRow,
  svgWidth,
  svgHeight,
  animate,
}: {
  points: LadderPathPoint[];
  xForColumn: (col: number) => number;
  yForRow: (row: number) => number;
  svgWidth: number;
  svgHeight: number;
  animate: boolean;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);
  const [drawn, setDrawn] = useState(!animate);

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xForColumn(p.col)} ${yForRow(p.row)}`).join(" ");

  useEffect(() => {
    if (pathRef.current) setLength(pathRef.current.getTotalLength());
  }, [d]);

  useEffect(() => {
    // `drawn` already starts as `!animate`, so a non-animated path needs no
    // effect at all. Double rAF so the browser paints the fully-hidden state
    // at least once before flipping the target, otherwise React can batch
    // both into one paint and the CSS transition never visibly runs.
    if (!animate) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setDrawn(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [animate]);

  return (
    <svg width={svgWidth} height={svgHeight} className="pointer-events-none absolute inset-0">
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke="#EA5A32"
        strokeWidth={4}
        strokeLinecap="round"
        style={{
          strokeDasharray: length,
          strokeDashoffset: drawn ? 0 : length,
          transition: animate ? "stroke-dashoffset 1.6s ease-in-out" : "none",
        }}
      />
    </svg>
  );
}

export function LadderBoard({
  state,
  people,
  activePersonId,
  justRevealedByMe,
}: {
  state: LadderState;
  people: Person[];
  activePersonId: string;
  justRevealedByMe: boolean;
}) {
  const playerIds = Object.keys(state.playerColumns).sort(
    (a, b) => state.playerColumns[a] - state.playerColumns[b],
  );
  const playerCount = playerIds.length;
  if (playerCount === 0) return null;

  const colWidth = Math.max(
    COL_WIDTH_MIN,
    Math.min(COL_WIDTH_MAX, LADDER_WIDTH_TARGET / Math.max(1, playerCount - 1)),
  );
  const ladderWidth = colWidth * Math.max(1, playerCount - 1);
  const svgWidth = ladderWidth + SIDE_PADDING * 2;
  const ladderHeight = state.rowCount * ROW_HEIGHT;
  const svgHeight = TOP_MARGIN + ladderHeight + BOTTOM_MARGIN;

  const xForColumn = (col: number) => SIDE_PADDING + col * colWidth;
  const yForRow = (row: number) => TOP_MARGIN + row * ROW_HEIGHT;

  const paths = playerIds.map((personId) => ({
    personId,
    ...traceLadderPath(state.playerColumns[personId], state.ladderStructure, state.rowCount),
  }));
  const personAtBottomColumn = new Map(paths.map((p) => [p.finalColumn, p.personId]));
  const myPath = paths.find((p) => p.personId === activePersonId);

  return (
    <div className="w-full overflow-x-auto">
      <div className="relative mx-auto" style={{ width: svgWidth, height: svgHeight }}>
        <svg width={svgWidth} height={svgHeight} className="absolute inset-0">
          {/* Base ladder -- lines + rungs, always fully visible to everyone. */}
          {Array.from({ length: playerCount }, (_, col) => (
            <line
              key={`col-${col}`}
              x1={xForColumn(col)}
              y1={yForRow(0)}
              x2={xForColumn(col)}
              y2={yForRow(state.rowCount)}
              stroke="rgba(36,28,22,0.28)"
              strokeWidth={2}
            />
          ))}
          {state.ladderStructure.map((rung, i) => (
            <line
              key={`rung-${i}`}
              x1={xForColumn(rung.gapIndex)}
              y1={yForRow(rung.row)}
              x2={xForColumn(rung.gapIndex + 1)}
              y2={yForRow(rung.row)}
              stroke="rgba(36,28,22,0.28)"
              strokeWidth={2}
            />
          ))}

          {/* Already-settled paths for everyone revealed, except a fresh reveal-by-me (drawn separately below so it can animate). */}
          {paths.map(({ personId, points }) => {
            if (!state.revealed[personId]) return null;
            if (personId === activePersonId && justRevealedByMe) return null;
            const d = points
              .map((p, i) => `${i === 0 ? "M" : "L"} ${xForColumn(p.col)} ${yForRow(p.row)}`)
              .join(" ");
            return (
              <path
                key={personId}
                d={d}
                fill="none"
                stroke="#EA5A32"
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.6}
              />
            );
          })}
        </svg>

        {myPath && state.revealed[activePersonId] && (
          <AnimatedPath
            points={myPath.points}
            xForColumn={xForColumn}
            yForRow={yForRow}
            svgWidth={svgWidth}
            svgHeight={svgHeight}
            animate={justRevealedByMe}
          />
        )}

        {playerIds.map((personId) => {
          const person = people.find((p) => p.id === personId);
          const col = state.playerColumns[personId];
          return (
            <div
              key={personId}
              className="absolute -translate-x-1/2"
              style={{ left: xForColumn(col), top: 0 }}
            >
              {person && (
                <Avatar
                  src={person.photoUrl}
                  name={person.name}
                  size="sm"
                  active={personId === activePersonId}
                />
              )}
            </div>
          );
        })}

        {Array.from({ length: playerCount }, (_, col) => {
          const personId = personAtBottomColumn.get(col);
          const isRevealed = !!personId && !!state.revealed[personId];
          return (
            <div
              key={`outcome-${col}`}
              className="absolute w-14 -translate-x-1/2 text-center"
              style={{ left: xForColumn(col), top: TOP_MARGIN + ladderHeight + 8 }}
            >
              {isRevealed ? (
                <span className="text-[10px] font-semibold leading-tight text-ink">
                  {state.outcomes[col]}
                </span>
              ) : (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-ink/25 text-xs text-ink/30">
                  ?
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
