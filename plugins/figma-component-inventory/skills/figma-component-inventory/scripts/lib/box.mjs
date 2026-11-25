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
 * True when `inner` lies within `outer` and the two boxes differ: two boxes of the same
 * place and size are neither inside the other.
 * @param {Box} inner
 * @param {Box} outer
 */
export const isBoxStrictlyInside = (inner, outer) =>
  isBoxInside(inner, outer) && !isBoxInside(outer, inner)

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

/**
 * The smallest box holding all the given ones.
 * @param {Box[]} boxes at least one
 * @returns {Box}
 */
export function surroundBoxes(boxes) {
  const x = Math.min(...boxes.map((box) => box.x))
  const y = Math.min(...boxes.map((box) => box.y))
  return {
    x,
    y,
    width: Math.max(...boxes.map((box) => box.x + box.width)) - x,
    height: Math.max(...boxes.map((box) => box.y + box.height)) - y,
  }
}

/**
 * The box with `margin` pixels added on every side.
 * @param {Box} box
 * @param {number} margin
 * @returns {Box}
 */
export const growBox = (box, margin) => ({
  x: box.x - margin,
  y: box.y - margin,
  width: box.width + 2 * margin,
  height: box.height + 2 * margin,
})
