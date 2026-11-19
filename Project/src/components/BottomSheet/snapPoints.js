// src/components/BottomSheet/snapPoints.js
// Pure helpers of the bottom sheet: no React, no DOM, so Vitest covers them
// in the node environment (snapPoints.test.js).

/** Sheet states from the lowest to the highest (05 §2.1). */
export const SNAPS = ['collapsed', 'half', 'full'];

/**
 * A release faster than this continues in its direction to the next state,
 * however short the drag was. CSS px per millisecond.
 * A behaviour threshold, not a design value, so it is not a token
 * (same rule as the click tolerance in map/interactions.js).
 */
export const FLICK_VELOCITY = 0.4;

/** What pressing the handle does: one step up, and from the top back down. */
export function nextSnap(snap) {
  return SNAPS[(SNAPS.indexOf(snap) + 1) % SNAPS.length];
}

/**
 * One step up or down for the arrow keys on the handle; stays at the ends.
 * @param {string} snap
 * @param {1|-1} direction 1: taller
 */
export function stepSnap(snap, direction) {
  const index = SNAPS.indexOf(snap) + direction;
  return SNAPS[Math.min(Math.max(index, 0), SNAPS.length - 1)];
}

/**
 * Where a released drag settles.
 *
 * @param {object} drag
 * @param {number} drag.height sheet height at release, CSS px
 * @param {number} drag.velocity CSS px per ms, positive = upwards (taller)
 * @param {{ collapsed: number, half: number, full: number }} drag.heights
 * @returns {'collapsed'|'half'|'full'}
 */
export function pickSnap({ height, velocity, heights }) {
  if (velocity >= FLICK_VELOCITY) {
    return SNAPS.find((snap) => heights[snap] > height) ?? SNAPS[SNAPS.length - 1];
  }
  if (velocity <= -FLICK_VELOCITY) {
    return [...SNAPS].reverse().find((snap) => heights[snap] < height) ?? SNAPS[0];
  }
  return SNAPS.reduce((nearest, snap) =>
    Math.abs(heights[snap] - height) < Math.abs(heights[nearest] - height) ? snap : nearest,
  );
}
