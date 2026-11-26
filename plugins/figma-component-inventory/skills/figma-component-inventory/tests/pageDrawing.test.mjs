// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import { nameScreenTabs } from "../scripts/lib/inventoryWording.mjs"
import { placeLabels } from "../scripts/lib/labelPlacement.mjs"
import {
  buildPageDrawing,
  findLooseTexts,
} from "../scripts/lib/pageDrawing.mjs"

/** @typedef {import("../scripts/lib/verdicts.mjs").JudgedCandidate} JudgedCandidate */
/** @typedef {[x: number, y: number, width: number, height: number]} BoxValues */

/** @param {BoxValues} values */
const buildBox = ([x, y, width, height]) => ({ x, y, width, height })

/**
 * A candidate judged the same way on each screen it is on, unless `codeComponentByScreen`
 * names another React component for a screen.
 * @param {number} number
 * @param {string} figmaName
 * @param {{ screen: number, level: number, box: BoxValues }[]} instances
 * @param {Partial<JudgedCandidate> & { codeComponentByScreen?: Record<number, string> }} [judgement]
 * @returns {JudgedCandidate}
 */
function buildJudgedCandidate(
  number,
  figmaName,
  instances,
  { codeComponentByScreen = {}, ...judgement } = {},
) {
  return {
    number,
    kind: "instance",
    mustBeJudged: true,
    figmaName,
    componentKey: null,
    icons: [],
    contentsThatDiffer: [],
    outlined: true,
    partsNotOutlined: [],
    verdict: "reused",
    ...judgement,
    instances: instances.map(({ screen, level, box }, index) => ({
      letter: "ab"[index],
      nodeId: `${screen}:${number}`,
      variant: "",
      level,
      box: buildBox(box),
      parent: level === 1 ? null : 1,
      screen,
      verdict: judgement.verdict ?? "reused",
      codeComponent: codeComponentByScreen[screen] ?? figmaName,
      codePath: null,
      note: judgement.note ?? null,
      question: null,
      options: null,
      developerDecision: null,
    })),
  }
}

test("a text is loose when the only component around it is the outermost one, or none", () => {
  const outlines = [
    { candidateNumber: 1, box: buildBox([0, 0, 400, 300]) },
    { candidateNumber: 2, box: buildBox([20, 100, 360, 80]) },
  ]
  /** @param {string} characters @param {BoxValues} box */
  const buildText = (characters, box) => ({
    nodeId: characters,
    characters,
    box: buildBox(box),
  })

  const looseTexts = findLooseTexts(
    [
      buildText("Mode", [20, 40, 60, 16]),
      buildText("Setpoint", [24, 104, 80, 16]),
      buildText("Footnote", [0, 320, 90, 16]),
    ],
    outlines,
  )

  assert.deepEqual(
    looseTexts.map(({ characters, tag }) => [characters, tag]),
    [
      ["Mode", "→ 1"],
      ["Footnote", "?"],
    ],
  )
})

test("labels go to the side of their component and never overlap", () => {
  const LABEL_HEIGHT = 34
  /** @param {string} name @param {BoxValues} box */
  const buildLabel = (name, box) => ({ name, anchor: buildBox(box) })

  const placed = placeLabels(
    [
      buildLabel("icon 1", [300, 20, 24, 24]),
      buildLabel("icon 2", [330, 20, 24, 24]),
      buildLabel("icon 3", [360, 20, 24, 24]),
      buildLabel("title", [20, 20, 100, 24]),
      buildLabel("divider", [0, 60, 400, 1]),
    ],
    400,
  )

  assert.deepEqual(
    placed.map(({ name, side }) => `${name}: ${side}`),
    [
      "title: left",
      "divider: left",
      "icon 1: right",
      "icon 2: right",
      "icon 3: right",
    ],
  )
  const topsOnTheRight = placed
    .filter(({ side }) => side === "right")
    .map(({ top }) => top)
  // Three labels wished at the same height: spread around it, 42 px apart.
  assert.deepEqual(topsOnTheRight, [-27, 15, 57])
  assert.ok(topsOnTheRight[1] - topsOnTheRight[0] >= LABEL_HEIGHT)
})

