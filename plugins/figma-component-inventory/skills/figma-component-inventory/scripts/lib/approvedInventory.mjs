// @ts-check
// The inventory as the steps after it read it: candidates.json and verdicts.json of one
// output folder, accepted only when their format is the one the README promises
// ("What the next step reads") and the developer's approval still stands.
import fs from "node:fs"
import path from "node:path"
import {
  applyVerdictsToCandidates,
  listVerdictProblems,
  readStandingApprovalDate,
} from "./verdicts.mjs"

/** @typedef {import("./figma.mjs").CaptureLocation} CaptureLocation */
/** @typedef {import("./collectCandidates.mjs").ScreenText} ScreenText */
/** @typedef {import("./mergeScreens.mjs").MergedCandidate} Candidate */
/** @typedef {import("./verdicts.mjs").VerdictsFile} VerdictsFile */
/**
 * What the inventory was built on. A step that reads the inventory copies it into its own
 * deliverable, so that a change of the mock-up or of the code can be traced down to it.
 * @typedef {object} InventoryFingerprint
 * @property {string} createdAt the day candidates.json was written, "2026-11-23"
 * @property {{ fileKey: string, version: string, lastModified: string }} figma `version` changes each time the Figma file is saved
 * @property {string} gitCommit the commit of the judged repo
 */
/**
 * One Figma screen of the inventory.
 * @typedef {object} InventoryScreen
 * @property {number} number from 1, in the order the screens were given
 * @property {string} nodeId
 * @property {string} name the Figma frame's name
 * @property {number} width
 * @property {number} height
 * @property {CaptureLocation} capture the PNG's file name in the output folder, and the box it shows in the screen's coordinates
 * @property {string | null} backdrop the layer drawn behind a dialog, or null
 * @property {ScreenText[]} texts every text the screen shows
 */
/** @typedef {{ fingerprint: InventoryFingerprint, screens: InventoryScreen[], candidates: Candidate[] }} CandidatesFile */
/**
 * @typedef {object} ApprovedInventory
 * @property {InventoryFingerprint} fingerprint
 * @property {string} approvedOn the day the developer approved, "2026-11-23"
 * @property {InventoryScreen[]} screens
 * @property {import("./verdicts.mjs").JudgedCandidate[]} judgedCandidates every candidate with the verdict of each of its instances
 */

/** Thrown with every reason, one per line, why an inventory cannot be read by the next step. */
export class InventoryNotUsable extends Error {
  name = "InventoryNotUsable"
}

const isText = (/** @type {unknown} */ value) =>
  typeof value === "string" && value !== ""
const isBox = (/** @type {any} */ value) =>
  ["x", "y", "width", "height"].every((side) => Number.isFinite(value?.[side]))

/**
 * Where candidates.json departs from the format the README promises. An empty list means
 * every field a later step reads is there.
 * @param {any} candidatesFile candidates.json as parsed
 * @returns {string[]}
 */
