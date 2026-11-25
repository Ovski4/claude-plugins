// @ts-check
// Writes the brief the model reads before filling specs.json: for each component to create
// or to adapt, what the approved inventory says of it and what it holds on each screen,
// named the way a zone's "parts" name it.
import { extractPropsDeclarations } from "../../../figma-component-inventory/scripts/lib/brief.mjs"
import {
  isBoxInside,
  isBoxStrictlyInside,
} from "../../../figma-component-inventory/scripts/lib/box.mjs"
import { VERDICTS } from "../../../figma-component-inventory/scripts/lib/verdicts.mjs"
import {
  listComponentsToSpecify,
  listEveryInstance,
  listTextsOfScreen,
} from "./componentSpecs.mjs"

/** @typedef {import("./componentSpecs.mjs").ApprovedInventory} ApprovedInventory */
/** @typedef {import("./componentSpecs.mjs").ComponentToSpecify} ComponentToSpecify */
/** @typedef {ComponentToSpecify["instances"][number]} ComponentInstance */
/** @typedef {import("./componentSpecs.mjs").Box} Box */
/**
 * One use of an inventory candidate, whether or not the inventory outlines it.
 * @typedef {object} DrawnInstance
 * @property {string} id the inventory's number and letter, "11a"
 * @property {string} figmaName
 * @property {number} screen
 * @property {Box} box
 * @property {string} variant "" when the Figma component has no variant
 * @property {string[]} icons the icon components directly inside it: what tells apart two uses of one variant
 * @property {string} judgement what the inventory says of it: "Select, à adapter"
 * @property {boolean} isReactComponent false for a frame the inventory gives no component to
 */

const NO_COMPONENT_OF_ITS_OWN = "no React component of its own"

/**
 * @param {ApprovedInventory} inventory
 * @returns {DrawnInstance[]}
 */
function listDrawnInstances(inventory) {
  return inventory.judgedCandidates.flatMap((candidate) =>
    listEveryInstance(candidate).map((instance) => {
      const { id, screen, box, variant, verdict, codeComponent } = instance
      const { icons = [] } = instance
      const isReactComponent = instance.isOutlined && Boolean(verdict)
      return {
        id,
        figmaName: candidate.figmaName,
        screen,
        box,
        variant,
        icons,
        judgement:
          isReactComponent && verdict
            ? [codeComponent, VERDICTS[verdict].label]
                .filter(Boolean)
                .join(", ")
            : NO_COMPONENT_OF_ITS_OWN,
        isReactComponent,
      }
    }),
  )
}

/**
 * What one use of a component holds: the candidates and the texts drawn inside it. What a
 * nested React component holds is left out: the parent names that component, and its
 * content is its own business.
 * Two uses with the same box are neither inside the other (isBoxStrictlyInside). The
 * inventory's own rule (isPlacedInside, mergeScreens.mjs) breaks that tie by kind, depth
 * and order in the Figma tree, which the approved inventory does not promise to a later
 * step. Example: « Mode settings » and « Callout — mode Off », two frames of the same
 * depth with the same box, where only the tree order decides.
 * @param {ComponentInstance} componentInstance
 * @param {ApprovedInventory} inventory
 * @param {DrawnInstance[]} drawnInstances
 * @returns {string[]} the lines of the brief for that use
 */
