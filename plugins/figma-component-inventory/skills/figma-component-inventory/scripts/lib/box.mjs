// @ts-check
// Comparisons between boxes, in pixels at scale 1 from the top-left corner of one screen.

/** @typedef {import("./figma.mjs").Box} Box */

/**
 * True when `inner` lies within `outer`; a box sharing an edge with `outer` is inside it.
 * @param {Box} inner
 * @param {Box} outer
 */
export function isBoxInside(inner, outer) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

/**
 * The box alone, without the other fields of the object that holds it.
 * @param {Box} box
 * @returns {Box}
 */
export function pickBox({ x, y, width, height }) {
  return { x, y, width, height }
}

/** @param {Box} box */
export const measureArea = (box) => box.width * box.height
