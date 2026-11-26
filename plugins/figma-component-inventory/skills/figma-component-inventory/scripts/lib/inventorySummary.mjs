// @ts-check
// Writes inventory.md: what the next steps of the workflow read instead of the page.
import { translateForWrittenFiles } from "./languages.mjs"
import {
  DEVELOPER_DECISIONS_RULE,
  nameOutlines,
  namePartNotOutlined,
  nameScreens,
  titleInventory,
} from "./inventoryWording.mjs"
import { buildFigmaNodeUrl } from "./figma.mjs"
import { listScreenNumbers } from "./mergeScreens.mjs"
import { groupByJudgement, VERDICT_KEYS } from "./verdicts.mjs"

/** @typedef {import("./verdicts.mjs").JudgedCandidate} JudgedCandidate */
/**
 * What candidates.json was built on.
 * @typedef {object} Fingerprint
 * @property {string} createdAt "2026-11-23"
 * @property {{ fileKey: string, version: string, lastModified: string }} figma
 * @property {string} gitCommit the short hash of the commit the code was read at
 */

/**
 * One section per verdict, one item per component, with its reason, the developer's decision
 * when he gave one, and where to look in Figma and in the code.
 * @param {object} inventory
 * @param {{ number: number, name: string, nodeId: string }[]} inventory.screens
 * @param {Fingerprint} inventory.fingerprint
 * @param {string} inventory.approvalDate "2026-11-23"
 * @param {JudgedCandidate[]} inventory.judgedCandidates
 * @returns {string} the content of inventory.md
 */
export function buildInventorySummary({
  screens,
  fingerprint,
  approvalDate,
  judgedCandidates,
}) {
  const { fileKey, lastModified, version } = fingerprint.figma
  const hasSeveralScreens = screens.length > 1
  const figmaLinks = screens.map(({ number, name, nodeId }) =>
    hasSeveralScreens
      ? `[screen ${number} "${name}"](${buildFigmaNodeUrl(fileKey, nodeId)})`
      : `[Figma](${buildFigmaNodeUrl(fileKey, nodeId)})`,
  )
  const lines = [
    `# Component inventory — ${titleInventory(screens, translateForWrittenFiles)}`,
    "",
    `Approved by the developer on ${approvalDate}. Design: ${figmaLinks.join(", ")}, last changed on ${lastModified.slice(0, 10)} (version ${version}). Code: commit ${fingerprint.gitCommit}.`,
    DEVELOPER_DECISIONS_RULE,
  ]
  const outlinedCandidates = judgedCandidates.filter(
    (candidate) => candidate.outlined,
  )
  for (const verdictKey of VERDICT_KEYS) {
    const items = outlinedCandidates.flatMap((candidate) =>
      // A candidate that is several React components gets one item per component.
      groupByJudgement(candidate.instances)
        .filter(([{ verdict }]) => verdict === verdictKey)
        .flatMap((instances) => {
          const [
            {
              codeComponent,
              note,
              developerDecision,
              codePath,
              nodeId: firstNodeId,
            },
          ] = instances
          const screenNumbers = listScreenNumbers(instances)
          const where =
            hasSeveralScreens && screenNumbers.length < screens.length
              ? `, ${nameScreens(screenNumbers, translateForWrittenFiles)}`
              : ""
          const figmaLink = `[node](${buildFigmaNodeUrl(fileKey, firstNodeId)})`
          return [
            `- **${nameOutlines(candidate, instances)} ${codeComponent ?? candidate.figmaName}**${codePath ? ` — \`${codePath}\`` : ""} — Figma "${candidate.figmaName}" ×${instances.length}${where} (${figmaLink})`,
            ...(note ? [`  - ${note}`] : []),
            ...(developerDecision !== null
              ? [`  - Developer: ${developerDecision || "decision confirmed"}`]
              : []),
          ]
        }),
    )
    if (items.length)
      lines.push(
        "",
        `## ${translateForWrittenFiles(`verdict.${verdictKey}`)}`,
        "",
        ...items,
      )
  }
  const items = judgedCandidates.flatMap((candidate) =>
    candidate.outlined
      ? candidate.partsNotOutlined.map(
          (part) =>
            `- ${namePartNotOutlined(candidate, part, translateForWrittenFiles)} — ${part.note}`,
        )
      : [`- ${candidate.number} ${candidate.figmaName} — ${candidate.note}`],
  )
  if (items.length) {
    lines.push("", "## Not a component of its own", "", ...items)
  }
  return `${lines.join("\n")}\n`
}
