// @ts-check
// Puts the candidates of several screens of one design together: a Figma component keeps one
// number on every screen, and the areas whose content differs from one screen to the next
// are pointed out. Reads no file and calls nothing.
import { toInstanceLetter } from "./collectCandidates.mjs"

/** @typedef {import("./figma.mjs").Box} Box */
/** @typedef {import("./collectCandidates.mjs").Candidate} Candidate */
/** @typedef {import("./collectCandidates.mjs").Instance} Instance */
/**
 * One use of a candidate, on one of the screens.
 * @typedef {Instance & { screen: number }} InstanceOnAScreen
 * `screen`: the number of the screen it is drawn on, from 1; `box` is in that screen's coordinates.
 */
/**
 * What a candidate directly holds on some screens.
 * @typedef {object} ContentOnScreens
 * @property {number[]} screens the screens where it holds exactly this
 * @property {string[]} holds the Figma names of the candidates directly inside it, sorted;
 *   empty when it holds none
 */
/**
 * @typedef {Omit<Candidate, "instances"> & {
 *   instances: InstanceOnAScreen[],
 *   contentsThatDiffer: ContentOnScreens[],
 * }} MergedCandidate
 * `contentsThatDiffer`: empty when the candidate holds the same candidates on every screen
 * it is on. Otherwise one item per different content: the developer has to choose between
 * one component with a prop and several components. Such a candidate must be judged.
 */

// In Figma, a layer's name often reads "Role — detail": "Group — setpoint".
const NAME_PART_SEPARATOR = " — "

/**
 * @param {Box} inner
 * @param {Box} outer
 */
function isBoxInside(inner, outer) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

/** @param {Box} box */
const measureArea = (box) => box.width * box.height

/**
 * An instance with what tells where it sits in its screen.
 * @typedef {object} PlacedInstance
 * @property {MergedCandidate} candidate
 * @property {InstanceOnAScreen} instance
 * @property {number} orderInTheScreen the number its candidate had on that screen alone:
 *   among candidates of one kind, a greater number comes later in the Figma tree
 */

/**
 * True when `inner` is drawn inside `outer`. Two instances with the same box are a wrapper
 * and its only child: a plain frame wraps a Figma component, and between two of the same
 * kind the child is the deeper one, or the one that comes later in the Figma tree.
 * @param {PlacedInstance} inner
 * @param {PlacedInstance} outer
 */
function isPlacedInside(inner, outer) {
  if (inner === outer || !isBoxInside(inner.instance.box, outer.instance.box))
    return false
  const innerArea = measureArea(inner.instance.box)
  const outerArea = measureArea(outer.instance.box)
  if (innerArea !== outerArea) return innerArea < outerArea
  if (inner.candidate.kind !== outer.candidate.kind)
    return inner.candidate.kind === "instance"
  if (inner.instance.level !== outer.instance.level)
    return inner.instance.level > outer.instance.level
  return inner.orderInTheScreen > outer.orderInTheScreen
}

/**
 * For each candidate, the names of the candidates directly inside it on one screen.
 * @param {PlacedInstance[]} placedOnTheScreen every instance drawn on that screen
 * @returns {Map<MergedCandidate, Set<string>>}
 */
function listDirectContents(placedOnTheScreen) {
  /** @type {Map<MergedCandidate, Set<string>>} */
  const namesByHolder = new Map()
  for (const holder of placedOnTheScreen) {
    const held = placedOnTheScreen.filter((each) =>
      isPlacedInside(each, holder),
    )
    const heldDirectly = held.filter(
      (each) => !held.some((other) => isPlacedInside(each, other)),
    )
    const names = namesByHolder.get(holder.candidate) ?? new Set()
    for (const { candidate } of heldDirectly) names.add(candidate.figmaName)
    namesByHolder.set(holder.candidate, names)
  }
  return namesByHolder
}

/**
 * @param {PlacedInstance[][]} placedByScreen the instances drawn on each screen
 */
