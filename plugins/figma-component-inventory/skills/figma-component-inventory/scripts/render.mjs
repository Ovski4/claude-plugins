// @ts-check
// Usage: node scripts/render.mjs <out-dir> [--approve]
// Checks verdicts.json against candidates.json, then writes inventory.html: the capture of the
// Figma screen with one numbered outline per component, coloured by verdict.
// Nothing is drawn while a check fails: every problem is listed and the exit code is 3.
// --approve is run once the developer has said the inventory is right: it stamps verdicts.json and
// writes inventory.md, the list the next steps of the workflow read. The stamp holds a hash of the
// verdicts: any later change makes the page a draft again. It also adds to the repo's
// Figma-to-code map the approved Figma components that existing code draws and that the map
// does not name yet, so that the next screen is pre-filled.
// Run from inside the repo whose code is judged: the code paths of verdicts.json are checked against it.
import fs from "node:fs"
import path from "node:path"
import { buildInventorySummary } from "./lib/inventorySummary.mjs"
import { buildFigmaNodeUrl } from "./lib/figma.mjs"
import { addApprovedComponentsToMap } from "./lib/figmaToCodeMap.mjs"
import { findRepoRoot } from "./lib/gitRepo.mjs"
import { buildPageDrawing } from "./lib/pageDrawing.mjs"
import { readProjectSettings } from "./lib/projectSettings.mjs"
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
// inventory.html is page/page.html with each of these comments replaced: by the page's styles,
// by its script, and by what the script draws. One file, which opens without a server.
const PAGE_FOLDER = path.join(import.meta.dirname, "page")
const PLACEHOLDERS_IN_PAGE = {
  styles: "/*PAGE_STYLES*/",
  script: "/*PAGE_SCRIPT*/",
  inventory: "/*INVENTORY*/",
}

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
  const { fingerprint, screens, candidates } = readJson("candidates.json")
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

  const verdicts = VERDICT_KEYS.map((key) => ({
    key,
    label: VERDICTS[key].label,
    color: VERDICTS[key].color,
  }))
  const inventory = {
    approvalDate,
    verdicts,
    ...buildPageDrawing({
      screens: screens.map(
        /** @param {import("./lib/pageDrawing.mjs").ScreenToDraw & { nodeId: string, capture: { file: string } }} screen */
        (screen) => ({
          ...screen,
          figmaUrl: buildFigmaNodeUrl(fingerprint.figma.fileKey, screen.nodeId),
          captureDataUrl: `data:image/png;base64,${fs.readFileSync(path.join(outDir, screen.capture.file)).toString("base64")}`,
        }),
      ),
      judgedCandidates,
      fingerprint,
    }),
  }
  /** @param {string} fileName */
  const readPageFile = (fileName) =>
    fs.readFileSync(path.join(PAGE_FOLDER, fileName), "utf8")
  // "<" is escaped so that a note containing "</script>" cannot close the data's script.
  const inventoryAsJson = JSON.stringify(inventory).replace(/</g, "\\u003c")
  const pageFile = path.join(outDir, "inventory.html")
  fs.writeFileSync(
    pageFile,
    readPageFile("page.html")
      .replace(PLACEHOLDERS_IN_PAGE.styles, () => readPageFile("page.css"))
      .replace(PLACEHOLDERS_IN_PAGE.script, () => readPageFile("page.js"))
      .replace(PLACEHOLDERS_IN_PAGE.inventory, () => inventoryAsJson),
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
    const summaryFile = path.join(outDir, "inventory.md")
    fs.writeFileSync(
      summaryFile,
      buildInventorySummary({
        screens,
        fingerprint,
        approvalDate,
        judgedCandidates,
      }),
    )
    console.log(summaryFile)
    const { figmaToCodeMap } = readProjectSettings(repoRoot)
    if (figmaToCodeMap !== null) {
      const mapFile = path.join(repoRoot, figmaToCodeMap)
      const { mapText, addedFigmaNames } = addApprovedComponentsToMap(
        fs.readFileSync(mapFile, "utf8"),
        judgedCandidates,
        approvalDate,
      )
      if (addedFigmaNames.length) {
        fs.writeFileSync(mapFile, mapText)
        console.log(
          `${figmaToCodeMap}: added ${addedFigmaNames.join(", ")} (format the table, then review and commit it)`,
        )
      }
    }
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
