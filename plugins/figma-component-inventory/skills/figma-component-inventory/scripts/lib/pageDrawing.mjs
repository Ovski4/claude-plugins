// @ts-check
// Works out everything inventory.html draws: where each outline, label and line goes, which
// components are the same on every screen, which texts no sub-component holds. The page
// itself only draws these coordinates and answers clicks.
// Every coordinate is in pixels at scale 1, from the top-left corner of its own screen.

import { isBoxInside, measureArea, pickBox } from "./box.mjs"
import {
  nameOutline,
  nameOutlines,
  namePartNotOutlined,
  nameScreens,
  titleInventory,
} from "./inventoryWording.mjs"
import {
  GAP_BETWEEN_LABELS,
  LABEL_HEIGHT,
  placeLabels,
  routeLeaders,
} from "./labelPlacement.mjs"
import { listScreenNumbers } from "./mergeScreens.mjs"
import { groupByJudgement, VERDICTS } from "./verdicts.mjs"

/** @typedef {import("./figma.mjs").Box} Box */
/** @typedef {import("./collectCandidates.mjs").ScreenText} ScreenText */
/** @typedef {import("./verdicts.mjs").JudgedCandidate} JudgedCandidate */
/** @typedef {import("./verdicts.mjs").JudgedInstance} JudgedInstance */
/** @typedef {import("./verdicts.mjs").VerdictKey} VerdictKey */
/** @typedef {{ left: number, top: number, width: number, height: number }} DrawingBox */
/** @typedef {import("./labelPlacement.mjs").Point} Point */

/**
 * A screen as render.mjs hands it over.
 * @typedef {object} ScreenToDraw
 * @property {number} number
 * @property {string} name
 * @property {number} width the screen's own width, which the capture may exceed (shadows)
 * @property {Box} capture where the capture image sits
 * @property {ScreenText[]} [texts]
 * @property {string} figmaUrl
 * @property {string} captureDataUrl
 */
/**
 * What every drawn thing about a candidate carries: the page colours it by `verdict`,
 * fades it with the "differences only" switch when `isSameOnEveryScreen`, and isolates
 * everything that shares a `candidateNumber` on a click.
 * @typedef {object} DrawnCandidatePart
 * @property {number} candidateNumber
 * @property {VerdictKey} verdict
 * @property {boolean} isSameOnEveryScreen
 */
/**
 * @typedef {DrawnCandidatePart & {
 *   id: string,
 *   box: Box,
 *   isThickEnoughToOutline: boolean,
 *   badgeWidth: number,
 * }} DrawnOutline
 * `id`: what the badge says, "6" or "6b" when the candidate has several instances.
 * `isThickEnoughToOutline`: false for a 1 px divider, whose outline would hide it; it
 * keeps its badge and its label.
 */
/**
 * @typedef {DrawnCandidatePart & {
 *   title: string,
 *   detail: string,
 *   textX: number,
 *   textAnchor: "start" | "end",
 *   titleY: number,
 *   detailY: number,
 *   leaderPoints: Point[],
 * }} DrawnLabel
 * `leaderPoints`: the line from the label to its component, which ends on the last point.
 */
/**
 * A text no sub-component holds.
 * @typedef {object} DrawnLooseText
 * @property {Box} box
 * @property {string} characters what it says
 * @property {string} tag "→ 1": the only component around it; "?" when there is none
 * @property {number} tagWidth
 */
/**
 * @typedef {Pick<ScreenToDraw, "number" | "capture" | "figmaUrl" | "captureDataUrl"> & {
 *   linkText: string,
 *   tabName: string,
 *   ownBox: DrawingBox,
 *   outlines: DrawnOutline[],
 *   labels: DrawnLabel[],
 *   looseTexts: DrawnLooseText[],
 * }} DrawnScreen
 * `ownBox`: what holds the capture and its labels.
 * `outlines`: from the outermost component to the innermost.
 */
/**
 * Under the images: why a component is not simply reused.
 * @typedef {DrawnCandidatePart & {
 *   title: string,
 *   screens: number[],
 *   reason: string | null,
 *   developerDecision: string | null,
 *   question: string | null,
 * }} DrawnExplanation
 * `screens`: the numbers of the screens where what it explains is drawn.
 * `developerDecision`: null when the model judged; "" when the developer decided without a sentence.
 */
