// @ts-check
// Usage: node scripts/prepare.mjs <inventory-out-dir> [--reset-specs]
// Reads an approved inventory and prepares what the model needs to describe the components
// it says to create or to adapt: specs-brief.md and the specs.json to fill, both written in
// the inventory's folder. The brief is not printed: a long one would be cut by the tool
// that shows the command's output, so the model reads the file.
// - An inventory that is not approved, or not in the promised format, stops with exit code 2.
// - Run from inside the repo the inventory judged: the files of the components to adapt
//   are read there.
// - An existing specs.json is kept, so that a second run does not erase the model's work;
//   --reset-specs empties it again.
import fs from "node:fs"
import path from "node:path"
import {
  InventoryNotUsable,
  loadApprovedInventory,
} from "../../figma-component-inventory/scripts/lib/approvedInventory.mjs"
import { findRepoRoot } from "../../figma-component-inventory/scripts/lib/gitRepo.mjs"
import { readProjectSettings } from "../../figma-component-inventory/scripts/lib/projectSettings.mjs"
import {
  EXIT_CODE_FAILED,
  EXIT_CODE_INVENTORY_NOT_USABLE,
  SPECS_FILE_NAME,
} from "./lib/commandOutcome.mjs"
import { buildEmptySpecsFile } from "./lib/componentSpecs.mjs"
import { buildSpecsBrief } from "./lib/specsBrief.mjs"

const USAGE =
  "Usage: node scripts/prepare.mjs <inventory-out-dir> [--reset-specs]"
const BRIEF_FILE_NAME = "specs-brief.md"

function main() {
  const commandArguments = process.argv.slice(2)
  const outDir = commandArguments.find((argument) => !argument.startsWith("--"))
  if (!outDir) throw new Error(USAGE)
  const inventory = loadApprovedInventory(outDir)
  const repoRoot = findRepoRoot()

  const brief = buildSpecsBrief({
    inventory,
    projectLanguage: readProjectSettings(repoRoot).language,
    readCodeFile: (codePath) => {
      const file = path.join(repoRoot, codePath)
      return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""
    },
  })
  const briefPath = path.join(outDir, BRIEF_FILE_NAME)
  fs.writeFileSync(briefPath, brief)

  const specsPath = path.join(outDir, SPECS_FILE_NAME)
  const mustWriteEmptySpecs =
    commandArguments.includes("--reset-specs") || !fs.existsSync(specsPath)
  if (mustWriteEmptySpecs) {
    fs.writeFileSync(
      specsPath,
      JSON.stringify(buildEmptySpecsFile(inventory), null, 2),
    )
  }
  console.log(`${briefPath}: the brief, to read whole`)
  console.log(
    mustWriteEmptySpecs
      ? `${specsPath}: one empty entry per component, to fill`
      : `${specsPath}: kept as it was (--reset-specs empties it)`,
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(
    error instanceof InventoryNotUsable
      ? EXIT_CODE_INVENTORY_NOT_USABLE
      : EXIT_CODE_FAILED,
  )
}
