// @ts-check
// Usage: node scripts/candidates.mjs <figma-url> <out-dir> [--refresh] [--reset-verdicts]
// Reads one Figma screen and lists the components it uses, so that a model only has to name
// and judge them. Writes screen.png, candidates.json, the verdicts.json to fill and brief.md
// (what the model reads, also printed) in <out-dir>; the formats are described in the README of this folder.
// - Run from inside the repo whose code is judged: its settings file
//   (.claude/figma-component-inventory.json), its Figma-to-code map and its commit are read.
// - Needs FIGMA_TOKEN. Figma answers are kept in <out-dir>; --refresh asks Figma again.
// - An existing verdicts.json is kept, so that a second run does not erase the model's work;
//   --reset-verdicts empties it again, except the entries the developer decided.
import fs from "node:fs"
import path from "node:path"
import { buildBrief } from "./lib/brief.mjs"
import { collectCandidates } from "./lib/collectCandidates.mjs"
import {
  downloadCapture,
  locateCapture,
  parseFigmaUrl,
  readFigmaScreen,
} from "./lib/figma.mjs"
import { readFigmaToCodeMap } from "./lib/figmaToCodeMap.mjs"
import {
  findRepoRoot,
  listTrackedFiles,
  readCurrentCommit,
} from "./lib/gitRepo.mjs"
import { isComponentFile, readProjectSettings } from "./lib/projectSettings.mjs"
import { buildVerdictsSkeleton } from "./lib/verdicts.mjs"

/** @typedef {import("./lib/collectCandidates.mjs").Candidate & { mapLines: string[] }} CandidateWithMapLines */

const EXIT_CODE_FAILED = 1
const USAGE =
  "Usage: node scripts/candidates.mjs <figma-url> <out-dir> [--refresh] [--reset-verdicts]"

async function main() {
  const commandArguments = process.argv.slice(2)
  const [figmaUrl, outDir] = commandArguments.filter(
    (argument) => !argument.startsWith("--"),
  )
  if (!figmaUrl || !outDir) throw new Error(USAGE)
  const mustResetVerdicts = commandArguments.includes("--reset-verdicts")
  const figmaAccess = {
    token: process.env.FIGMA_TOKEN,
    cacheDir: outDir,
    mustAskFigmaAgain: commandArguments.includes("--refresh"),
  }

  const repoRoot = findRepoRoot()
  const projectSettings = readProjectSettings(repoRoot)
  const lookUpInFigmaToCodeMap = readFigmaToCodeMap(
    repoRoot,
    projectSettings.figmaToCodeMap,
  )

  fs.mkdirSync(outDir, { recursive: true })
  const { fileKey, nodeId } = parseFigmaUrl(figmaUrl)
  const figmaScreen = await readFigmaScreen(fileKey, nodeId, figmaAccess)
  const { screenNode } = figmaScreen
  const capture = locateCapture(
    screenNode,
    await downloadCapture(fileKey, nodeId, figmaAccess),
  )
  const collected = collectCandidates(
    screenNode,
    figmaScreen.componentsById,
    figmaScreen.componentSetsById,
  )
  /** @type {CandidateWithMapLines[]} */
  const candidates = collected.candidates.map((candidate) => ({
    ...candidate,
    mapLines: lookUpInFigmaToCodeMap(candidate.figmaName).mapLines,
  }))

  const candidatesFile = {
    fingerprint: {
      createdAt: new Date().toISOString().slice(0, 10),
      figma: {
        fileKey,
        nodeId,
        version: figmaScreen.version,
        lastModified: figmaScreen.lastModified,
      },
      gitCommit: readCurrentCommit(),
    },
    screen: {
      name: screenNode.name,
      width: Math.round(screenNode.absoluteBoundingBox?.width ?? 0),
      height: Math.round(screenNode.absoluteBoundingBox?.height ?? 0),
      capture,
      backdrop: collected.backdrop,
    },
    candidates,
  }
  fs.writeFileSync(
    path.join(outDir, "candidates.json"),
    JSON.stringify(candidatesFile, null, 2),
  )

  const verdictsFile = path.join(outDir, "verdicts.json")
  const hasVerdictsFile = fs.existsSync(verdictsFile)
  const isVerdictsFileKept = hasVerdictsFile && !mustResetVerdicts
  if (!isVerdictsFileKept) {
    const skeleton = buildVerdictsSkeleton({
      candidates,
      figmaVersion: figmaScreen.version,
      lookUpInFigmaToCodeMap,
      previousEntries: hasVerdictsFile
        ? JSON.parse(fs.readFileSync(verdictsFile, "utf8")).verdicts
        : [],
    })
    fs.writeFileSync(verdictsFile, JSON.stringify(skeleton, null, 2))
  }

  const brief = buildBrief({
    screenName: screenNode.name,
    backdrop: collected.backdrop,
    candidates,
    lookUpInFigmaToCodeMap,
    hasFigmaToCodeMap: projectSettings.figmaToCodeMap !== null,
    designSystemFolder: projectSettings.designSystemFolder,
    componentFiles: listTrackedFiles(
      repoRoot,
      projectSettings.componentsFolder,
    ).filter((file) =>
      isComponentFile(file, projectSettings.componentFileExtensions),
    ),
    readCodeFile: (codePath) => {
      const codeFile = path.join(repoRoot, codePath)
      return fs.existsSync(codeFile) && fs.statSync(codeFile).isFile()
        ? fs.readFileSync(codeFile, "utf8")
        : ""
    },
  })
  fs.writeFileSync(path.join(outDir, "brief.md"), brief)
  console.log(brief)
  console.log(
    isVerdictsFileKept
      ? "verdicts.json kept as it was"
      : "verdicts.json written: fill every verdict",
  )
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(EXIT_CODE_FAILED)
}
