// @ts-check
// The rules of specs.json, the file the model fills: for each React component the approved
// inventory says to create or to adapt, its props and the zones of the captures they drive.
// A zone names what it outlines by the inventory's numbers and texts, never by coordinates.
import { isBoxInside } from "../../../figma-component-inventory/scripts/lib/box.mjs"
import {
  MAX_QUIZ_OPTIONS,
  MIN_QUIZ_OPTIONS,
} from "../../../figma-component-inventory/scripts/lib/verdicts.mjs"

/** @typedef {import("../../../figma-component-inventory/scripts/lib/approvedInventory.mjs").ApprovedInventory} ApprovedInventory */
/** @typedef {import("../../../figma-component-inventory/scripts/lib/verdicts.mjs").JudgedInstance} JudgedInstance */
/** @typedef {import("../../../figma-component-inventory/scripts/lib/verdicts.mjs").VerdictKey} VerdictKey */
/** @typedef {import("../../../figma-component-inventory/scripts/lib/figma.mjs").Box} Box */
/**
 * One prop of a component.
 * @typedef {object} PropSpec
 * @property {string} name as written in the code: "targetTemperature"
 * @property {string} type its TypeScript type: "number", "HeatingPeriod"
 * @property {boolean} required false for an optional prop
 * @property {string} source where the parent gets the value, in French: the hook, the state field or the constant
 * @property {string} [note] a rule the type does not say, in French: "obligatoire avec heatingPeriod"
 * @property {PropChangeKey} [change] for a component to adapt, where every listed prop is new or modified; absent for a component to create
 * @property {string} [typeBefore] for a prop to modify: its TypeScript type today, `type` being the one after
 */
/** @typedef {"to-add" | "to-modify"} PropChangeKey */
/**
 * What a zone outlines, inside the component, on every screen where it is drawn. One of:
 * - `candidate`: every use of that inventory candidate, 19;
 * - `instance`: one use, by the inventory's number and letter, "11a";
 * - `text`: every text of the screen with exactly these characters, "Consigne".
 * @typedef {{ candidate: number } | { instance: string } | { text: string }} ZonePart
 */
/**
 * - `prop`: props decide what the zone shows, or receive its actions;
 * - `fixed`: the same whatever the props, in a component to create;
 * - `change`: what an item of "changes" alters, in a component to adapt;
 * - `not-drawn`: drawn by the mock-up, left out by the component for a written reason;
 * - `to-decide`: a rule only the developer can give.
 * @typedef {"prop" | "fixed" | "change" | "not-drawn" | "to-decide"} ZoneKindKey
 */
/**
 * One zone of a component: a part of its drawing and the props that drive it.
 * @typedef {object} ZoneSpec
 * @property {string} letter "A", "B"…: unique in the component
 * @property {string} label what the zone is, in French: "Période de chauffe"
 * @property {ZoneKindKey} kind
 * @property {ZonePart[]} parts
 * @property {string[]} [props] the names of the props that drive the zone
 * @property {string[]} [notes] the rules of the zone, in French, one sentence each
 * @property {string} [question] for "to-decide": what the developer is asked
 * @property {string[]} [options] for "to-decide": the answers he picks from
 */
/**
 * One thing a component to adapt changes without a prop, in French, read as "before → after".
 * @typedef {object} ChangeSpec
 * @property {string} what the thing that changes: "Hauteur du champ"
 * @property {string} before what the code does today: "32 px"
 * @property {string} after what the mock-up asks: "36 px"
 */
/**
 * @typedef {object} ComponentSpec
 * @property {string} codeComponent
 * @property {PropSpec[]} props every prop of a component to create; for a component to adapt, only the props to add or to modify
 * @property {ZoneSpec[]} zones
 * @property {string[]} [developerDecisions] what the developer settled on the page or in the chat, in French, one sentence each: no model changes what a decision says
 * @property {ChangeSpec[]} [changes] for a component to adapt: what changes without a prop
 */
/**
 * @typedef {object} SpecsFile
 * @property {string} figmaVersion the Figma version of the inventory the specs were written for
 * @property {ComponentSpec[]} components
 * @property {import("./specsApproval.mjs").SpecsApproval} [approval] written by render.mjs --approve
 */
