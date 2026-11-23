// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import { mergeScreenCandidates } from "../scripts/lib/mergeScreens.mjs"
import { applyVerdictsToCandidates } from "../scripts/lib/verdicts.mjs"

/** @typedef {import("../scripts/lib/collectCandidates.mjs").Candidate} Candidate */

/**
 * @param {number} number
 * @param {"instance" | "frame"} kind
 * @param {string} figmaName
 * @param {[x: number, y: number, width: number, height: number]} box
 * @param {number | null} parent
 * @returns {Candidate}
 */
const buildCandidate = (
  number,
  kind,
  figmaName,
  [x, y, width, height],
  parent,
) => ({
  number,
  kind,
  mustBeJudged: kind === "instance",
  figmaName,
  instances: [
    {
      letter: "a",
      nodeId: `1:${number}`,
      variant: "",
      level: parent === null ? 1 : 2,
      box: { x, y, width, height },
      parent,
    },
  ],
  icons: [],
})

test("a component keeps one number on every screen, and a frame whose content differs must be judged", () => {
  // Same editor in two modes: the "Settings" frame holds a notice, then a field.
  const offScreen = [
    buildCandidate(1, "instance", "Editor", [0, 0, 400, 300], null),
    buildCandidate(2, "instance", "Notice", [20, 100, 360, 60], 1),
    buildCandidate(3, "frame", "Body", [20, 20, 360, 200], 1),
    buildCandidate(4, "frame", "Settings", [20, 100, 360, 60], 1),
  ]
  const continuousScreen = [
    buildCandidate(1, "instance", "Editor", [0, 0, 400, 340], null),
    buildCandidate(2, "instance", "Field", [20, 110, 150, 36], 1),
    buildCandidate(3, "frame", "Body", [20, 20, 360, 240], 1),
    buildCandidate(4, "frame", "Settings", [20, 100, 360, 100], 1),
  ]
  // On a third screen two look-alike frames were grouped as "Group": the lone
  // "Group — setpoint" of another screen joins them.
  const groupOnOneScreen = mergeScreenCandidates([
    [buildCandidate(1, "frame", "Group — setpoint", [0, 0, 100, 40], null)],
    [buildCandidate(1, "frame", "Group", [0, 0, 100, 40], null)],
  ])
  assert.deepEqual(
    groupOnOneScreen.map((candidate) => [
      candidate.figmaName,
      candidate.instances.map((instance) => instance.variant),
    ]),
    [["Group", ["Group — setpoint", ""]]],
  )

  const merged = mergeScreenCandidates([offScreen, continuousScreen])

  assert.deepEqual(
    merged.map((candidate) => [
      candidate.number,
      candidate.figmaName,
      candidate.mustBeJudged,
      candidate.instances.map(
        (instance) =>
          `${instance.letter}: screen ${instance.screen}, inside ${instance.parent}`,
      ),
      candidate.contentsThatDiffer,
    ]),
    [
      [
        1,
        "Editor",
        true,
        ["a: screen 1, inside null", "b: screen 2, inside null"],
        [],
      ],
      [2, "Notice", true, ["a: screen 1, inside 1"], []],
      [3, "Field", true, ["a: screen 2, inside 1"], []],
      [
        4,
        "Body",
        false,
        ["a: screen 1, inside 1", "b: screen 2, inside 1"],
        [],
      ],
      [
        5,
        "Settings",
        true,
        ["a: screen 1, inside 1", "b: screen 2, inside 1"],
        [
          { screens: [1], holds: ["Notice"] },
          { screens: [2], holds: ["Field"] },
        ],
      ],
    ],
  )

  const [judgedSettings] = applyVerdictsToCandidates(merged, [
    {
      number: 5,
      figmaName: "Settings",
      verdict: "to-create",
      codeComponent: "OrderSettings",
      note: "Un composant par mode.",
      except: [{ screens: [1], codeComponent: "OrderOffNotice" }],
    },
  ])
  assert.deepEqual(
    judgedSettings.instances.map((instance) => instance.codeComponent),
    ["OrderOffNotice", "OrderSettings"],
  )
})
