"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** Stagger delay in seconds. */
  delay?: number;
  className?: string;
}

/** Fades + rises its children into view once. No motion when the user prefers reduced motion. */
export default function Reveal({ children, delay = 0, className }: RevealProps) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
