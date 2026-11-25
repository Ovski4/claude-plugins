// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildEmptySpecsFile,
  listBoxesOfZonePart,
  listComponentsToSpecify,
  listSpecProblems,
} from "../scripts/lib/componentSpecs.mjs"
import { buildApprovedInventory, buildSpecsFile } from "./specsFixtures.mjs"

test("the components to specify are the ones to create or to adapt, each with the places it is drawn", () => {
  const components = listComponentsToSpecify(buildApprovedInventory())

  assert.deepEqual(
    components.map(({ codeComponent, verdict, codePath }) => ({
      codeComponent,
      verdict,
      codePath,
    })),
    [
      {
        codeComponent: "Select",
        verdict: "to-adapt",
        codePath: "src/components/ui/select.tsx",
      },
      {
        codeComponent: "OrderDeliverySettings",
        verdict: "to-create",
        codePath: null,
      },
    ],
  )
  assert.equal(components[1].instances[0].candidateNumber, 17)
  assert.deepEqual(buildEmptySpecsFile(buildApprovedInventory()), {
    figmaVersion: "2423993102449653660",
    components: [
      { codeComponent: "Select", props: [], zones: [] },
      {
        codeComponent: "OrderDeliverySettings",
        props: [],
        zones: [],
      },
    ],
  })
})

test("a part of a zone gives its boxes inside the component only", () => {
  const inventory = buildApprovedInventory()
  const [, settings] = listComponentsToSpecify(inventory)

  assert.deepEqual(listBoxesOfZonePart({ candidate: 8 }, settings, inventory), [
    {
      screen: 1,
      box: { x: 24, y: 272, width: 200, height: 40 },
      instanceId: "8a",
    },
  ])
  assert.deepEqual(
    listBoxesOfZonePart({ instance: "8a" }, settings, inventory),
    [
      {
        screen: 1,
        box: { x: 24, y: 272, width: 200, height: 40 },
        instanceId: "8a",
      },
    ],
  )
  assert.deepEqual(
    listBoxesOfZonePart({ text: "Consigne" }, settings, inventory),
    [
      {
        screen: 1,
        box: { x: 24, y: 244, width: 70, height: 20 },
        instanceId: null,
      },
    ],
  )
  // The close button and its text are on the screen, outside the settings.
  assert.deepEqual(
    listBoxesOfZonePart({ candidate: 3 }, settings, inventory),
    [],
  )
  assert.deepEqual(
    listBoxesOfZonePart({ text: "Fermer" }, settings, inventory),
    [],
  )
  assert.deepEqual(
    listBoxesOfZonePart({ instance: "8z" }, settings, inventory),
    [],
  )
})

test("specs that follow the rules have no problem", () => {
  assert.deepEqual(
    listSpecProblems({
      inventory: buildApprovedInventory(),
      specsFile: buildSpecsFile(),
    }),
    [],
  )
})

test("a prop written with a hyphen in the code, like aria-label, is accepted under that name", () => {
  const specsFile = buildSpecsFile()
  const [select] = specsFile.components
  select.props = [
    {
      name: "aria-label",
      type: "string",
      required: true,
      source: "Texte « Consigne » des traductions.",
      change: "to-add",
    },
  ]
  delete select.changes
  select.zones[0].kind = "prop"
  select.zones[0].props = ["aria-label"]

  assert.deepEqual(
    listSpecProblems({ inventory: buildApprovedInventory(), specsFile }),
    [],
  )
})

test("a zone the component leaves out names no prop and says why", () => {
  const specsFile = buildSpecsFile()
  const [, settings] = specsFile.components
  settings.zones[1].kind = "not-drawn"

  assert.deepEqual(
    listSpecProblems({ inventory: buildApprovedInventory(), specsFile }),
    [
      'OrderDeliverySettings, zone B: kind "not-drawn" needs a note saying why the component leaves it out',
    ],
  )

  settings.zones[1].notes = ["Le code ne sait pas enregistrer ce réglage."]
  assert.deepEqual(
    listSpecProblems({ inventory: buildApprovedInventory(), specsFile }),
    [],
  )
})