/**
 * A React component the inventory says to create or to adapt, with every place it is drawn.
 * @typedef {object} ComponentToSpecify
 * @property {string} codeComponent
 * @property {string | null} codePath its file, null for a component to create
 * @property {VerdictKey} verdict "to-create" or "to-adapt"
 * @property {boolean} isToAdapt true for a component the code has: its specs say what changes only
 * @property {(JudgedInstance & { id: string, candidateNumber: number, candidateFigmaName: string })[]} instances `id`: the inventory's number and letter, "11a"
 */
/** @typedef {ApprovedInventory["judgedCandidates"][number]} JudgedCandidate */

/** @type {VerdictKey[]} */
const VERDICTS_TO_SPECIFY = ["to-create", "to-adapt"]

/**
 * A kind's name is the text "zoneKind.<key>" of the specs page's dictionary.
 * color: of the zone's outline and of its letter.
 * @type {Record<ZoneKindKey, { color: string }>}
 */
export const ZONE_KINDS = {
  prop: { color: "#be185d" },
  fixed: { color: "#64748b" },
  change: { color: "#0f766e" },
  "not-drawn": { color: "#a16207" },
  "to-decide": { color: "#dc2626" },
}
// What happens to a prop of a component to adapt. Its name beside the prop is the text
// "propChange.<key>" of the specs page's dictionary.
const PROP_CHANGE_KEYS = ["to-add", "to-modify"]
export const ZONE_KIND_KEYS = /** @type {ZoneKindKey[]} */ (
  Object.keys(ZONE_KINDS)
)
/** @type {ZoneKindKey[]} */
export const ZONE_KINDS_WITHOUT_PROPS = ["fixed", "change", "not-drawn"]
const PROP_NAME_PATTERN = /^[a-z][A-Za-z0-9]*(-[a-z0-9]+)*$/
const ZONE_LETTER_PATTERN = /^[A-Z]$/

/**
 * Every use of a candidate, each with its id: the inventory's number and letter, "11a".
 * `isOutlined` is false for the uses an exception of the inventory leaves without an
 * outline: they are drawn on the capture all the same.
 * @param {JudgedCandidate} candidate
 */
export function listEveryInstance(candidate) {
  return [
    ...candidate.instances.map((instance) => ({
      ...instance,
      isOutlined: candidate.outlined,
    })),
    ...candidate.partsNotOutlined.flatMap((part) =>
      part.instances.map((instance) => ({
        ...instance,
        verdict: null,
        codeComponent: null,
        isOutlined: false,
      })),
    ),
  ].map((instance) => ({
    ...instance,
    id: `${candidate.number}${instance.letter}`,
  }))
}

/**
 * @param {ApprovedInventory} inventory
 * @param {number} screenNumber
 */
export const listTextsOfScreen = (inventory, screenNumber) =>
  inventory.screens.find((screen) => screen.number === screenNumber)?.texts ??
  []

/**
 * The components specs.json has to describe, in the inventory's order. A reused component
 * is left out: its props are in the code.
 * @param {ApprovedInventory} inventory
 * @returns {ComponentToSpecify[]}
 */
export function listComponentsToSpecify(inventory) {
  /** @type {Map<string, ComponentToSpecify>} */
  const componentsByName = new Map()
  for (const candidate of inventory.judgedCandidates) {
    for (const instance of candidate.instances) {
      const { codeComponent, codePath, verdict } = instance
      if (!codeComponent || !VERDICTS_TO_SPECIFY.includes(verdict)) continue
      const component = componentsByName.get(codeComponent) ?? {
        codeComponent,
        codePath,
        verdict,
        isToAdapt: verdict === "to-adapt",
        instances: [],
      }
      component.instances.push({
        ...instance,
        id: `${candidate.number}${instance.letter}`,
        candidateNumber: candidate.number,
        candidateFigmaName: candidate.figmaName,
      })
      componentsByName.set(codeComponent, component)
    }
  }
  return [...componentsByName.values()]
}

/**
 * The specs.json handed to the model: one entry per component, nothing filled.
 * @param {ApprovedInventory} inventory
 * @returns {SpecsFile}
 */
export function buildEmptySpecsFile(inventory) {
  return {
    figmaVersion: inventory.fingerprint.figma.version,
    components: listComponentsToSpecify(inventory).map(({ codeComponent }) => ({
      codeComponent,
      props: [],
      zones: [],
    })),
  }
}

