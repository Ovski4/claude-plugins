// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import { buildSpecsPageDrawing } from "../scripts/lib/specsPageDrawing.mjs"
import { buildApprovedInventory, buildSpecsFile } from "./specsFixtures.mjs"

test("each component is cut out of its screen's capture, with its zones outlined inside the cut", () => {
  const { components, zoneKinds, zoneKindsInTheLegend, fingerprintLine } =
    buildSpecsPageDrawing({
      inventory: buildApprovedInventory(),
      specsFile: buildSpecsFile(),
    })

  assert.deepEqual(fingerprintLine, {
    fr: "Construit sur l'inventaire validé le 2026-11-23 · maquette modifiée le 2026-11-20 · commit 34ee98aa6",
    en: "Built on the inventory approved on 2026-11-23 · mock-up changed on 2026-11-20 · commit 34ee98aa6",
  })
  assert.deepEqual(zoneKinds, {
    prop: { color: "#be185d" },
    fixed: { color: "#64748b" },
    change: { color: "#0f766e" },
    "not-drawn": { color: "#a16207" },
    "to-decide": { color: "#dc2626" },
  })
  assert.deepEqual(zoneKindsInTheLegend, ["prop", "fixed", "change"])
  assert.deepEqual(
    components.map((component) => component.codeComponent),
    ["Select", "OrderDeliverySettings"],
  )

  const [select, settings] = components
  assert.equal(select.isToAdapt, true)
  assert.deepEqual(select.changes, [
    { what: "Hauteur du champ", before: "32 px", after: "36 px" },
  ])
  assert.equal(settings.isToAdapt, false)
  assert.deepEqual(settings.changes, [])
  assert.deepEqual(settings.verdict, { key: "to-create", color: "#7c3aed" })
  assert.deepEqual(settings.props, [
    {
      name: "targetTemperature",
      type: "number",
      required: true,
      source: "state.targetTemperature de useOrderEditorState",
    },
  ])
  assert.deepEqual(settings.zones, [
    // Zone A outlines the Select, a component to adapt with a tab of its own.
    {
      letter: "A",
      label: "Consigne",
      kind: "prop",
      props: ["targetTemperature"],
      opensComponent: "Select",
    },
    {
      letter: "B",
      label: "Libellé « Consigne »",
      kind: "fixed",
      opensComponent: null,
    },
  ])
  // The settings are at (24, 244) on the screen and measure 432 × 92: with 14 px around,
  // the cut starts at (10, 230). The capture starts at (-24, -16) on the screen.
  assert.deepEqual(
    settings.screens.map(({ reviewHash: _reviewHash, ...screen }) => screen),
    [
      {
        screenNumber: 1,
        screenName: "Editor — regulation · Continuous · Default",
        tabName: "1 · Default",
        figmaUrl:
          "https://www.figma.com/design/AbCdEfGhIjKlMnOpQrStUv/?node-id=87-91461",
        sameOnScreenNumbers: [],
        componentFrame: { x: 14, y: 14, width: 432, height: 92 },
        cut: { width: 460, height: 120 },
        capture: {
          file: "screen-87-91461.png",
          x: -34,
          y: -246,
          width: 528,
          height: 468,
        },
        outlines: [
          // The Select, at (24, 272) and 200 × 40, with 2 px around.
          { zoneLetter: "A", x: 12, y: 40, width: 204, height: 44 },
          // The « Consigne » label, at (24, 244) and 70 × 20.
          { zoneLetter: "B", x: 12, y: 12, width: 74, height: 24 },
        ],
      },
    ],
  )
})

test("a rebuilt page keeps the review hash of what did not change", () => {
  /** @param {(specsFile: ReturnType<typeof buildSpecsFile>) => void} changeSpecs */
  const drawSettingsAfter = (changeSpecs) => {
    const specsFile = buildSpecsFile()
    changeSpecs(specsFile)
    const { components, reviewKey } = buildSpecsPageDrawing({
      inventory: buildApprovedInventory(),
      specsFile,
    })
    const [select, settings] = components
    return {
      reviewKey,
      select: select.reviewHash,
      settings: settings.reviewHash,
      settingsOnScreen: settings.screens[0].reviewHash,
    }
  }
  const before = drawSettingsAfter(() => {})
  assert.match(before.settings, /^[0-9a-f]{12}$/)

  // A prop is read in the panel of the component: its box is to tick again, alone.
  const afterAProp = drawSettingsAfter(({ components: [, settings] }) => {
    settings.props[0].type = "number | null"
  })
  assert.notEqual(afterAProp.settings, before.settings)
  assert.equal(afterAProp.settingsOnScreen, before.settingsOnScreen)
  assert.equal(afterAProp.select, before.select)
  assert.equal(afterAProp.reviewKey, before.reviewKey)

  // A zone is read on the screens that draw it: their box is to tick again, alone.
  const afterAZone = drawSettingsAfter(({ components: [, settings] }) => {
    settings.zones[1].label = "Libellé du champ"
  })
  assert.equal(afterAZone.settings, before.settings)
  assert.notEqual(afterAZone.settingsOnScreen, before.settingsOnScreen)
})

