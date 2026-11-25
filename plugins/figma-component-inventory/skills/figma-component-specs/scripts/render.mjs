// @ts-check
// Usage: node scripts/render.mjs <inventory-out-dir> [--approve=<code>]
// Checks specs.json of an approved inventory's folder, then writes specs.html there: one tab
// per component to create or to adapt, its captures with one outline per zone, and the
// props that drive each zone.
// --approve=<code> is run by the developer: the page shows the command, with its code, once he
// has ticked every box. The code names the specs the page shows: the approval is refused when
// they changed since, and while a zone is "to-decide" (exit code 4). It stamps specs.json and
// writes specs.md, what the next steps read.
// Nothing is drawn while a check fails: every problem is listed and the exit code is 3.
// An inventory that is not approved, or not in the promised format, stops with exit code 2.
import fs from "node:fs"
import path from "node:path"
import {
  buildApproveCommand,
  explainRefusedApproval,
  readApprovalAsked,
} from "../../figma-component-inventory/scripts/lib/approval.mjs"
import { findRepoRoot } from "../../figma-component-inventory/scripts/lib/gitRepo.mjs"
import { writeInventoryIndex } from "../../figma-component-inventory/scripts/lib/inventoryIndex.mjs"
import {
  InventoryNotUsable,
  loadApprovedInventory,
} from "../../figma-component-inventory/scripts/lib/approvedInventory.mjs"
import {
  CommandFailure,
  readCaptureAsDataUrl,
  writeStandalonePage,
} from "../../figma-component-inventory/scripts/lib/standalonePage.mjs"
import {
  EXIT_CODE_FAILED,
  EXIT_CODE_INVENTORY_NOT_USABLE,
  EXIT_CODE_INVALID_SPECS,
  EXIT_CODE_NOT_APPROVED,
  SPECS_FILE_NAME,
} from "./lib/commandOutcome.mjs"
import { listSpecProblems } from "./lib/componentSpecs.mjs"
import {
  buildSpecsApproval,
  listZonesStillToDecide,
  readStandingApprovalDate,
} from "./lib/specsApproval.mjs"
import { buildSpecsPageDrawing } from "./lib/specsPageDrawing.mjs"
import { buildSpecsSummary } from "./lib/specsSummary.mjs"

const USAGE =
  "Usage: node scripts/render.mjs <inventory-out-dir> [--approve=<code>]"
const PAGE_FILE_NAME = "specs.html"
const SUMMARY_FILE_NAME = "specs.md"
const PAGE_FOLDER = path.join(import.meta.dirname, "page")
// Builds the text of the developer's corrections, in the page.
const FEEDBACK_TEXT_MODULE = path.join(
  import.meta.dirname,
  "lib",
  "specsFeedbackText.mjs",
)

function main() {
  const commandArguments = process.argv.slice(2)
  const outDir = commandArguments.find((argument) => !argument.startsWith("--"))
  if (!outDir) throw new CommandFailure(USAGE, EXIT_CODE_FAILED)
  const inventory = loadApprovedInventory(outDir)
  const specsPath = path.join(outDir, SPECS_FILE_NAME)
  if (!fs.existsSync(specsPath)) {
    throw new CommandFailure(
      `${specsPath} is missing: it is the file the model fills before the page is drawn.`,
      EXIT_CODE_FAILED,
    )
  }
  /** @type {import("./lib/componentSpecs.mjs").SpecsFile} */
  const specsFile = JSON.parse(fs.readFileSync(specsPath, "utf8"))
  const problems = listSpecProblems({ inventory, specsFile })
  if (problems.length) {
    const message = `${SPECS_FILE_NAME}: ${problems.length} problem(s), nothing drawn\n- ${problems.join("\n- ")}`
    throw new CommandFailure(message, EXIT_CODE_INVALID_SPECS)
  }

  const { isApprovalAsked, givenCode } = readApprovalAsked(commandArguments)
  if (isApprovalAsked) {
    const refusal = explainRefusedApproval({
      givenCode,
      contentToApprove: specsFile.components,
      pageFileName: PAGE_FILE_NAME,
      stillToDecide: listZonesStillToDecide(specsFile),
    })
    if (refusal) throw new CommandFailure(refusal, EXIT_CODE_NOT_APPROVED)
    specsFile.approval = buildSpecsApproval(specsFile.components, new Date())
    fs.writeFileSync(specsPath, JSON.stringify(specsFile, null, 2))
  } else if (specsFile.approval && !readStandingApprovalDate(specsFile)) {
    console.error(
      `The specs changed since the approval of ${specsFile.approval.date}: the page is a draft again`,
    )
  }

  const drawing = buildSpecsPageDrawing({ inventory, specsFile })
  const captureFiles = new Set(
    drawing.components.flatMap((component) =>
      component.screens.map((screen) => screen.capture.file),
    ),
  )
  const specs = {
    ...drawing,
    // What the developer runs once he has ticked every box; null on an approved page.
    approveCommand: drawing.approvalDate
      ? null
      : buildApproveCommand({
          workingFolder: findRepoRoot(),
          renderScript: import.meta.filename,
          outDir: path.resolve(outDir),
          contentToApprove: specsFile.components,
        }),
    // A capture is written once, whatever the number of components drawn on its screen.
    captureDataUrlsByFile: Object.fromEntries(
      [...captureFiles].map((file) => [
        file,
        readCaptureAsDataUrl(path.join(outDir, file)),
      ]),
    ),
  }
  const pageFile = path.join(outDir, PAGE_FILE_NAME)
  writeStandalonePage({
    pageFolder: PAGE_FOLDER,
    feedbackTextModule: FEEDBACK_TEXT_MODULE,
    pageData: specs,
    pageFile,
  })
  console.log(pageFile)
  console.log(
    drawing.approvalDate
      ? `Approved on ${drawing.approvalDate}`
      : "Draft: not approved by the developer",
  )
  console.log(
    drawing.components
      .map(
        ({ codeComponent, props, zones }) =>
          `${codeComponent}: ${props.length} props, ${zones.length} zones`,
      )
      .join(" · "),
  )
  if (isApprovalAsked && drawing.approvalDate) {
    const summaryFile = path.join(outDir, SUMMARY_FILE_NAME)
    fs.writeFileSync(
      summaryFile,
      buildSpecsSummary({
        inventory,
        specsFile,
        approvalDate: drawing.approvalDate,
      }),
    )
    console.log(summaryFile)
  }
  // The list of every inventory beside this one, with where each one's specs stand.
  console.log(writeInventoryIndex(outDir))
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  const exitCodeOfInventory =
    error instanceof InventoryNotUsable
      ? EXIT_CODE_INVENTORY_NOT_USABLE
      : EXIT_CODE_FAILED
  process.exit(
    error instanceof CommandFailure ? error.exitCode : exitCodeOfInventory,
  )
}
