"use client";

import { useEffect, useState } from "react";

/**
 * Lazy initializer reads the real value on the client's first render
 * (falling back to true -- assume landscape, no prompt -- only during SSR,
 * where matchMedia doesn't exist); the effect then just subscribes to
 * future rotations.
 */
export function useIsLandscape(): boolean {
  const [isLandscape, setIsLandscape] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(orientation: landscape)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const onChange = () => setIsLandscape(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isLandscape;
}
