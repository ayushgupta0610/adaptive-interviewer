"use client";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { easeOutValue } from "./easing";

interface CountUpProps {
  value: number;
  /** Decimal places to render. */
  decimals?: number;
  durationMs?: number;
}

/** Animates 0 → value on mount with an ease-out. Renders the final value instantly under reduced motion. */
export default function CountUp({ value, decimals = 1, durationMs = 900 }: CountUpProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    // Under reduced motion we render `value` directly (below) — no animation, no setState here.
    if (reduce) return;
    let start: number | null = null;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const t = (ts - start) / durationMs;
      setDisplay(easeOutValue(t, value));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, durationMs, reduce]);

  return <>{(reduce ? value : display).toFixed(decimals)}</>;
}
