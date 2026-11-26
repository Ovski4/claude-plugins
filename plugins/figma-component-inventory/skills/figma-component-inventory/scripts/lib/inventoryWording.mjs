// @ts-check
// How inventory.html and inventory.md both name an inventory, its outlines and its screens,
// so that the page and the summary always say the same thing. The words come from the
// pages' dictionaries, through the `translate` of the language to write in.

import { translateForWrittenFiles } from "./languages.mjs"
import { listScreenNumbers } from "./mergeScreens.mjs"

/** @typedef {import("./verdicts.mjs").JudgedCandidate} JudgedCandidate */
/** @typedef {import("./verdicts.mjs").JudgedInstance} JudgedInstance */
/** @typedef {import("./languages.mjs").Translate} Translate */

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
    ? `${candidate.number} · ${nameScreens(listScreenNumbers(part.instances), translateForWrittenFiles)}`
    : part.instances
        .map((instance) => `${candidate.number}${instance.letter}`)
        .join(" ")
  return `${where} ${candidate.figmaName}`
}

/**
 * @param {number[]} screenNumbers
 * @param {Translate} translate
 * @returns {string} "écran 2", "écrans 1 4"
 */
export const nameScreens = (screenNumbers, translate) =>
  translate(screenNumbers.length > 1 ? "screens.several" : "screens.one", {
    numbers: screenNumbers.join(" "),
  })

const NAME_PART_SEPARATOR = " · "

/**
 * The names of the screens of one design, cut where they stop saying the same thing:
 * "Editor · Off" and "Editor · Period" share "Editor" and end with "Off" and "Period".
 * Each name keeps at least its last part for itself.
 * @param {string[]} names
 * @returns {{ sharedStart: string, ownEnds: string[] }} `sharedStart`: "" when the names share nothing
 */
function splitNamesAtSharedStart(names) {
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
  return {
    sharedStart: partsOfNames[0]
      .slice(0, sharedPartCount)
      .join(NAME_PART_SEPARATOR),
    ownEnds: partsOfNames.map((parts) =>
      parts.slice(sharedPartCount).join(NAME_PART_SEPARATOR),
    ),
  }
}

/**
 * The tab of each screen: its number, then what its name does not share with the others',
 * "1 · Off · Default" and "3 · Period · Default" for "Editor · Off · Default" and
 * "Editor · Period · Default".
 * @param {{ number: number, name: string }[]} screens
 * @returns {string[]} in the screens' order
 */
export function nameScreenTabs(screens) {
  const { ownEnds } = splitNamesAtSharedStart(
    screens.map((screen) => screen.name),
  )
  return screens.map((screen, index) => `${screen.number} · ${ownEnds[index]}`)
}

/**
 * The end of the line that says what a page is built on: the mock-up and the code.
 * @param {{ figma: { lastModified: string }, gitCommit: string }} fingerprint
 * @param {Translate} translate
 * @returns {string} "maquette modifiée le 2026-11-20 · commit 34ee98aa6"
 */
export const tellMockupAndCommit = ({ figma, gitCommit }, translate) =>
  translate("header.mockupAndCommit", {
    date: figma.lastModified.slice(0, 10),
    commit: gitCommit,
  })

/**
 * What the inventory is about, from its screens' names alone.
 * @param {{ name: string }[]} screens
 * @param {Translate} translate
 * @returns {string} the screen's name; for several screens what their names share,
 *   "Editor — regulation (6 écrans)", or "3 écrans d'un même design" when they share nothing
 */
export function titleInventory(screens, translate) {
  if (screens.length === 1) return screens[0].name
  const { sharedStart } = splitNamesAtSharedStart(
    screens.map((screen) => screen.name),
  )
  return translate(
    sharedStart
      ? "inventory.sharedNameOfScreens"
      : "inventory.screensOfOneDesign",
    { sharedStart, count: screens.length },
  )
}