function describeComponentInstance(
  componentInstance,
  inventory,
  drawnInstances,
) {
  const { screen, box, variant, id: ownId } = componentInstance
  // A frame with exactly the component's box is what wraps it, a row holding one field:
  // listed under the component, it would read as one of its parts.
  const instancesInside = drawnInstances.filter(
    (drawn) =>
      drawn.screen === screen &&
      drawn.id !== ownId &&
      isBoxStrictlyInside(drawn.box, box),
  )
  const nestedComponents = instancesInside.filter(
    (drawn) => drawn.isReactComponent,
  )
  /** @param {Box} heldBox */
  const isHeldByANestedComponent = (heldBox) =>
    nestedComponents.some((nested) => isBoxStrictlyInside(heldBox, nested.box))
  const heldInstances = instancesInside.filter(
    (drawn) => !isHeldByANestedComponent(drawn.box),
  )
  const heldTexts = listTextsOfScreen(inventory, screen).filter(
    (text) =>
      isBoxInside(text.box, box) &&
      !nestedComponents.some((nested) => isBoxInside(text.box, nested.box)),
  )
  const variantShown = variant ? `, variant ${JSON.stringify(variant)}` : ""
  return [
    `- Screen ${screen}, instance ${ownId}${variantShown}, ${box.width} × ${box.height} px`,
    ...heldInstances.map((held) => {
      const variantOfHeld = held.variant ? ` [${held.variant}]` : ""
      const iconsOfHeld = held.icons.length
        ? `, icon ${held.icons.join(" + ")}`
        : ""
      return `  - ${held.id} ${held.figmaName}${variantOfHeld}${iconsOfHeld} — ${held.judgement}`
    }),
    heldTexts.length
      ? `  - Texts: ${heldTexts.map((text) => JSON.stringify(text.characters)).join(", ")}`
      : "  - No text",
  ]
}

/**
 * @param {object} input
 * @param {ApprovedInventory} input.inventory
 * @param {(codePath: string) => string} input.readCodeFile "" when the file cannot be read
 * @returns {string} the content of specs-brief.md
 */
export function buildSpecsBrief({ inventory, readCodeFile }) {
  const { fingerprint, approvedOn, screens } = inventory
  const components = listComponentsToSpecify(inventory)
  const drawnInstances = listDrawnInstances(inventory)
  const lines = [
    `# ${components.length} components to specify`,
    "",
    `From the inventory approved on ${approvedOn} (Figma version ${fingerprint.figma.version}, commit ${fingerprint.gitCommit}).`,
    "",
    ...screens.map(
      ({ number, name, capture }) => `${number}. ${name} — \`${capture.file}\``,
    ),
    "",
    "Under a component, what a nested React component holds is not repeated: the zone names that component, and its content is listed in its own section when it is to specify.",
    "",
    'A zone\'s "parts" name what is listed under a component: a candidate by its number (`{ "candidate": 19 }`), one use by number and letter (`{ "instance": "11a" }`), a text by its exact characters (`{ "text": "Consigne" }`).',
    "",
  ]
  for (const component of components) {
    const [firstInstance] = component.instances
    const figmaNames = [
      ...new Set(
        component.instances.map(
          ({ candidateNumber, candidateFigmaName }) =>
            `${candidateNumber} ${candidateFigmaName}`,
        ),
      ),
    ]
    lines.push(
      `## ${component.codeComponent} — ${VERDICTS[component.verdict].label}`,
      "",
      `- Inventory candidate: ${figmaNames.join(", ")}`,
    )
    if (firstInstance.note)
      lines.push(`- Inventory's reason: ${firstInstance.note}`)
    if (firstInstance.developerDecision) {
      lines.push(
        `- Decided by the developer, not to be judged again: ${firstInstance.developerDecision}`,
      )
    }
    if (component.codePath) {
      const propsDeclarations = extractPropsDeclarations(
        readCodeFile(component.codePath),
      )
      lines.push(
        propsDeclarations
          ? `- Props declared in \`${component.codePath}\`:`
          : `- \`${component.codePath}\` declares no \`…Props\` type: open the file`,
      )
      if (propsDeclarations) lines.push("```ts", propsDeclarations, "```")
    }
    lines.push(
      "",
      "What it holds, on each screen it is drawn on:",
      "",
      ...component.instances.flatMap((instance) =>
        describeComponentInstance(instance, inventory, drawnInstances),
      ),
      "",
    )
  }
  return lines.join("\n")
}