test("a tab is the screen's number, then what its name does not share with the others'", () => {
  assert.deepEqual(
    nameScreenTabs([
      { number: 1, name: "Editor · Off · Default" },
      { number: 2, name: "Editor · Period · Default" },
    ]),
    ["1 · Off · Default", "2 · Period · Default"],
  )
  assert.deepEqual(
    nameScreenTabs([
      { number: 1, name: "Editor" },
      { number: 2, name: "Editor" },
    ]),
    ["1 · Editor", "2 · Editor"],
  )
})

test("the page gets each screen's drawing, with what is the same on every screen marked", () => {
  const candidates = [
    buildJudgedCandidate(1, "Editor", [
      { screen: 1, level: 1, box: [0, 0, 400, 300] },
      { screen: 2, level: 1, box: [0, 0, 400, 340] },
    ]),
    buildJudgedCandidate(
      2,
      "Settings",
      [
        { screen: 1, level: 2, box: [20, 100, 360, 60] },
        { screen: 2, level: 2, box: [20, 100, 360, 100] },
      ],
      {
        verdict: "to-create",
        note: "Un composant par mode.",
        codeComponentByScreen: { 1: "OrderOffNotice", 2: "OrderSettings" },
      },
    ),
    buildJudgedCandidate(
      3,
      "Divider",
      [{ screen: 2, level: 2, box: [20, 90, 360, 1] }],
      { outlined: false, note: "Un trait du conteneur." },
    ),
    // A plain frame around the settings: no component is nested between them, so both
    // have the same level.
    buildJudgedCandidate(
      4,
      "Body",
      [{ screen: 2, level: 2, box: [10, 80, 380, 200] }],
      { kind: "frame", verdict: "to-create" },
    ),
  ]
  /** @param {number} number @param {string} name @param {number} height */
  const buildScreen = (number, name, height) => ({
    number,
    name,
    width: 400,
    capture: buildBox([-10, -10, 420, height + 20]),
    figmaUrl: `https://figma.example/${number}`,
    captureDataUrl: "data:image/png;base64,",
  })

  const drawing = buildPageDrawing({
    screens: [
      buildScreen(1, "Editor · Off", 300),
      buildScreen(2, "Editor · Continuous", 340),
    ],
    judgedCandidates: candidates,
    fingerprint: {
      createdAt: "2026-11-23",
      figma: {
        fileKey: "abc",
        version: "1",
        lastModified: "2026-11-20T10:00:00Z",
      },
      gitCommit: "34ee98aa6",
    },
  })

  assert.deepEqual(drawing.title, {
    fr: "Editor (2 écrans)",
    en: "Editor (2 screens)",
  })
  assert.deepEqual(drawing.fingerprintLine, {
    fr: "Construit le 2026-11-23 · maquette modifiée le 2026-11-20 · commit 34ee98aa6",
    en: "Built on 2026-11-23 · mock-up changed on 2026-11-20 · commit 34ee98aa6",
  })
  assert.deepEqual(
    drawing.screens.map((screen) => screen.linkText),
    [
      { fr: "Écran 1 — Editor · Off", en: "Screen 1 — Editor · Off" },
      {
        fr: "Écran 2 — Editor · Continuous",
        en: "Screen 2 — Editor · Continuous",
      },
    ],
  )
  assert.deepEqual(
    drawing.screens.map((screen) => [
      screen.tabName,
      screen.outlines.map(
        ({ id, isSameOnEveryScreen }) =>
          `${id}${isSameOnEveryScreen ? " same" : ""}`,
      ),
      screen.labels
        .map(({ title, detail }) => `${title} (${detail.fr} | ${detail.en})`)
        .toSorted(),
    ]),
    [
      [
        "1 · Off",
        ["1 same", "2"],
        [
          "1  Editor (Editor · Réutilisé | Editor · Reused)",
          "2  OrderOffNotice (Settings · À créer | Settings · To create)",
        ],
      ],
      [
        "2 · Continuous",
        ["1 same", "4", "2"],
        [
          "1  Editor (Editor · Réutilisé | Editor · Reused)",
          "2  OrderSettings (Settings · À créer | Settings · To create)",
          "4  Body (Body · À créer | Body · To create)",
        ],
      ],
    ],
  )
  // Both screens are drawn in one box: the taller one's, with on each side a column as wide
  // as its longest label (112 px on the left, 133 px on the right) after a 28 px gap.
  assert.deepEqual(drawing.commonBox, {
    left: -150,
    top: -23,
    width: 721,
    height: 381,
  })
  assert.deepEqual(
    drawing.explanations.map(({ badgeText, title, screens, reason }) => [
      badgeText,
      title,
      screens,
      reason,
    ]),
    [
      [
        "2 · écran 1",
        { fr: "OrderOffNotice — À créer", en: "OrderOffNotice — To create" },
        [1],
        "Un composant par mode.",
      ],
      [
        "2 · écran 2",
        { fr: "OrderSettings — À créer", en: "OrderSettings — To create" },
        [2],
        "Un composant par mode.",
      ],
    ],
  )
  assert.deepEqual(
    drawing.notOutlined.map(({ name, reason }) => [name, reason]),
    [["3 Divider", "Un trait du conteneur."]],
  )
  assert.match(drawing.notOutlined[0].reviewHash, /^[0-9a-f]{12}$/)
  assert.deepEqual(
    drawing.correctableCandidates.map(({ number, targets, judgement }) => [
      number,
      targets.map(
        ({ id, tabName, screens, verdict, codeComponent }) =>
          `${id} (${tabName.fr} | ${tabName.en}) [${screens}] ${verdict} ${codeComponent}`,
      ),
      judgement,
    ]),
    [
      [
        1,
        [
          "1 (Toutes ses utilisations | All its uses) [1,2] reused Editor",
          "1 · écran 1 (écran 1 | screen 1) [1] reused Editor",
          "1 · écran 2 (écran 2 | screen 2) [2] reused Editor",
        ],
        { fr: "Editor · Réutilisé", en: "Editor · Reused" },
      ],
      [
        2,
        [
          "2 (Toutes ses utilisations | All its uses) [1,2] to-create null",
          "2 · écran 1 (écran 1 | screen 1) [1] to-create OrderOffNotice",
          "2 · écran 2 (écran 2 | screen 2) [2] to-create OrderSettings",
        ],
        {
          fr: "OrderOffNotice · À créer / OrderSettings · À créer",
          en: "OrderOffNotice · To create / OrderSettings · To create",
        },
      ],
      [
        4,
        ["4 (Toutes ses utilisations | All its uses) [2] to-create Body"],
        { fr: "Body · À créer", en: "Body · To create" },
      ],
    ],
  )
})