/**
 * Where a part of a zone is drawn: every box it names that lies inside the component, on
 * the screens where the component is. Empty when the part names nothing there.
 * @param {ZonePart} part
 * @param {ComponentToSpecify} component
 * @param {ApprovedInventory} inventory
 * @returns {{ screen: number, box: Box, instanceId: string | null }[]} `instanceId`: the use of a candidate the box is, "11a"; null for a text
 */
export function listBoxesOfZonePart(part, component, inventory) {
  const boxesOnEveryScreen =
    "text" in part
      ? inventory.screens.flatMap((screen) =>
          screen.texts
            .filter((text) => text.characters === part.text)
            .map(({ box }) => ({
              screen: screen.number,
              box,
              instanceId: null,
            })),
        )
      : inventory.judgedCandidates.flatMap((candidate) =>
          listEveryInstance(candidate)
            .filter((instance) =>
              "instance" in part
                ? instance.id === part.instance
                : candidate.number === part.candidate,
            )
            .map(({ screen, box, id }) => ({ screen, box, instanceId: id })),
        )
  return boxesOnEveryScreen.filter(({ screen, box }) =>
    component.instances.some(
      (instance) =>
        instance.screen === screen && isBoxInside(box, instance.box),
    ),
  )
}

const isFilled = (/** @type {unknown} */ value) =>
  typeof value === "string" && value.trim() !== ""

/**
 * @param {ComponentSpec} spec
 * @param {ComponentToSpecify} component
 * @param {ApprovedInventory} inventory
 * @returns {string[]}
 */
