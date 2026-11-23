// @ts-check
// Where the labels of a screen go, in the two columns beside its capture, and the line
// that joins each label to its component.
// Every coordinate is in pixels at scale 1, from the top-left corner of the screen.

/** @typedef {import("./figma.mjs").Box} Box */
/** @typedef {{ x: number, y: number }} Point */

export const LABEL_HEIGHT = 34
export const GAP_BETWEEN_LABELS = 8
// From a label's top down to the line that leaves it.
const LEADER_OFFSET_Y = 9
const LEADER_INSET = 12
const GAP_BETWEEN_LEADERS = 10
// A component wider than this share of the screen can have its label on either side.
const FULL_WIDTH_SHARE = 0.8

/**
 * Labels go to the column on the side of their component, in the component's vertical
 * order. A component as wide as the screen can go either side: it takes the emptier
 * column. Labels that would overlap are spread around the height of their components,
 * half upwards and half downwards, so that their lines stay short.
 * @template {{ anchor: Box }} Label
 * @param {Label[]} labels `anchor` is the box of the component the label points at
 * @param {number} screenWidth
 * @returns {(Label & { side: "left" | "right", top: number })[]}
 */
export function placeLabels(labels, screenWidth) {
  /** @param {Label} label */
  const centerX = (label) => label.anchor.x + label.anchor.width / 2
  /** @param {Label} label */
  const centerY = (label) => label.anchor.y + label.anchor.height / 2
  /** @param {Label} label */
  const isAsWideAsTheScreen = (label) =>
    label.anchor.width > screenWidth * FULL_WIDTH_SHARE
  /** @type {Record<"left" | "right", Label[]>} */
  const labelsBySide = { left: [], right: [] }
  for (const label of labels.filter((each) => !isAsWideAsTheScreen(each))) {
    labelsBySide[centerX(label) < screenWidth / 2 ? "left" : "right"].push(
      label,
    )
  }
  for (const label of labels
    .filter(isAsWideAsTheScreen)
    .toSorted((a, b) => centerY(a) - centerY(b))) {
    labelsBySide[
      labelsBySide.left.length < labelsBySide.right.length ? "left" : "right"
    ].push(label)
  }

  const step = LABEL_HEIGHT + GAP_BETWEEN_LABELS
  return /** @type {const} */ (["left", "right"]).flatMap((side) => {
    const labelsOfSide = labelsBySide[side].toSorted(
      (a, b) => centerY(a) - centerY(b),
    )
    const wishedTops = labelsOfSide.map(
      (label) => centerY(label) - LABEL_HEIGHT / 2,
    )
    /** @type {number[]} */
    const pushedDown = []
    for (const [index, top] of wishedTops.entries()) {
      pushedDown.push(index ? Math.max(top, pushedDown[index - 1] + step) : top)
    }
    /** @type {number[]} */
    const pushedUp = []
    for (const [index, top] of wishedTops.toReversed().entries()) {
      pushedUp.push(index ? Math.min(top, pushedUp[index - 1] - step) : top)
    }
    pushedUp.reverse()
    return labelsOfSide.map((label, index) => ({
      ...label,
      side,
      top: (pushedDown[index] + pushedUp[index]) / 2,
    }))
  })
}

/**
 * The line from each label to its component: straight when the label sits at the
 * component's height, otherwise horizontal then vertical, ending on the component's top
 * or bottom edge. Two vertical parts never share the same x.
 * @template {{ anchor: Box, side: "left" | "right", top: number }} Label
 * @param {Label[]} labels
 * @returns {(Label & { lineY: number, leaderCorner: Point | null, leaderEnd: Point })[]}
 * `lineY`: the height at which the line leaves the label.
 */
export function routeLeaders(labels) {
  /** @type {Record<"left" | "right", number[]>} */
  const verticalXsBySide = { left: [], right: [] }
  return labels
    .toSorted((a, b) => a.top - b.top)
    .map((label) => {
      const { x, y, width, height } = label.anchor
      const isLeft = label.side === "left"
      const lineY = label.top + LEADER_OFFSET_Y
      if (lineY >= y && lineY <= y + height) {
        const leaderEnd = { x: isLeft ? x : x + width, y: lineY }
        return { ...label, lineY, leaderCorner: null, leaderEnd }
      }
      const inset = Math.min(LEADER_INSET, width / 2)
      const towardsCenter = isLeft ? 1 : -1
      let verticalX = isLeft ? x + inset : x + width - inset
      /** @param {number} candidateX */
      const isTaken = (candidateX) =>
        verticalXsBySide[label.side].some(
          (takenX) => Math.abs(takenX - candidateX) < GAP_BETWEEN_LEADERS,
        )
      while (
        isTaken(verticalX) &&
        Math.abs(verticalX - (x + width / 2)) < width / 2 - GAP_BETWEEN_LEADERS
      ) {
        verticalX += towardsCenter * GAP_BETWEEN_LEADERS
      }
      verticalXsBySide[label.side].push(verticalX)
      return {
        ...label,
        lineY,
        leaderCorner: { x: verticalX, y: lineY },
        leaderEnd: { x: verticalX, y: lineY < y ? y : y + height },
      }
    })
}