function fillContentsThatDiffer(placedByScreen) {
  /** @type {Map<MergedCandidate, Map<string, number[]>>} */
  const screensByContentByCandidate = new Map()
  placedByScreen.forEach((placedOnTheScreen, screenIndex) => {
    const screen = screenIndex + 1
    for (const [candidate, names] of listDirectContents(placedOnTheScreen)) {
      const content = [...names].toSorted().join("\n")
      const screensByContent =
        screensByContentByCandidate.get(candidate) ?? new Map()
      screensByContent.set(content, [
        ...(screensByContent.get(content) ?? []),
        screen,
      ])
      screensByContentByCandidate.set(candidate, screensByContent)
    }
  })
  for (const [candidate, screensByContent] of screensByContentByCandidate) {
    if (screensByContent.size < 2) continue
    candidate.mustBeJudged = true
    candidate.contentsThatDiffer = [...screensByContent].map(
      ([content, screens]) => ({
        screens,
        holds: content ? content.split("\n") : [],
      }),
    )
  }
}

/**
 * @param {Candidate[][]} candidatesByScreen the candidates of each screen, in the order
 *   the screens are shown
 * @returns {MergedCandidate[]} numbered again: the Figma components first, then the frames,
 *   each in the order it is first met
 */
export function mergeScreenCandidates(candidatesByScreen) {
  /** @type {Map<string, { merged: MergedCandidate, origins: Candidate[] }>} */
  const groupsByKey = new Map()
  // On one screen, look-alike frames are one candidate named after what their names share
  // ("Group — dates" and "Group — setpoint" give "Group"). The same frame alone on another
  // screen joins that candidate.
  const namesOfFrameGroups = new Set(
    candidatesByScreen
      .flat()
      .filter((candidate) => candidate.kind === "frame")
      .map((candidate) => candidate.figmaName),
  )
  /** @param {Candidate} candidate */
  const nameAcrossScreens = (candidate) => {
    const [firstPartOfName] = candidate.figmaName.split(NAME_PART_SEPARATOR)
    return candidate.kind === "frame" && namesOfFrameGroups.has(firstPartOfName)
      ? firstPartOfName
      : candidate.figmaName
  }
  candidatesByScreen.forEach((candidates) => {
    for (const candidate of candidates) {
      const figmaName = nameAcrossScreens(candidate)
      const key = `${candidate.kind}\n${figmaName}`
      const group = groupsByKey.get(key) ?? {
        merged: {
          number: 0,
          kind: candidate.kind,
          mustBeJudged: false,
          figmaName,
          instances: [],
          icons: [],
          contentsThatDiffer: [],
        },
        origins: [],
      }
      group.merged.mustBeJudged ||= candidate.mustBeJudged
      group.merged.icons = [
        ...new Set([...group.merged.icons, ...candidate.icons]),
      ]
      group.origins.push(candidate)
      groupsByKey.set(key, group)
    }
  })

  const groups = [...groupsByKey.values()].toSorted(
    (a, b) =>
      Number(a.merged.kind === "frame") - Number(b.merged.kind === "frame"),
  )
  /** @type {Map<Candidate, number>} */
  const newNumbersByScreenCandidate = new Map()
  groups.forEach(({ merged, origins }, index) => {
    merged.number = index + 1
    for (const candidate of origins)
      newNumbersByScreenCandidate.set(candidate, merged.number)
  })
  /** @type {PlacedInstance[][]} */
  const placedByScreen = candidatesByScreen.map(() => [])
  candidatesByScreen.forEach((candidates, screenIndex) => {
    const candidatesByOldNumber = new Map(
      candidates.map((candidate) => [candidate.number, candidate]),
    )
    for (const candidate of candidates) {
      const group = groups.find(
        ({ merged }) =>
          merged.number === newNumbersByScreenCandidate.get(candidate),
      )
      if (!group) continue
      for (const instance of candidate.instances) {
        const parentCandidate =
          instance.parent === null
            ? undefined
            : candidatesByOldNumber.get(instance.parent)
        const instanceOnTheScreen = {
          ...instance,
          // A frame that joined a group keeps its own name as its variant, like the
          // frames grouped on one screen.
          variant:
            instance.variant ||
            (candidate.figmaName === group.merged.figmaName
              ? ""
              : candidate.figmaName),
          letter: toInstanceLetter(group.merged.instances.length),
          parent: parentCandidate
            ? (newNumbersByScreenCandidate.get(parentCandidate) ?? null)
            : null,
          screen: screenIndex + 1,
        }
        group.merged.instances.push(instanceOnTheScreen)
        placedByScreen[screenIndex].push({
          candidate: group.merged,
          instance: instanceOnTheScreen,
          orderInTheScreen: candidate.number,
        })
      }
    }
  })
  const mergedCandidates = groups.map(({ merged }) => merged)
  fillContentsThatDiffer(placedByScreen)
  return mergedCandidates
}
