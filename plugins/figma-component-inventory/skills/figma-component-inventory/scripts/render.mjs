// @ts-check
// Usage: node scripts/render.mjs <out-dir> [--approve]
// Checks verdicts.json against candidates.json, then writes cut.html: the capture of the
// Figma screen with one numbered outline per component, coloured by verdict.
// Nothing is drawn while a check fails: every problem is listed and the exit code is 3.
// --approve is run once the developer has said the cut is right: it stamps verdicts.json and
// writes cut.md, the list the next steps of the workflow read. The stamp holds a hash of the
// verdicts: any later change makes the page a draft again.
// Run from inside the repo whose code is judged: the code paths of verdicts.json are checked against it.
import fs from "node:fs"
import path from "node:path"
import { buildCutSummary } from "./lib/cutSummary.mjs"
import { buildFigmaNodeUrl } from "./lib/figma.mjs"
import { findRepoRoot } from "./lib/gitRepo.mjs"
import {
  applyVerdictsToCandidates,
  buildApproval,
  isApprovalStillValid,
  listNumbersStillToDecide,
  listVerdictProblems,
  VERDICTS,
  VERDICT_KEYS,
} from "./lib/verdicts.mjs"

const EXIT_CODE_FAILED = 1
const EXIT_CODE_INVALID_VERDICTS = 3
const EXIT_CODE_NOT_READY_TO_APPROVE = 4
const USAGE = "Usage: node scripts/render.mjs <out-dir> [--approve]"
// In template.html, where the data of the cut is written.
const CUT_PLACEHOLDER_IN_TEMPLATE = "/*CUT*/ null"
const TEMPLATE_FILE = path.join(import.meta.dirname, "template.html")

/** Stops the command: the message goes to the error output, the code tells the caller why. */
class CommandFailure extends Error {
  /**
   * @param {string} message
   * @param {number} exitCode
   */
  constructor(message, exitCode) {
    super(message)
    this.exitCode = exitCode
  }
}

function main() {
  const commandArguments = process.argv.slice(2)
  const outDir = commandArguments.find((argument) => !argument.startsWith("--"))
  if (!outDir) throw new CommandFailure(USAGE, EXIT_CODE_FAILED)
  const isApprovalAsked = commandArguments.includes("--approve")
  /** @param {string} fileName */
  const readJson = (fileName) =>
    JSON.parse(fs.readFileSync(path.join(outDir, fileName), "utf8"))
  const { fingerprint, screen, candidates } = readJson("candidates.json")
  /** @type {import("./lib/verdicts.mjs").VerdictsFile} */
  const verdictsFile = readJson("verdicts.json")
  const repoRoot = findRepoRoot()

  const problems = listVerdictProblems({
    candidates,
    figmaVersionOfCandidates: fingerprint.figma.version,
    verdictsFile,
    doesCodePathExist: (codePath) =>
      fs.existsSync(path.join(repoRoot, codePath)),
  })
  if (problems.length) {
    const message = `verdicts.json: ${problems.length} problem(s), nothing drawn\n- ${problems.join("\n- ")}`
    throw new CommandFailure(message, EXIT_CODE_INVALID_VERDICTS)
  }
  const judgedCandidates = applyVerdictsToCandidates(
    candidates,
    verdictsFile.verdicts,
  )

  if (isApprovalAsked) {
    const numbersStillToDecide = listNumbersStillToDecide(judgedCandidates)
    if (numbersStillToDecide.length) {
      const message = `Not approved: candidate(s) ${numbersStillToDecide.join(", ")} are still "to-decide"`
      throw new CommandFailure(message, EXIT_CODE_NOT_READY_TO_APPROVE)
    }
    verdictsFile.approval = buildApproval(verdictsFile.verdicts, new Date())
    fs.writeFileSync(
      path.join(outDir, "verdicts.json"),
      JSON.stringify(verdictsFile, null, 2),
    )
  }
  const approvalDate =
    verdictsFile.approval && isApprovalStillValid(verdictsFile)
      ? verdictsFile.approval.date
      : null
  if (verdictsFile.approval && !approvalDate) {
    console.error(
      `The verdicts changed since the approval of ${verdictsFile.approval.date}: the page is a draft again`,
    )
  }

  const capturePng = fs.readFileSync(path.join(outDir, screen.capture.file))
  const cut = {
    fingerprint,
    screen,
    figmaUrl: buildFigmaNodeUrl(
      fingerprint.figma.fileKey,
      fingerprint.figma.nodeId,
    ),
    approvalDate,
    captureDataUrl: `data:image/png;base64,${capturePng.toString("base64")}`,
    verdicts: VERDICT_KEYS.map((key) => ({
      key,
      label: VERDICTS[key].label,
      color: VERDICTS[key].color,
    })),
    candidates: judgedCandidates,
  }
  // "<" is escaped so that a note containing "</script>" cannot close the page's script.
  const cutAsScriptValue = JSON.stringify(cut).replace(/</g, "\\u003c")
  const pageFile = path.join(outDir, "cut.html")
  const template = fs.readFileSync(TEMPLATE_FILE, "utf8")
  fs.writeFileSync(
    pageFile,
    template.replace(CUT_PLACEHOLDER_IN_TEMPLATE, () => cutAsScriptValue),
  )

  const outlinedInstances = judgedCandidates
    .filter((candidate) => candidate.outlined)
    .flatMap((candidate) => candidate.instances)
  const instancesByVerdict = Map.groupBy(
    outlinedInstances,
    (instance) => instance.verdict,
  )
  const countsPerVerdict = VERDICT_KEYS.filter((key) =>
    instancesByVerdict.has(key),
  ).map(
    (key) => `${VERDICTS[key].label} ${instancesByVerdict.get(key)?.length}`,
  )
  console.log(pageFile)
  console.log(countsPerVerdict.join(" · "))
  console.log(
    approvalDate
      ? `Approved on ${approvalDate}`
      : "Draft: not approved by the developer",
  )

  if (isApprovalAsked && approvalDate) {
    const summaryFile = path.join(outDir, "cut.md")
    fs.writeFileSync(
      summaryFile,
      buildCutSummary({
        screenName: screen.name,
        fingerprint,
        approvalDate,
        judgedCandidates,
      }),
    )
    console.log(summaryFile)
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(
    error instanceof CommandFailure ? error.exitCode : EXIT_CODE_FAILED,
  )
}
