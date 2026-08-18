"use client";

import { animate, useMotionValue, useTransform, motion } from "motion/react";
import { useEffect } from "react";

/**
 * Counts up to a value instead of snapping to it.
 *
 * Small thing, big effect: at reveal, vote counts that roll read as *results
 * coming in*, whereas numbers that just appear read as data. Same information,
 * completely different feeling.
 */
export function RollingNumber({
  value,
  duration = 0.9,
  delay = 0,
  className,
}: {
  value: number;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v).toString());

  useEffect(() => {
    const controls = animate(count, value, {
      duration,
      delay,
      // Decelerating ease so the last digit "lands" rather than easing out flat
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [count, value, duration, delay]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