/**
 * @typedef {object} PageDrawing
 * @property {string} title
 * @property {string} fingerprintLine when the inventory was built, on which mock-up and which commit
 * @property {number} badgeHeight
 * @property {DrawnScreen[]} screens
 * @property {DrawingBox} commonBox what holds every screen's drawing: shown one at a time
 *   in this box, the screens' top-left corners coincide
 * @property {DrawnExplanation[]} explanations
 * @property {string[]} notOutlined one sentence per Figma component that is not a React component of its own
 */

// Wider than the page's fonts draw an average character (13 px semi-bold title, 11 px
// detail): a label column is never narrower than its longest label.
const LABEL_TITLE_CHARACTER_WIDTH = 7.8
const LABEL_DETAIL_CHARACTER_WIDTH = 6.2
const GAP_BETWEEN_CAPTURE_AND_LABELS = 28
const GAP_BETWEEN_LABEL_TEXT_AND_LEADER = 6
const LABEL_TITLE_OFFSET_Y = 4
const LABEL_DETAIL_OFFSET_Y = 15
const BADGE_HEIGHT = 13
const BADGE_CHARACTER_WIDTH = 6.5
const BADGE_PADDING_X = 4
const MIN_OUTLINED_THICKNESS = 4
const NAME_PART_SEPARATOR = " · "

/** @param {string} badgeText */
const measureBadge = (badgeText) =>
  badgeText.length * BADGE_CHARACTER_WIDTH + BADGE_PADDING_X * 2

/**
 * A candidate is the same on every screen when it is drawn on each of them, holds the same
 * candidates and gets the same verdict and React component everywhere.
 * @param {JudgedCandidate[]} judgedCandidates
 * @param {number[]} screenNumbers
 * @returns {Set<number>} the numbers of those candidates; empty with a single screen
 */
function listNumbersSameOnEveryScreen(judgedCandidates, screenNumbers) {
  if (screenNumbers.length < 2) return new Set()
  /** @param {JudgedCandidate} candidate */
  const isSame = (candidate) => {
    const judgementsByScreen = screenNumbers.map((screenNumber) =>
      groupByJudgement(
        candidate.instances.filter(
          (instance) => instance.screen === screenNumber,
        ),
      )
        .map(([{ verdict, codeComponent }]) => `${verdict} ${codeComponent}`)
        .toSorted()
        .join(" + "),
    )
    return (
      candidate.contentsThatDiffer.length === 0 &&
      judgementsByScreen.every(
        (judgements) =>
          judgements !== "" && judgements === judgementsByScreen[0],
      )
    )
  }
  return new Set(
    judgedCandidates.filter(isSame).map((candidate) => candidate.number),
  )
}

/**
 * What the screens' names share is left out of the tabs: "Editor · Off" and
 * "Editor · Period" give "Off" and "Period".
 * @param {string[]} names
 */
export function shortenScreenNames(names) {
  const partsOfNames = names.map((name) => name.split(NAME_PART_SEPARATOR))
  let sharedPartCount = 0
  while (
    partsOfNames.every((parts) => parts.length > sharedPartCount + 1) &&
    partsOfNames.every(
      (parts) => parts[sharedPartCount] === partsOfNames[0][sharedPartCount],
    )
  ) {
    sharedPartCount += 1
  }
  return partsOfNames.map((parts) =>
    parts.slice(sharedPartCount).join(NAME_PART_SEPARATOR),
  )
}

/**
 * A text is "loose" when no sub-component holds it: the smallest outlined component around
 * it is the screen's outermost one (the dialog, the page), or there is none. A loose text
 * may be a label or a help text that deserves a component, or a prop of the component
 * next to it.
 * @param {ScreenText[]} texts
 * @param {{ candidateNumber: number, box: Box }[]} outlines
 * @returns {DrawnLooseText[]}
 */
export function findLooseTexts(texts, outlines) {
  /** @param {{ box: Box }} outline */
  const isInsideAnother = (outline) =>
    outlines.some(
      (other) =>
        other !== outline &&
        measureArea(other.box) > measureArea(outline.box) &&
        isBoxInside(outline.box, other.box),
    )
  return texts.flatMap((text) => {
    const [owner] = outlines
      .filter((outline) => isBoxInside(text.box, outline.box))
      .toSorted((a, b) => measureArea(a.box) - measureArea(b.box))
    if (owner && isInsideAnother(owner)) return []
    const tag = owner ? `→ ${owner.candidateNumber}` : "?"
    return [
      {
        box: text.box,
        characters: text.characters,
        tag,
        tagWidth: measureBadge(tag),
      },
    ]
  })
}

/**
 * @param {ScreenToDraw} screen
 * @param {object} context
 * @param {JudgedCandidate[]} context.outlinedCandidates
 * @param {(candidate: JudgedCandidate, verdict: VerdictKey) => DrawnCandidatePart} context.buildPart
 * @returns {Pick<DrawnScreen, "ownBox" | "outlines" | "labels" | "looseTexts">}
 */