test("a rebuilt page keeps the review hash of what did not change", () => {
  /** @param {string} noteOfSettings */
  const drawWith = (noteOfSettings) =>
    buildPageDrawing({
      screens: [
        {
          number: 1,
          name: "Editor",
          width: 400,
          capture: buildBox([0, 0, 400, 300]),
          figmaUrl: "https://figma.example/1",
          captureDataUrl: "data:image/png;base64,",
        },
      ],
      judgedCandidates: [
        buildJudgedCandidate(
          1,
          "Editor",
          [{ screen: 1, level: 1, box: [0, 0, 400, 300] }],
          { verdict: "to-create", note: "Rien ne dessine cette fenêtre." },
        ),
        buildJudgedCandidate(
          2,
          "Settings",
          [{ screen: 1, level: 2, box: [20, 100, 360, 80] }],
          { verdict: "to-adapt", note: noteOfSettings },
        ),
      ],
      fingerprint: {
        createdAt: "2026-11-23",
        figma: {
          fileKey: "abc",
          version: "1",
          lastModified: "2026-11-20T10:00:00Z",
        },
        gitCommit: "34ee98aa6",
      },
    })
  const before = drawWith("Il manque le sous-titre.")
  const after = drawWith("Il manque le sous-titre et l'icône.")

  /** @param {ReturnType<typeof drawWith>} drawing */
  const listExplanationHashes = (drawing) =>
    drawing.explanations.map((explanation) => explanation.reviewHash)
  const [editorBefore, settingsBefore] = listExplanationHashes(before)
  const [editorAfter, settingsAfter] = listExplanationHashes(after)
  assert.match(editorBefore, /^[0-9a-f]{12}$/)
  assert.equal(editorAfter, editorBefore)
  assert.notEqual(settingsAfter, settingsBefore)
  // The screen is checked for what its explanations do not say: it has not changed.
  assert.equal(after.screens[0].reviewHash, before.screens[0].reviewHash)
  assert.equal(after.reviewKey, before.reviewKey)
})
