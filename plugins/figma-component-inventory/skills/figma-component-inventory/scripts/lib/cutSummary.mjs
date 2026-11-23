// @ts-check
// Writes cut.md: what the next steps of the workflow read instead of the page.
import { buildFigmaNodeUrl } from "./figma.mjs"
import { VERDICTS, VERDICT_KEYS } from "./verdicts.mjs"

/** @typedef {import("./verdicts.mjs").JudgedCandidate} JudgedCandidate */
/**
 * What candidates.json was built on.
 * @typedef {object} Fingerprint
 * @property {string} createdAt "2026-11-23"
 * @property {{ fileKey: string, nodeId: string, version: string, lastModified: string }} figma
 * @property {string} gitCommit the short hash of the commit the code was read at
 */

/**
 * "6" when the instances are the whole candidate, "6a 6b" otherwise.
 * @param {JudgedCandidate} candidate
 * @param {JudgedCandidate["instances"]} instances
 */
function nameOutlines(candidate, instances) {
  if (instances.length === candidate.instances.length)
    return `${candidate.number}`
  return instances
    .map((instance) => `${candidate.number}${instance.letter}`)
    .join(" ")
}

/**
 * One section per verdict, one item per component, with its reason, the developer's decision
 * when he gave one, and where to look in Figma and in the code.
 * @param {object} cut
 * @param {string} cut.screenName
 * @param {Fingerprint} cut.fingerprint
 * @param {string} cut.approvalDate "2026-11-23"
 * @param {JudgedCandidate[]} cut.judgedCandidates
 * @returns {string} the content of cut.md, in French
 */
export function buildCutSummary({
  screenName,
  fingerprint,
  approvalDate,
  judgedCandidates,
}) {
  const { fileKey, nodeId, lastModified, version } = fingerprint.figma
  const lines = [
    `# Découpage en composants — ${screenName}`,
    "",
    `Validé par le développeur le ${approvalDate}. Maquette : [Figma](${buildFigmaNodeUrl(fileKey, nodeId)}), modifiée le ${lastModified.slice(0, 10)} (version ${version}). Code : commit ${fingerprint.gitCommit}.`,
    "Les décisions marquées « développeur » font foi : ne pas les rejuger.",
  ]
  const outlinedCandidates = judgedCandidates.filter(
    (candidate) => candidate.outlined,
  )
  for (const verdictKey of VERDICT_KEYS) {
    const items = outlinedCandidates.flatMap((candidate) => {
      const instances = candidate.instances.filter(
        (instance) => instance.verdict === verdictKey,
      )
      if (!instances.length) return []
      const { note, developerDecision, nodeId: firstNodeId } = instances[0]
      const codePath = candidate.codePath ? ` — \`${candidate.codePath}\`` : ""
      const figmaLink = `[nœud](${buildFigmaNodeUrl(fileKey, firstNodeId)})`
      return [
        `- **${nameOutlines(candidate, instances)} ${candidate.codeComponent ?? candidate.figmaName}**${codePath} — Figma « ${candidate.figmaName} » ×${instances.length} (${figmaLink})`,
        ...(note ? [`  - ${note}`] : []),
        ...(developerDecision !== null
          ? [`  - Développeur : ${developerDecision || "décision confirmée"}`]
          : []),
      ]
    })
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
