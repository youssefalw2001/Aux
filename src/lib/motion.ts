import type { Transition } from "motion/react";

/**
 * Spring presets.
 *
 * Global rule for this codebase: springs, not easing curves. Easing makes
 * things look animated; springs make them feel alive because they carry
 * velocity and settle. Motion runs these off React's render cycle, so they
 * stay at 60fps even under load.
 *
 * Use `bounce` + `duration` (perceptual) over stiffness/damping (physical)
 * unless you specifically need to match a physical system.
 */

/** Default for UI state changes. Fast, barely overshoots. */
export const snap: Transition = {
  type: "spring",
  bounce: 0.16,
  duration: 0.42,
};

/** Buttons, toggles, taps. Crisp with a hint of life. */
export const tap: Transition = {
  type: "spring",
  bounce: 0.3,
  duration: 0.3,
};

/** Reveals and entrances. Noticeable overshoot — this is the drama. */
export const pop: Transition = {
  type: "spring",
  bounce: 0.5,
  duration: 0.65,
};

/** Big, weighty objects. Slow settle, feels heavy. */
export const heavy: Transition = {
  type: "spring",
  bounce: 0.2,
  duration: 0.9,
};

/** No bounce — for things that must not overshoot (progress, meters). */
export const linearish: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.35,
};

/** Layout shifts. Slightly slower than `snap` so the eye can track them. */
export const layout: Transition = {
  type: "spring",
  bounce: 0.18,
  duration: 0.5,
};

/**
 * Live-value spring for the amplitude ring. Tuned physically, not
 * perceptually: we want it to track the mic closely on attack but decay
 * smoothly so it reads as breathing rather than jittering.
 */
export const amplitudeSpring = {
  stiffness: 420,
  damping: 26,
  mass: 0.45,
  restDelta: 0.0005,
} as const;

/** Stagger children by index. */
export function stagger(i: number, step = 0.05, base = 0) {
  return base + i * step;
}
