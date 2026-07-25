"use client";

import { useRef, useState } from "react";

const BASE_RADIUS = 48;
const KNOB_SIZE = 44;

/**
 * Virtual joystick: drag the knob within the base ring to steer, release to
 * go straight in whatever heading you last set. Reports a raw (dx, dy)
 * offset from center -- the engine only ever needs the angle of that
 * vector, so this doesn't need to know anything about world coordinates or
 * the canvas itself. Uses pointer capture so a finger that slides past the
 * base's edge is still tracked (clamped visually to the ring) rather than
 * silently dropping the gesture.
 */
export function Joystick({
  onChange,
}: {
  onChange: (vector: { dx: number; dy: number } | null) => void;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const updateFromClientPoint = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > BASE_RADIUS) {
      dx = (dx / dist) * BASE_RADIUS;
      dy = (dy / dist) * BASE_RADIUS;
    }
    setKnob({ x: dx, y: dy });
    onChange({ dx, dy });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerId.current = e.pointerId;
    updateFromClientPoint(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    updateFromClientPoint(e.clientX, e.clientY);
  };

  const release = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    setKnob({ x: 0, y: 0 });
    onChange(null);
  };

  return (
    <div
      ref={baseRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      className="relative h-24 w-24 touch-none select-none rounded-full border-2 border-card/70 bg-card/20 backdrop-blur-sm"
    >
      <div
        className="absolute rounded-full border-2 border-ink bg-orange shadow-button"
        style={{
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          left: `calc(50% + ${knob.x}px - ${KNOB_SIZE / 2}px)`,
          top: `calc(50% + ${knob.y}px - ${KNOB_SIZE / 2}px)`,
        }}
      />
    </div>
  );
}