test("a component drawn inside another is shown in the outermost one's cut, framed around all its uses", () => {
  const inventory = buildApprovedInventory()
  const select = inventory.judgedCandidates.find(
    (candidate) => candidate.number === 8,
  )
  select?.instances.push({
    ...select.instances[0],
    letter: "b",
    box: { x: 240, y: 272, width: 200, height: 40 },
  })

  const [drawnSelect] = buildSpecsPageDrawing({
    inventory,
    specsFile: buildSpecsFile(),
  }).components

  assert.equal(drawnSelect.screens.length, 1)
  assert.equal(drawnSelect.screens[0].componentFrame.width, 416)
  // The cut is the settings', at (10, 230) on the screen: the two Selects, from (24, 272)
  // to (440, 312), are framed inside it.
  assert.deepEqual(drawnSelect.screens[0].cut, { width: 460, height: 120 })
  assert.deepEqual(drawnSelect.screens[0].componentFrame, {
    x: 14,
    y: 42,
    width: 416,
    height: 40,
  })
  // Zone A names instance 8a only: the second use gets no outline.
  assert.deepEqual(drawnSelect.screens[0].outlines, [
    { zoneLetter: "A", x: 12, y: 40, width: 204, height: 44 },
  ])
})

test("a component comes after the components drawn inside it, whatever the inventory's order", () => {
  const inventory = buildApprovedInventory()
  inventory.judgedCandidates.reverse()

  assert.deepEqual(
    buildSpecsPageDrawing({
      inventory,
      specsFile: buildSpecsFile(),
    }).components.map((component) => component.codeComponent),
    ["Select", "OrderDeliverySettings"],
  )
})

test("a zone that asks a question does not open the tab of the component it outlines", () => {
  const specsFile = buildSpecsFile()
  const [zoneOnTheSelect] = specsFile.components[1].zones
  zoneOnTheSelect.kind = "to-decide"

  const [, settings] = buildSpecsPageDrawing({
    inventory: buildApprovedInventory(),
    specsFile,
  }).components
  assert.equal(settings.zones[0].opensComponent, null)
})

test("a screen whose specs say the same as an earlier one's is left out, and named by it", () => {
  const inventory = buildApprovedInventory()
  const [firstScreen] = inventory.screens
  // The mobile screen: narrower, with the same texts and the same components inside.
  inventory.screens.push({
    ...firstScreen,
    number: 2,
    name: "Editor — regulation · Continuous · Mobile",
  })
  for (const candidate of inventory.judgedCandidates) {
    const [instance] = candidate.instances
    candidate.instances.push({
      ...instance,
      letter: "z",
      screen: 2,
      box: { ...instance.box, width: instance.box.width - 10 },
    })
  }
  const specsFile = buildSpecsFile()
  // The Select's only zone is "change"; in the settings, the zone on the Select is "prop".
  specsFile.components[0].zones[0].parts = [{ candidate: 8 }]
  const listScreensKept = () =>
    buildSpecsPageDrawing({ inventory, specsFile }).components.map(
      ({ screens }) =>
        screens.map(({ screenNumber, sameOnScreenNumbers }) => ({
          screenNumber,
          sameOnScreenNumbers,
        })),
    )

  assert.deepEqual(listScreensKept(), [
    [{ screenNumber: 1, sameOnScreenNumbers: [2] }],
    [{ screenNumber: 1, sameOnScreenNumbers: [2] }],
  ])

  // Another value in the field: nothing new for the Select, whose zone has no prop; a
  // second state for the settings, whose prop gives that value.
  inventory.screens[1].texts = firstScreen.texts.map((text) =>
    text.characters === "19,5 °C" ? { ...text, characters: "18,0 °C" } : text,
  )
  assert.deepEqual(listScreensKept(), [
    [{ screenNumber: 1, sameOnScreenNumbers: [2] }],
    [
      { screenNumber: 1, sameOnScreenNumbers: [] },
      { screenNumber: 2, sameOnScreenNumbers: [] },
    ],
  ])
})