function listProblemsOfComponentSpec(spec, component, inventory) {
  const who = spec.codeComponent
  const problems = []
  const props = spec.props ?? []
  const zones = spec.zones ?? []
  const propNames = props.map((prop) => prop.name)
  const { isToAdapt } = component
  const changes = spec.changes ?? []

  if (isToAdapt && !props.length && !changes.length) {
    problems.push(
      `${who}: a component to adapt needs a prop to add or to modify, or an item in "changes"`,
    )
  }
  changes.forEach((change, index) => {
    if (![change?.what, change?.before, change?.after].every(isFilled)) {
      problems.push(
        `${who}, change ${index + 1}: needs "what", "before" and "after"`,
      )
    }
  })
  if (!isToAdapt && changes.length)
    problems.push(`${who}: "changes" is for a component to adapt`)
  const hasChangeZone = zones.some((zone) => zone.kind === "change")
  if (changes.length && !hasChangeZone) {
    problems.push(
      `${who}: needs a zone of kind "change" to show where "changes" apply`,
    )
  }
  if (hasChangeZone && !changes.length)
    problems.push(`${who}: a zone of kind "change" needs an item in "changes"`)

  for (const prop of props) {
    const propWho = `${who}, prop ${JSON.stringify(prop.name)}`
    if (isToAdapt && !PROP_CHANGE_KEYS.includes(prop.change ?? "")) {
      problems.push(
        `${propWho}: "change" is ${PROP_CHANGE_KEYS.join(" or ")}; a prop that exists and does not change is not listed`,
      )
    }
    if (prop.change === "to-modify" && !isFilled(prop.typeBefore)) {
      problems.push(
        `${propWho}: a prop to modify needs "typeBefore", its type today`,
      )
    }
    if (prop.change !== "to-modify" && prop.typeBefore !== undefined)
      problems.push(`${propWho}: "typeBefore" is for a prop to modify`)
    if (!isToAdapt && prop.change !== undefined)
      problems.push(`${propWho}: "change" is for a component to adapt`)
    if (!PROP_NAME_PATTERN.test(prop.name ?? ""))
      problems.push(`${propWho}: "name" is the prop as written in the code`)
    if (propNames.filter((name) => name === prop.name).length > 1)
      problems.push(`${propWho}: listed several times`)
    if (!isFilled(prop.type)) problems.push(`${propWho}: needs "type"`)
    if (typeof prop.required !== "boolean")
      problems.push(`${propWho}: "required" is true or false`)
    if (!isFilled(prop.source))
      problems.push(
        `${propWho}: needs "source", where the parent gets the value`,
      )
    if (!zones.some((zone) => zone.props?.includes(prop.name)))
      problems.push(
        `${propWho}: no zone names it; a prop drives something drawn`,
      )
  }

  if (!zones.length) problems.push(`${who}: needs at least one zone`)
  const zoneLetters = zones.map((zone) => zone.letter)
  for (const zone of zones) {
    const zoneWho = `${who}, zone ${zone.letter}`
    const namedProps = zone.props ?? []
    if (!ZONE_LETTER_PATTERN.test(zone.letter ?? ""))
      problems.push(`${zoneWho}: "letter" is one capital letter`)
    if (zoneLetters.filter((letter) => letter === zone.letter).length > 1)
      problems.push(`${zoneWho}: several zones have this letter`)
    if (!isFilled(zone.label)) problems.push(`${zoneWho}: needs "label"`)
    if (!ZONE_KIND_KEYS.includes(zone.kind)) {
      problems.push(
        `${zoneWho}: kind ${JSON.stringify(zone.kind)} is not one of ${ZONE_KIND_KEYS.join(", ")}`,
      )
    }
    const unknownProps = namedProps.filter((name) => !propNames.includes(name))
    if (unknownProps.length) {
      problems.push(
        `${zoneWho}: ${unknownProps.join(", ")} is not in the component's "props"`,
      )
    }
    if (zone.kind === "prop" && !namedProps.length)
      problems.push(`${zoneWho}: kind "prop" names at least one prop`)
    if (ZONE_KINDS_WITHOUT_PROPS.includes(zone.kind) && namedProps.length)
      problems.push(`${zoneWho}: kind "${zone.kind}" names no prop`)
    if (isToAdapt && zone.kind === "fixed") {
      problems.push(
        `${zoneWho}: a component to adapt has zones only where something changes; kind "change" for an item of "changes"`,
      )
    }
    if (zone.kind === "not-drawn" && !zone.notes?.some(isFilled)) {
      problems.push(
        `${zoneWho}: kind "not-drawn" needs a note saying why the component leaves it out`,
      )
    }
    const optionCount = zone.options?.length ?? 0
    if (
      zone.kind === "to-decide" &&
      (!isFilled(zone.question) ||
        optionCount < MIN_QUIZ_OPTIONS ||
        optionCount > MAX_QUIZ_OPTIONS)
    ) {
      problems.push(
        `${zoneWho}: kind "to-decide" needs "question" and ${MIN_QUIZ_OPTIONS} to ${MAX_QUIZ_OPTIONS} "options"`,
      )
    }
    const parts = zone.parts ?? []
    if (!parts.length)
      problems.push(`${zoneWho}: needs "parts", what it outlines`)
    for (const part of parts) {
      if (!listBoxesOfZonePart(part, component, inventory).length) {
        problems.push(
          `${zoneWho}: part ${JSON.stringify(part)} is drawn nowhere inside ${who}`,
        )
      }
    }
  }
  return problems
}

/**
 * Everything that keeps specs.json from being drawn. An empty list means it is valid.
 * @param {object} input
 * @param {ApprovedInventory} input.inventory
 * @param {SpecsFile} input.specsFile
 * @returns {string[]}
 */
export function listSpecProblems({ inventory, specsFile }) {
  const problems = []
  const versionOfInventory = inventory.fingerprint.figma.version
  if (specsFile.figmaVersion !== versionOfInventory) {
    problems.push(
      `specs.json was filled for Figma version ${specsFile.figmaVersion}, the inventory is at ${versionOfInventory}`,
    )
  }
  const components = listComponentsToSpecify(inventory)
  const specsByName = Map.groupBy(
    specsFile.components ?? [],
    (spec) => spec.codeComponent,
  )
  for (const component of components) {
    const specs = specsByName.get(component.codeComponent) ?? []
    if (specs.length !== 1) {
      problems.push(
        `${component.codeComponent}: ${specs.length} entries in specs.json, one is expected`,
      )
    }
    if (specs.length) {
      problems.push(
        ...listProblemsOfComponentSpec(specs[0], component, inventory),
      )
    }
  }
  for (const name of specsByName.keys()) {
    if (!components.some((component) => component.codeComponent === name)) {
      problems.push(
        `${name}: the inventory has no component to create or to adapt with this name`,
      )
    }
  }
  return problems
}
