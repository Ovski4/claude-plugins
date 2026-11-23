// @ts-check
// Writes cut.md: what the next steps of the workflow read instead of the page.
import { nameOutlines, nameScreens, titleCut } from "./cutWording.mjs"
import { buildFigmaNodeUrl } from "./figma.mjs"
import { listScreenNumbers } from "./mergeScreens.mjs"
import { groupByJudgement, VERDICTS, VERDICT_KEYS } from "./verdicts.mjs"

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
 * @param {object} cut
 * @param {{ number: number, name: string, nodeId: string }[]} cut.screens
 * @param {Fingerprint} cut.fingerprint
 * @param {string} cut.approvalDate "2026-11-23"
 * @param {JudgedCandidate[]} cut.judgedCandidates
 * @returns {string} the content of cut.md, in French
 */
export function buildCutSummary({
  screens,
  fingerprint,
  approvalDate,
  judgedCandidates,
}) {
  const { fileKey, lastModified, version } = fingerprint.figma
  const hasSeveralScreens = screens.length > 1
  const figmaLinks = screens.map(({ number, name, nodeId }) =>
    hasSeveralScreens
      ? `[écran ${number} « ${name} »](${buildFigmaNodeUrl(fileKey, nodeId)})`
      : `[Figma](${buildFigmaNodeUrl(fileKey, nodeId)})`,
  )
  const lines = [
    `# Découpage en composants — ${titleCut(screens)}`,
    "",
    `Validé par le développeur le ${approvalDate}. Maquette : ${figmaLinks.join(", ")}, modifiée le ${lastModified.slice(0, 10)} (version ${version}). Code : commit ${fingerprint.gitCommit}.`,
    "Les décisions marquées « développeur » font foi : ne pas les rejuger.",
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
              ? `, ${nameScreens(screenNumbers)}`
              : ""
          const figmaLink = `[nœud](${buildFigmaNodeUrl(fileKey, firstNodeId)})`
          return [
            `- **${nameOutlines(candidate, instances)} ${codeComponent ?? candidate.figmaName}**${codePath ? ` — \`${codePath}\`` : ""} — Figma « ${candidate.figmaName} » ×${instances.length}${where} (${figmaLink})`,
            ...(note ? [`  - ${note}`] : []),
            ...(developerDecision !== null
              ? [
                  `  - Développeur : ${developerDecision || "décision confirmée"}`,
                ]
              : []),
          ]
        }),
    )
    if (items.length)
      lines.push("", `## ${VERDICTS[verdictKey].label}`, "", ...items)
  }
  const notOutlined = judgedCandidates.filter(
    (candidate) => !candidate.outlined,
  )
  if (notOutlined.length) {
    const items = notOutlined.map(
      (candidate) =>
        `- ${candidate.number} ${candidate.figmaName} — ${candidate.note}`,
    )
    lines.push("", "## Pas un composant à part", "", ...items)
  }
  return `${lines.join("\n")}\n`
}