test("a component to adapt shows where its changes apply with a zone of kind change, never a fixed one", () => {
  const specsFile = buildSpecsFile()
  const [select] = specsFile.components
  select.zones[0].kind = "fixed"

  assert.deepEqual(
    listSpecProblems({ inventory: buildApprovedInventory(), specsFile }),
    [
      'Select: needs a zone of kind "change" to show where "changes" apply',
      'Select, zone A: a component to adapt has zones only where something changes; kind "change" for an item of "changes"',
    ],
  )
})

test("a component to adapt lists only what changes: props to add or to modify, and changes without a prop", () => {
  const specsFile = buildSpecsFile()
  const [select, settings] = specsFile.components
  delete select.changes
  settings.changes = [
    { what: "Hauteur du champ", before: "32 px", after: "36 px" },
  ]
  settings.props[0].change = "to-add"

  assert.deepEqual(
    listSpecProblems({ inventory: buildApprovedInventory(), specsFile }),
    [
      'Select: a component to adapt needs a prop to add or to modify, or an item in "changes"',
      'Select: a zone of kind "change" needs an item in "changes"',
      'OrderDeliverySettings: "changes" is for a component to adapt',
      'OrderDeliverySettings: needs a zone of kind "change" to show where "changes" apply',
      'OrderDeliverySettings, prop "targetTemperature": "change" is for a component to adapt',
    ],
  )

  select.props = [
    {
      name: "size",
      type: '"default" | "large"',
      required: false,
      source: "Valeur « large », écrite par le parent.",
    },
  ]
  select.zones[0].kind = "prop"
  select.zones[0].props = ["size"]
  delete settings.changes
  delete settings.props[0].change
  assert.deepEqual(
    listSpecProblems({ inventory: buildApprovedInventory(), specsFile }),
    [
      'Select, prop "size": "change" is to-add or to-modify; a prop that exists and does not change is not listed',
    ],
  )

  select.props[0].change = "to-modify"
  select.changes = [{ what: "Hauteur du champ", before: "", after: "36 px" }]
  assert.deepEqual(
    listSpecProblems({ inventory: buildApprovedInventory(), specsFile }),
    [
      'Select, change 1: needs "what", "before" and "after"',
      'Select: needs a zone of kind "change" to show where "changes" apply',
      'Select, prop "size": a prop to modify needs "typeBefore", its type today',
    ],
  )

  select.changes = []
  select.props[0].change = "to-add"
  select.props[0].typeBefore = "string"
  assert.deepEqual(
    listSpecProblems({ inventory: buildApprovedInventory(), specsFile }),
    ['Select, prop "size": "typeBefore" is for a prop to modify'],
  )
})

test("every broken rule of specs.json is named", () => {
  const specsFile = buildSpecsFile()
  specsFile.figmaVersion = "1"
  const [select, settings] = specsFile.components
  select.codeComponent = "Button"
  settings.props.push({
    name: "Heating period",
    type: "",
    required: /** @type {any} */ ("yes"),
    source: "",
  })
  settings.zones[0].props = ["onChange"]
  settings.zones[0].parts = [{ candidate: 3 }]
  settings.zones[1].kind = "to-decide"
  settings.zones[1].letter = "A"

  assert.deepEqual(
    listSpecProblems({ inventory: buildApprovedInventory(), specsFile }),
    [
      "specs.json was filled for Figma version 1, the inventory is at 2423993102449653660",
      "Select: 0 entries in specs.json, one is expected",
      'OrderDeliverySettings, prop "targetTemperature": no zone names it; a prop drives something drawn',
      'OrderDeliverySettings, prop "Heating period": "name" is the prop as written in the code',
      'OrderDeliverySettings, prop "Heating period": needs "type"',
      'OrderDeliverySettings, prop "Heating period": "required" is true or false',
      'OrderDeliverySettings, prop "Heating period": needs "source", where the parent gets the value',
      'OrderDeliverySettings, prop "Heating period": no zone names it; a prop drives something drawn',
      "OrderDeliverySettings, zone A: several zones have this letter",
      'OrderDeliverySettings, zone A: onChange is not in the component\'s "props"',
      'OrderDeliverySettings, zone A: part {"candidate":3} is drawn nowhere inside OrderDeliverySettings',
      "OrderDeliverySettings, zone A: several zones have this letter",
      'OrderDeliverySettings, zone A: kind "to-decide" needs "question" and 2 to 4 "options"',
      "Button: the inventory has no component to create or to adapt with this name",
    ],
  )
})
