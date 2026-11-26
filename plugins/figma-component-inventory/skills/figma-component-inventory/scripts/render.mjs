// @ts-check
// Usage: node scripts/render.mjs <out-dir> [--approve]
// Checks verdicts.json against candidates.json, then writes inventory.html: the capture of the
// Figma screen with one numbered outline per component, coloured by verdict.
// Nothing is drawn while a check fails: every problem is listed and the exit code is 3.
// --approve is run once the developer says in the conversation that he approves; it is refused
// while a verdict is "to-decide", and when verdicts.json changed since inventory.html was drawn
// (exit code 4). It stamps verdicts.json and writes inventory.md,
// the list the next steps of the workflow read. The stamp holds a hash of the verdicts: any later change makes the page a draft again. It also adds to the repo's
// Figma-to-code map the approved Figma components that existing code draws and that the map
// does not name yet, so that the next screen is pre-filled.
// Run from inside the repo whose code is judged: the code paths of verdicts.json are checked against it.
import fs from "node:fs"
import path from "node:path"
import {
  readWhetherApprovalIsAsked,
  refuseApprovalOfContentNotOnThePage,
  refuseApprovalWhileUndecided,
} from "./lib/approval.mjs"
import { writeInventoryIndex } from "./lib/inventoryIndex.mjs"
import { buildInventorySummary } from "./lib/inventorySummary.mjs"
import { buildFigmaNodeUrl } from "./lib/figma.mjs"
import { addApprovedComponentsToMap } from "./lib/figmaToCodeMap.mjs"
import { WRITTEN_FILES_LANGUAGE } from "./lib/languages.mjs"
import { findRepoRoot } from "./lib/gitRepo.mjs"
import { buildPageDrawing } from "./lib/pageDrawing.mjs"
import { readProjectSettings } from "./lib/projectSettings.mjs"
import {
  CommandFailure,
  readCaptureAsDataUrl,
  writeStandalonePage,
} from "./lib/standalonePage.mjs"
import {
  applyVerdictsToCandidates,
  buildApproval,
  hashVerdicts,
  VERDICTS_HASH_KEY,
  isApprovalStillValid,
  listNumbersStillToDecide,
  listVerdictProblems,
  NOT_A_COMPONENT,
  VERDICTS,
  VERDICT_KEYS,
} from "./lib/verdicts.mjs"

const EXIT_CODE_FAILED = 1
const EXIT_CODE_INVALID_VERDICTS = 3
const USAGE = "Usage: node scripts/render.mjs <out-dir> [--approve]"
const PAGE_FILE_NAME = "inventory.html"
const PAGE_FOLDER = path.join(import.meta.dirname, "page")
// Builds the text of the developer's corrections, in the page.
const FEEDBACK_TEXT_MODULE = path.join(
  import.meta.dirname,
  "lib",
  "feedbackText.mjs",
)

function main() {
  const commandArguments = process.argv.slice(2)
  const outDir = commandArguments.find((argument) => !argument.startsWith("--"))
  if (!outDir) throw new CommandFailure(USAGE, EXIT_CODE_FAILED)
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

  const candidatesStillToDecide = listNumbersStillToDecide(
    judgedCandidates,
  ).map((number) => `candidate ${number}`)
  const pageFile = path.join(outDir, PAGE_FILE_NAME)
  const isApproving = readWhetherApprovalIsAsked(commandArguments)
  if (isApproving) {
    refuseApprovalWhileUndecided(candidatesStillToDecide)
    refuseApprovalOfContentNotOnThePage({
      pageFile,
      hashKey: VERDICTS_HASH_KEY,
      contentToApprove: verdictsFile.verdicts,
    })
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

  const verdictsOfOutlines = new Set(
    judgedCandidates.flatMap((candidate) =>
      candidate.instances.map((instance) => instance.verdict),
    ),
  )
  const verdicts = VERDICT_KEYS.map((key) => ({
    key,
    labels: VERDICTS[key].labels,
    color: VERDICTS[key].color,
    // The legend names only the verdicts the page draws.
    isDrawnOnThePage: verdictsOfOutlines.has(key),
  }))
  const inventory = {
    approvalDate,
    // What keeps the page from inviting the developer to approve, as the script counts it.
    stillToDecideCount: candidatesStillToDecide.length,
    verdicts,
    // The correction form offers every verdict, and one more for what is no component.
    correctionVerdicts: [
      ...verdicts.map(({ key, labels }) => ({ key, labels })),
      NOT_A_COMPONENT,
    ],
    // Corrections kept in the browser are dropped once the verdicts change.
    [VERDICTS_HASH_KEY]: hashVerdicts(verdictsFile.verdicts),
    ...buildPageDrawing({
      screens: screens.map(
        /** @param {import("./lib/pageDrawing.mjs").ScreenToDraw & { nodeId: string, capture: { file: string } }} screen */
        (screen) => ({
          ...screen,
          figmaUrl: buildFigmaNodeUrl(fingerprint.figma.fileKey, screen.nodeId),
          captureDataUrl: readCaptureAsDataUrl(
            path.join(outDir, screen.capture.file),
          ),
        }),
      ),
      judgedCandidates,
      fingerprint,
    }),
  }
  writeStandalonePage({
    pageFolder: PAGE_FOLDER,
    feedbackTextModule: FEEDBACK_TEXT_MODULE,
    pageData: inventory,
    pageFile,
  })

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
    (key) =>
      `${VERDICTS[key].labels[WRITTEN_FILES_LANGUAGE]} ${instancesByVerdict.get(key)?.length}`,
  )
  console.log(pageFile)
  console.log(countsPerVerdict.join(" · "))
  console.log(
    approvalDate
      ? `Approved on ${approvalDate}`
      : "Draft: not approved by the developer",
  )

  if (isApproving && approvalDate) {
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
  // The list of every inventory beside this one, with where each stands.
  console.log(writeInventoryIndex(outDir))
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(
    error instanceof CommandFailure ? error.exitCode : EXIT_CODE_FAILED,
  )
}
