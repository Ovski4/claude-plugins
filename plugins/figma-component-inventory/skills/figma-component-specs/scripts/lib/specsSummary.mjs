// @ts-check
// Writes specs.md: what the next steps of the workflow (tickets, code) read instead of the
// page. One section per component, with its props, what changes and its zones.
import { WRITTEN_FILES_LANGUAGE } from "../../../figma-component-inventory/scripts/lib/languages.mjs"
import { buildTranslate } from "../../../figma-component-inventory/scripts/page/pageTexts.mjs"
import { OWN_PAGE_TEXTS } from "../page/ownTexts.mjs"
import {
  DEVELOPER_DECISIONS_RULE,
  nameScreens,
  titleInventory,
} from "../../../figma-component-inventory/scripts/lib/inventoryWording.mjs"
import { listScreenNumbers } from "../../../figma-component-inventory/scripts/lib/mergeScreens.mjs"
import {
  listBoxesOfZonePart,
  listComponentsToSpecify,
} from "./componentSpecs.mjs"

// specs.md takes the names of verdicts and of kinds of zones from the specs page's
// dictionaries, in the language of the files.
const translate = buildTranslate(WRITTEN_FILES_LANGUAGE, OWN_PAGE_TEXTS)

/** @typedef {import("./componentSpecs.mjs").ApprovedInventory} ApprovedInventory */
/** @typedef {import("./componentSpecs.mjs").SpecsFile} SpecsFile */
/** @typedef {import("./componentSpecs.mjs").PropSpec} PropSpec */

// A "|" inside a cell, as in the type "start" | "end", would end the cell.
const writeTableCell = (/** @type {string} */ text) =>
  text.replaceAll("|", "\\|")

/** @param {PropSpec} prop */
const writePropRow = ({
  name,
  type,
  typeBefore,
  required,
  source,
  note,
  change,
}) =>
  `| ${[
    `\`${name}\`${change ? ` (${translate(`propChange.${change}`).toLowerCase()})` : ""}`,
    typeBefore ? `\`${typeBefore}\` → \`${type}\`` : `\`${type}\``,
    required ? "yes" : "no",
    source,
    note ?? "",
  ]
    .map(writeTableCell)
    .join(" | ")} |`

/**
 * @param {object} input
 * @param {ApprovedInventory} input.inventory
 * @param {SpecsFile} input.specsFile one that `listSpecProblems` finds no problem in
 * @param {string} input.approvalDate "2026-11-24"
 * @returns {string} the content of specs.md
 */
export function buildSpecsSummary({ inventory, specsFile, approvalDate }) {
  const { fingerprint, approvedOn, screens } = inventory
  const lines = [
    `# Component props — ${titleInventory(screens, translate)}`,
    "",
    `Approved by the developer on ${approvalDate}. Built on the inventory approved on ${approvedOn}: Figma design version ${fingerprint.figma.version}, code at commit ${fingerprint.gitCommit}.`,
    DEVELOPER_DECISIONS_RULE,
  ]
  for (const component of listComponentsToSpecify(inventory)) {
    const spec = specsFile.components.find(
      (each) => each.codeComponent === component.codeComponent,
    )
    if (!spec) continue
    lines.push(
      "",
      `## ${component.codeComponent} — ${translate(`verdict.${component.verdict}`)}`,
    )
    if (component.codePath) lines.push("", `\`${component.codePath}\``)
    const decisionsAndChanges = [
      ...(spec.developerDecisions ?? []).map(
        (decision) => `- Developer: ${decision}`,
      ),
      ...(spec.changes ?? []).map(
        ({ what, before, after }) =>
          `- To change: ${what}: ${before} → ${after}`,
      ),
    ]
    if (decisionsAndChanges.length) lines.push("", ...decisionsAndChanges)
    if (spec.props.length) {
      lines.push(
        "",
        component.isToAdapt ? "New or changed props:" : "Props:",
        "",
        "| Prop | Type | Required | Where the value comes from | Rule |",
        "| --- | --- | --- | --- | --- |",
        ...spec.props.map(writePropRow),
      )
    }
    lines.push("", "Zones:", "")
    for (const zone of spec.zones) {
      const screenNumbers = listScreenNumbers(
        zone.parts.flatMap((part) =>
          listBoxesOfZonePart(part, component, inventory),
        ),
      ).toSorted((a, b) => a - b)
      const drivenBy = zone.props?.length
        ? `: ${zone.props.map((name) => `\`${name}\``).join(", ")}`
        : ""
      lines.push(
        `- **${zone.letter} — ${zone.label}** (${translate(`zoneKind.${zone.kind}`)}${drivenBy}; ${nameScreens(screenNumbers, translate)})`,
        ...(zone.notes ?? []).map((note) => `  - ${note}`),
      )
    }
  }
  return `${lines.join("\n")}\n`
}