function drawScreen(screen, { outlinedCandidates, buildPart }) {
  const candidatesOnScreen = outlinedCandidates
    .map((candidate) => ({
      ...candidate,
      instances: candidate.instances.filter(
        (instance) => instance.screen === screen.number,
      ),
    }))
    .filter((candidate) => candidate.instances.length)
  // One label per candidate and verdict: the instances that an exception judges
  // differently get a label of their own.
  const labelsToPlace = candidatesOnScreen.flatMap((candidate) =>
    groupByJudgement(candidate.instances).map((instances) => {
      const [{ verdict, codeComponent, box }] = instances
      const instanceCount = instances.length > 1 ? ` ×${instances.length}` : ""
      return {
        ...buildPart(candidate, verdict),
        anchor: box,
        title: `${nameOutlines(candidate, instances)}  ${codeComponent ?? "?"}`,
        detail: `${candidate.figmaName}${instanceCount} · ${VERDICTS[verdict].label}`,
      }
    }),
  )
  const routedLabels = routeLeaders(placeLabels(labelsToPlace, screen.width))
  const labels = routedLabels.map(
    ({ anchor, side, top, lineY, leaderCorner, leaderEnd, ...label }) => {
      const isLeft = side === "left"
      const captureEdge = isLeft
        ? screen.capture.x
        : screen.capture.x + screen.capture.width
      const towardsLabels = isLeft ? -1 : 1
      const textX = captureEdge + towardsLabels * GAP_BETWEEN_CAPTURE_AND_LABELS
      const titleY = lineY + LABEL_TITLE_OFFSET_Y
      return {
        ...label,
        textX,
        textAnchor: /** @type {"start" | "end"} */ (isLeft ? "end" : "start"),
        titleY,
        detailY: titleY + LABEL_DETAIL_OFFSET_Y,
        leaderPoints: [
          {
            x: textX - towardsLabels * GAP_BETWEEN_LABEL_TEXT_AND_LEADER,
            y: lineY,
          },
          ...(leaderCorner ? [leaderCorner] : []),
          leaderEnd,
        ],
      }
    },
  )

  // Outer ones first, so that the outline of what is inside stays on top. A frame with the
  // same box as a Figma component is the wrapper around it.
  const outlines = candidatesOnScreen
    .flatMap((candidate) =>
      candidate.instances.map((instance) => ({ candidate, instance })),
    )
    .toSorted(
      (a, b) =>
        measureArea(b.instance.box) - measureArea(a.instance.box) ||
        Number(a.candidate.kind === "instance") -
          Number(b.candidate.kind === "instance") ||
        a.instance.level - b.instance.level,
    )
    .map(({ candidate, instance }) => {
      const id = nameOutline(candidate, instance)
      const { width, height } = instance.box
      return {
        ...buildPart(candidate, instance.verdict),
        id,
        box: instance.box,
        isThickEnoughToOutline:
          Math.min(width, height) >= MIN_OUTLINED_THICKNESS,
        badgeWidth: measureBadge(id),
      }
    })

  const labelTops = routedLabels.map((label) => label.top)
  const captureBottom = screen.capture.y + screen.capture.height
  // Each side of the capture is as wide as its longest label; nothing on a side with none.
  /** @param {"left" | "right"} side */
  const measureLabelColumn = (side) => {
    const labelWidths = routedLabels
      .filter((label) => label.side === side)
      .map(({ title, detail }) =>
        Math.max(
          title.length * LABEL_TITLE_CHARACTER_WIDTH,
          detail.length * LABEL_DETAIL_CHARACTER_WIDTH,
        ),
      )
    return labelWidths.length
      ? GAP_BETWEEN_CAPTURE_AND_LABELS + Math.ceil(Math.max(...labelWidths))
      : 0
  }
  const leftLabelColumn = measureLabelColumn("left")
  const top = Math.min(
    screen.capture.y - BADGE_HEIGHT,
    ...labelTops.map((labelTop) => labelTop - GAP_BETWEEN_LABELS),
  )
  const bottom = Math.max(
    captureBottom,
    ...labelTops.map((labelTop) => labelTop + LABEL_HEIGHT),
  )
  return {
    ownBox: {
      left: screen.capture.x - leftLabelColumn,
      top,
      width:
        leftLabelColumn + screen.capture.width + measureLabelColumn("right"),
      height: bottom - top + GAP_BETWEEN_LABELS,
    },
    outlines,
    labels,
    looseTexts: findLooseTexts(screen.texts ?? [], outlines),
  }
}

