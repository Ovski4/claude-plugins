// @ts-check
// Writes specs.md: what the next steps of the workflow (tickets, code) read instead of the
// page. One section per component, with its props, what changes and its zones.
import {
  nameScreens,
  titleInventory,
} from "../../../figma-component-inventory/scripts/lib/inventoryWording.mjs"
import { listScreenNumbers } from "../../../figma-component-inventory/scripts/lib/mergeScreens.mjs"
import { VERDICTS } from "../../../figma-component-inventory/scripts/lib/verdicts.mjs"
import {
  listBoxesOfZonePart,
  listComponentsToSpecify,
  PROP_CHANGE_LABELS,
  ZONE_KINDS,
} from "./componentSpecs.mjs"

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
    `\`${name}\`${change ? ` (${PROP_CHANGE_LABELS[change].toLowerCase()})` : ""}`,
    typeBefore ? `\`${typeBefore}\` → \`${type}\`` : `\`${type}\``,
    required ? "oui" : "non",
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
 * @returns {string} the content of specs.md, in French
 */
export function buildSpecsSummary({ inventory, specsFile, approvalDate }) {
  const { fingerprint, approvedOn, screens } = inventory
  const lines = [
    `# Props des composants — ${titleInventory(screens)}`,
    "",
    `Validé par le développeur le ${approvalDate}. Construit sur l'inventaire validé le ${approvedOn} : maquette Figma version ${fingerprint.figma.version}, code au commit ${fingerprint.gitCommit}.`,
    "Les décisions marquées « développeur » font foi : ne pas les rejuger.",
  ]
  for (const component of listComponentsToSpecify(inventory)) {
    const spec = specsFile.components.find(
      (each) => each.codeComponent === component.codeComponent,
    )
    if (!spec) continue
    lines.push(
      "",
      `## ${component.codeComponent} — ${VERDICTS[component.verdict].label}`,
    )
    if (component.codePath) lines.push("", `\`${component.codePath}\``)
    const decisionsAndChanges = [
      ...(spec.developerDecisions ?? []).map(
        (decision) => `- Développeur : ${decision}`,
      ),
      ...(spec.changes ?? []).map(
        ({ what, before, after }) =>
          `- À changer : ${what} : ${before} → ${after}`,
      ),
    ]
    if (decisionsAndChanges.length) lines.push("", ...decisionsAndChanges)
    if (spec.props.length) {
      lines.push(
        "",
        component.isToAdapt ? "Props nouvelles ou modifiées :" : "Props :",
        "",
        "| Prop | Type | Obligatoire | D'où vient la valeur | Règle |",
        "| --- | --- | --- | --- | --- |",
        ...spec.props.map(writePropRow),
      )
    }
    lines.push("", "Zones :", "")
    for (const zone of spec.zones) {
      const screenNumbers = listScreenNumbers(
        zone.parts.flatMap((part) =>
          listBoxesOfZonePart(part, component, inventory),
        ),
      ).toSorted((a, b) => a - b)
      const drivenBy = zone.props?.length
        ? ` : ${zone.props.map((name) => `\`${name}\``).join(", ")}`
        : ""
      lines.push(
        `- **${zone.letter} — ${zone.label}** (${ZONE_KINDS[zone.kind].label}${drivenBy} ; ${nameScreens(screenNumbers)})`,
        ...(zone.notes ?? []).map((note) => `  - ${note}`),
      )
    }
  }
  return `${lines.join("\n")}\n`
}
