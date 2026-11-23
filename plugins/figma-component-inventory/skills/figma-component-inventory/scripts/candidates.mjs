// @ts-check
// Usage: node scripts/candidates.mjs <out-dir> <figma-url>... [--refresh] [--reset-verdicts]
// Reads one or several Figma screens of one design and lists the components they use, so
// that a model only has to name and judge them. Writes a capture per screen,
// candidates.json, the verdicts.json to fill and brief.md (what the model reads, also
// printed) in <out-dir>; the formats are described in the README of the plugin.
// - Several links: the screens must be in one Figma file. A component keeps one number on
//   every screen, and the brief points out the areas whose content differs between screens.
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
import { mergeScreenCandidates } from "./lib/mergeScreens.mjs"
import { buildVerdictsSkeleton } from "./lib/verdicts.mjs"

/** @typedef {import("./lib/mergeScreens.mjs").MergedCandidate & { mapLines: string[] }} CandidateWithMapLines */

const EXIT_CODE_FAILED = 1
const USAGE =
  "Usage: node scripts/candidates.mjs <out-dir> <figma-url>... [--refresh] [--reset-verdicts]"

async function main() {
  const commandArguments = process.argv.slice(2)
  const [outDir, ...figmaUrls] = commandArguments.filter(
    (argument) => !argument.startsWith("--"),
  )
  if (!outDir || !figmaUrls.length) throw new Error(USAGE)
  const screenAddresses = figmaUrls.map(parseFigmaUrl)
  const [{ fileKey }] = screenAddresses
  if (screenAddresses.some((address) => address.fileKey !== fileKey))
    throw new Error("The screens must all be in the same Figma file")
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
  const screens = []
  const candidatesByScreen = []
  let figmaFile = { version: "", lastModified: "" }
  for (const [screenIndex, { nodeId }] of screenAddresses.entries()) {
    const figmaScreen = await readFigmaScreen(fileKey, nodeId, figmaAccess)
    const { screenNode } = figmaScreen
    const collected = collectCandidates(
      screenNode,
      figmaScreen.componentsById,
      figmaScreen.componentSetsById,
    )
    figmaFile = figmaScreen
    candidatesByScreen.push(collected.candidates)
    screens.push({
      number: screenIndex + 1,
      nodeId,
      name: screenNode.name,
      width: Math.round(screenNode.absoluteBoundingBox?.width ?? 0),
      height: Math.round(screenNode.absoluteBoundingBox?.height ?? 0),
      capture: locateCapture(
        screenNode,
        await downloadCapture(fileKey, nodeId, figmaAccess),
      ),
      backdrop: collected.backdrop,
    })
  }
  /** @type {CandidateWithMapLines[]} */
  const candidates = mergeScreenCandidates(candidatesByScreen).map(
    (candidate) => ({
      ...candidate,
      mapLines: lookUpInFigmaToCodeMap(candidate.figmaName).mapLines,
    }),
  )

  const candidatesFile = {
    fingerprint: {
      createdAt: new Date().toISOString().slice(0, 10),
      figma: {
        fileKey,
        version: figmaFile.version,
        lastModified: figmaFile.lastModified,
      },
      gitCommit: readCurrentCommit(),
    },
    screens,
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
      figmaVersion: figmaFile.version,
      lookUpInFigmaToCodeMap,
      previousEntries: hasVerdictsFile
        ? JSON.parse(fs.readFileSync(verdictsFile, "utf8")).verdicts
        : [],
    })
    fs.writeFileSync(verdictsFile, JSON.stringify(skeleton, null, 2))
  }

  const brief = buildBrief({
    screens,
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
