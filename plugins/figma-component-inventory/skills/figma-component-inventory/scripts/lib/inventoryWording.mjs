// @ts-check
// The French words that inventory.html and inventory.md both use to name an inventory, its outlines and
// its screens, so that the page and the summary always say the same thing.

import { listScreenNumbers } from "./mergeScreens.mjs"

/** @typedef {import("./verdicts.mjs").JudgedCandidate} JudgedCandidate */
/** @typedef {import("./verdicts.mjs").JudgedInstance} JudgedInstance */

/**
 * What an outline's badge says: "6", or "6b" when the candidate has several instances.
 * @param {JudgedCandidate} candidate
 * @param {JudgedInstance} instance
 */
export function nameOutline(candidate, instance) {
  return candidate.instances.length > 1
    ? `${candidate.number}${instance.letter}`
    : `${candidate.number}`
}

/**
 * "6" when the instances are the whole candidate, "6a 6b" otherwise.
 * @param {JudgedCandidate} candidate
 * @param {JudgedInstance[]} instances
 */
export function nameOutlines(candidate, instances) {
  if (instances.length === candidate.instances.length)
    return `${candidate.number}`
  return instances.map((instance) => nameOutline(candidate, instance)).join(" ")
}

/**
 * The instances of a candidate that have no outline: "17 · écrans 1 4 Mode settings", or
 * "6a 6b Segment" when they are named by letter.
 * @param {JudgedCandidate} candidate
 * @param {import("./verdicts.mjs").PartNotOutlined} part
 */
export function namePartNotOutlined(candidate, part) {
  const where = part.isNamedByScreens
    ? `${candidate.number} · ${nameScreens(listScreenNumbers(part.instances))}`
    : part.instances
        .map((instance) => `${candidate.number}${instance.letter}`)
        .join(" ")
  return `${where} ${candidate.figmaName}`
}

/** @param {number[]} screenNumbers "écran 2", "écrans 1 4" */
export function nameScreens(screenNumbers) {
  return `écran${screenNumbers.length > 1 ? "s" : ""} ${screenNumbers.join(" ")}`
}

/**
 * @param {{ name: string }[]} screens
 * @returns {string} the screen's name, or "3 écrans d'un même design"
 */
export function titleInventory(screens) {
  return screens.length > 1
    ? `${screens.length} écrans d'un même design`
    : screens[0].name
}