/** @param {DrawingBox[]} boxes */
function findCommonBox(boxes) {
  const left = Math.min(...boxes.map((box) => box.left))
  const top = Math.min(...boxes.map((box) => box.top))
  return {
    left,
    top,
    width: Math.max(...boxes.map((box) => box.left + box.width)) - left,
    height: Math.max(...boxes.map((box) => box.top + box.height)) - top,
  }
}

/**
 * "17 · écrans 1 4" when the instances are everything the candidate has on those screens,
 * "6a 6b" otherwise.
 * @param {JudgedCandidate} candidate
 * @param {JudgedInstance[]} instances
 * @param {boolean} hasSeveralScreens
 */
function nameInstances(candidate, instances, hasSeveralScreens) {
  if (instances.length === candidate.instances.length)
    return `${candidate.number}`
  const screenNumbers = listScreenNumbers(instances)
  const coversWholeScreens =
    candidate.instances.filter((instance) =>
      screenNumbers.includes(instance.screen),
    ).length === instances.length
  return hasSeveralScreens && coversWholeScreens
    ? `${candidate.number} · ${nameScreens(screenNumbers)}`
    : nameOutlines(candidate, instances)
}

/**
 * @param {object} inventory
 * @param {ScreenToDraw[]} inventory.screens
 * @param {JudgedCandidate[]} inventory.judgedCandidates
 * @param {import("./inventorySummary.mjs").Fingerprint} inventory.fingerprint
 * @returns {PageDrawing} texts in French, as the page shows them
 */
export function buildPageDrawing({ screens, judgedCandidates, fingerprint }) {
  const hasSeveralScreens = screens.length > 1
  const numbersSameOnEveryScreen = listNumbersSameOnEveryScreen(
    judgedCandidates,
    screens.map((screen) => screen.number),
  )
  const outlinedCandidates = judgedCandidates.filter(
    (candidate) => candidate.outlined,
  )
  /**
   * @param {JudgedCandidate} candidate
   * @param {VerdictKey} verdict
   * @returns {DrawnCandidatePart}
   */
  const buildPart = (candidate, verdict) => ({
    candidateNumber: candidate.number,
    verdict,
    isSameOnEveryScreen: numbersSameOnEveryScreen.has(candidate.number),
  })
  const shortNames = shortenScreenNames(screens.map((screen) => screen.name))
  const drawnScreens = screens.map((screen, screenIndex) => ({
    number: screen.number,
    capture: pickBox(screen.capture),
    figmaUrl: screen.figmaUrl,
    captureDataUrl: screen.captureDataUrl,
    linkText: hasSeveralScreens
      ? `Écran ${screen.number} — ${screen.name}`
      : "Ouvrir dans Figma",
    tabName: `${screen.number} · ${shortNames[screenIndex]}`,
    ...drawScreen(screen, { outlinedCandidates, buildPart }),
  }))

  const explanations = outlinedCandidates.flatMap((candidate) =>
    groupByJudgement(candidate.instances).flatMap((instances) => {
      const [
        { verdict, codeComponent, developerDecision, note, question, options },
      ] = instances
      const reason = verdict === "reused" ? null : note
      if (!reason && developerDecision === null) return []
      const name = nameInstances(candidate, instances, hasSeveralScreens)
      return [
        {
          ...buildPart(candidate, verdict),
          title: `${name} ${codeComponent ?? candidate.figmaName} — ${VERDICTS[verdict].label}`,
          screens: listScreenNumbers(instances),
          reason,
          developerDecision,
          question:
            verdict === "to-decide"
              ? `${question} ${(options ?? []).join(" / ")}`
              : null,
        },
      ]
    }),
  )

  return {
    title: titleInventory(screens),
    fingerprintLine: `Construit le ${fingerprint.createdAt} · maquette modifiée le ${fingerprint.figma.lastModified.slice(0, 10)} · commit ${fingerprint.gitCommit}`,
    badgeHeight: BADGE_HEIGHT,
    screens: drawnScreens,
    commonBox: findCommonBox(drawnScreens.map((screen) => screen.ownBox)),
    explanations,
    notOutlined: judgedCandidates.flatMap((candidate) =>
      candidate.outlined
        ? candidate.partsNotOutlined.map(
            (part) => `${namePartNotOutlined(candidate, part)} (${part.note})`,
          )
        : [`${candidate.number} ${candidate.figmaName} (${candidate.note})`],
    ),
  }
}
