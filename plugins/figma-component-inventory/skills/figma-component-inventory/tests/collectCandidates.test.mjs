// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  collectCandidates,
  findCommonName,
  toInstanceLetter,
} from "../scripts/lib/collectCandidates.mjs"

/** @typedef {import("../scripts/lib/figma.mjs").FigmaNode} FigmaNode */

// The screen of every test sits at (1000, 500) on the Figma page and is 400 × 300.
const SCREEN_X = 1000
const SCREEN_Y = 500

/**
 * A Figma node whose box is given from the screen's top-left corner.
 * @param {string} type
 * @param {string} name
 * @param {[x: number, y: number, width: number, height: number]} box
 * @param {Partial<FigmaNode>} [more]
 * @returns {FigmaNode}
 */
function buildNode(type, name, [x, y, width, height], more = {}) {
  const id = `${type}:${name}:${x}:${y}`
  return {
    id,
    name,
    type,
    absoluteBoundingBox: { x: SCREEN_X + x, y: SCREEN_Y + y, width, height },
    ...more,
  }
}
/** @param {FigmaNode[]} children */
const buildScreen = (children) =>
  buildNode("FRAME", "Screen", [0, 0, 400, 300], { children })

const componentsById = {
  "button-primary": { name: "Style=Primary", componentSetId: "button-set" },
  "button-ghost": { name: "Style=Ghost", componentSetId: "button-set" },
  card: { name: "Card" },
  "icon-pen": { name: "ic/pen/16" },
}
const componentSetsById = { "button-set": { name: "Button" } }

test("the variants of a component are one candidate, lettered in reading order, with level and parent", () => {
  const screen = buildScreen([
    buildNode("INSTANCE", "Card", [0, 0, 400, 100], {
      componentId: "card",
      children: [
        buildNode("INSTANCE", "Cancel", [200, 60, 80, 32], {
          componentId: "button-ghost",
        }),
        buildNode("INSTANCE", "Save", [20, 60, 80, 32], {
          componentId: "button-primary",
          children: [
            buildNode("INSTANCE", "pen", [24, 68, 16, 16], {
              componentId: "icon-pen",
            }),
          ],
        }),
      ],
    }),
  ])

  const { candidates, backdrop } = collectCandidates(
    screen,
    componentsById,
    componentSetsById,
  )

  assert.equal(backdrop, null)
  assert.deepEqual(candidates, [
    {
      number: 1,
      kind: "instance",
      mustBeJudged: true,
      figmaName: "Card",
      componentKey: "card",
      instances: [
        {
          letter: "a",
          nodeId: "INSTANCE:Card:0:0",
          variant: "",
          level: 1,
          box: { x: 0, y: 0, width: 400, height: 100 },
          parent: null,
          icons: [],
        },
      ],
      icons: [],
    },
    {
      number: 2,
      kind: "instance",
      mustBeJudged: true,
      figmaName: "Button",
      componentKey: "button-set",
      instances: [
        {
          letter: "a",
          nodeId: "INSTANCE:Save:20:60",
          variant: "Style=Primary",
          level: 2,
          box: { x: 20, y: 60, width: 80, height: 32 },
          parent: 1,
          // The use that holds the icon names it: what tells it from the other button.
          icons: ["ic/pen/16"],
        },
        {
          letter: "b",
          nodeId: "INSTANCE:Cancel:200:60",
          variant: "Style=Ghost",
          level: 2,
          box: { x: 200, y: 60, width: 80, height: 32 },
          parent: 1,
          icons: [],
        },
      ],
      // An icon is listed in the component that holds it and is never a candidate.
      icons: ["ic/pen/16"],
    },
  ])
})

test("what the screen does not show is left out: hidden layers, rows scrolled out of a list", () => {
  const screen = buildScreen([
    buildNode("INSTANCE", "Hidden card", [0, 0, 400, 50], {
      componentId: "card",
      visible: false,
    }),
    buildNode("FRAME", "List", [0, 100, 400, 100], {
      clipsContent: true,
      children: [
        buildNode("INSTANCE", "Half shown", [0, 180, 80, 32], {
          componentId: "button-primary",
        }),
        buildNode("INSTANCE", "Scrolled out", [0, 220, 80, 32], {
          componentId: "button-primary",
        }),
      ],
    }),
  ])

  const { candidates } = collectCandidates(
    screen,
    componentsById,
    componentSetsById,
  )

  assert.deepEqual(
    candidates.map((candidate) => [
      candidate.figmaName,
      candidate.instances.map((instance) => instance.box),
    ]),
    [
      ["Button", [{ x: 0, y: 180, width: 80, height: 20 }]],
      ["List", [{ x: 0, y: 100, width: 400, height: 100 }]],
    ],
  )
})

test("with a backdrop covering the screen, only the layers in front of it give candidates", () => {
  const screen = buildScreen([
    buildNode("INSTANCE", "Page card", [0, 0, 400, 100], {
      componentId: "card",
    }),
    buildNode("RECTANGLE", "Scrim — modal", [0, 0, 400, 300]),
    buildNode("FRAME", "Dialog", [100, 50, 200, 200], {
      children: [
        buildNode("INSTANCE", "Save", [120, 200, 80, 32], {
          componentId: "button-primary",
        }),
      ],
    }),
  ])

  const { candidates, backdrop } = collectCandidates(
    screen,
    componentsById,
    componentSetsById,
  )

  assert.equal(backdrop, "Scrim — modal")
  assert.deepEqual(
    candidates.map((candidate) => candidate.figmaName),
    ["Button", "Dialog"],
  )
})

test("sibling frames built the same way are one candidate that must be judged; a lone frame is optional", () => {
  /** @param {string} day @param {number} y */
  const buildDayRow = (day, y) =>
    buildNode("FRAME", `Day — ${day}`, [0, y, 400, 40], {
      children: [buildNode("TEXT", day, [0, y, 40, 40])],
    })
  const screen = buildScreen([
    buildNode("FRAME", "Days", [0, 0, 400, 120], {
      children: [
        buildDayRow("Mon", 0),
        buildDayRow("Tue", 40),
        buildDayRow("Wed · hover", 80),
      ],
    }),
  ])

  const { candidates, texts } = collectCandidates(
    screen,
    componentsById,
    componentSetsById,
  )

  assert.deepEqual(
    texts.map(({ box }) => box),
    [
      { x: 0, y: 0, width: 40, height: 40 },
      { x: 0, y: 40, width: 40, height: 40 },
      { x: 0, y: 80, width: 40, height: 40 },
    ],
  )
  assert.deepEqual(
    candidates.map(({ figmaName, kind, mustBeJudged, instances }) => ({
      figmaName,
      kind,
      mustBeJudged,
      variants: instances.map((instance) => instance.variant),
    })),
    [
      { figmaName: "Days", kind: "frame", mustBeJudged: false, variants: [""] },
      {
        figmaName: "Day",
        kind: "frame",
        mustBeJudged: true,
        variants: ["Day — Mon", "Day — Tue", "Day — Wed · hover"],
      },
    ],
  )
})

test("names and letters of grouped uses", () => {
  assert.equal(findCommonName(["Day — Mon", "Day — Wed · hover"]), "Day")
  assert.equal(findCommonName(["Header", "Footer"]), "Header")
  assert.deepEqual([0, 25, 26, 27].map(toInstanceLetter), [
    "a",
    "z",
    "a1",
    "b1",
  ])
})