export function listInventoryFormatProblems(candidatesFile) {
  /** @type {string[]} */
  const problems = []
  /**
   * @param {boolean} isAsPromised
   * @param {string} field
   * @param {string} expected
   */
  const expect = (isAsPromised, field, expected) => {
    if (!isAsPromised) problems.push(`${field} must be ${expected}`)
  }
  const { fingerprint, screens, candidates } = candidatesFile ?? {}

  expect(
    isText(fingerprint?.figma?.fileKey),
    "fingerprint.figma.fileKey",
    "the Figma file's key",
  )
  expect(
    isText(fingerprint?.figma?.version),
    "fingerprint.figma.version",
    "the Figma file's version",
  )
  expect(isText(fingerprint?.gitCommit), "fingerprint.gitCommit", "a commit")

  const screenList = Array.isArray(screens) ? screens : []
  expect(screenList.length > 0, "screens", "a list of at least one screen")
  screenList.forEach((screen, index) => {
    const field = `screens[${index}]`
    expect(Number.isInteger(screen?.number), `${field}.number`, "a number")
    expect(isText(screen?.nodeId), `${field}.nodeId`, "a Figma node id")
    expect(isText(screen?.name), `${field}.name`, "the frame's name")
    expect(
      isText(screen?.capture?.file) && isBox(screen.capture),
      `${field}.capture`,
      "a file name with x, y, width and height",
    )
    expect(
      Array.isArray(screen?.texts) &&
        screen.texts.every(
          (/** @type {any} */ text) =>
            isText(text?.nodeId) &&
            typeof text.characters === "string" &&
            isBox(text.box),
        ),
      `${field}.texts`,
      "a list of texts, each with nodeId, characters and box",
    )
  })
  const screenNumbers = new Set(screenList.map((screen) => screen?.number))

  expect(Array.isArray(candidates), "candidates", "a list")
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const field = `candidate ${candidate?.number}`
    expect(Number.isInteger(candidate?.number), `${field}: number`, "a number")
    expect(isText(candidate?.figmaName), `${field}: figmaName`, "a name")
    expect(
      ["instance", "frame"].includes(candidate?.kind),
      `${field}: kind`,
      '"instance" or "frame"',
    )
    expect(
      Array.isArray(candidate?.instances) &&
        candidate.instances.every(
          (/** @type {any} */ instance) =>
            isText(instance?.letter) &&
            isText(instance.nodeId) &&
            typeof instance.variant === "string" &&
            screenNumbers.has(instance.screen) &&
            isBox(instance.box),
        ),
      `${field}: instances`,
      "a list of instances, each with letter, nodeId, variant, box and the number of a listed screen",
    )
  }
  return problems
}

/**
 * The inventory a later step can build on, or `InventoryNotUsable` saying everything that
 * is wrong: a format that is not the promised one, verdicts that break their rules, an
 * approval that is missing or older than the verdicts.
 * @param {object} files
 * @param {any} files.candidatesFile candidates.json as parsed
 * @param {VerdictsFile} files.verdictsFile verdicts.json as parsed
 * @returns {ApprovedInventory}
 */
export function readApprovedInventory({ candidatesFile, verdictsFile }) {
  const formatProblems = listInventoryFormatProblems(candidatesFile)
  if (formatProblems.length) {
    throw new InventoryNotUsable(
      `candidates.json is not in the inventory's format:\n- ${formatProblems.join("\n- ")}`,
    )
  }
  const { fingerprint, screens, candidates } = /** @type {CandidatesFile} */ (
    candidatesFile
  )

  const verdictProblems = listVerdictProblems({
    candidates,
    figmaVersionOfCandidates: fingerprint.figma.version,
    verdictsFile,
    // The paths were checked when the developer approved. A file moved since then makes
    // the inventory out of date, which its fingerprint tells; its format is still right.
    doesCodePathExist: () => true,
  })
  if (verdictProblems.length) {
    throw new InventoryNotUsable(
      `verdicts.json breaks the inventory's rules:\n- ${verdictProblems.join("\n- ")}`,
    )
  }
  if (!verdictsFile.approval) {
    throw new InventoryNotUsable(
      "The developer has not approved this inventory: run render.mjs --approve once he agrees with the page.",
    )
  }
  const approvedOn = readStandingApprovalDate(verdictsFile)
  if (!approvedOn) {
    throw new InventoryNotUsable(
      `Verdicts changed after the developer's approval of ${verdictsFile.approval.date}: he has to approve the inventory again.`,
    )
  }
  return {
    fingerprint,
    approvedOn,
    screens,
    judgedCandidates: applyVerdictsToCandidates(
      candidates,
      verdictsFile.verdicts,
    ),
  }
}

/**
 * @param {string} outDir the inventory's output folder
 * @returns {ApprovedInventory}
 */
export function loadApprovedInventory(outDir) {
  /** @param {string} fileName */
  const readJson = (fileName) => {
    const file = path.join(outDir, fileName)
    if (!fs.existsSync(file)) {
      throw new InventoryNotUsable(
        `${file} is missing: this folder holds no inventory.`,
      )
    }
    return JSON.parse(fs.readFileSync(file, "utf8"))
  }
  return readApprovedInventory({
    candidatesFile: readJson("candidates.json"),
    verdictsFile: readJson("verdicts.json"),
  })
}
