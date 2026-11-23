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
  // Each screen's tree and capture are asked of Figma at the same time.
  const readings = await Promise.all(
    screenAddresses.map(async ({ nodeId }, screenIndex) => {
      const [figmaScreen, captureSize] = await Promise.all([
        readFigmaScreen(fileKey, nodeId, figmaAccess),
        downloadCapture(fileKey, nodeId, figmaAccess),
      ])
      const { screenNode } = figmaScreen
      const collected = collectCandidates(
        screenNode,
        figmaScreen.componentsById,
        figmaScreen.componentSetsById,
      )
      const screen = {
        number: screenIndex + 1,
        nodeId,
        name: screenNode.name,
        width: Math.round(screenNode.absoluteBoundingBox?.width ?? 0),
        height: Math.round(screenNode.absoluteBoundingBox?.height ?? 0),
        capture: locateCapture(screenNode, captureSize),
        backdrop: collected.backdrop,
        texts: collected.texts,
      }
      return { figmaScreen, screen, candidates: collected.candidates }
    }),
  )
  const screens = readings.map((reading) => reading.screen)
  const candidates = mergeScreenCandidates(
    readings.map((reading) => reading.candidates),
  )
  // Every screen's answer carries the file's version; the last one is kept.
  const figmaFile = readings[readings.length - 1].figmaScreen

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
  /** @type {string[]} */
  let namesOfLostDeveloperDecisions = []
  if (!isVerdictsFileKept) {
    /** @type {import("./lib/verdicts.mjs").VerdictEntry[]} */
    const previousEntries = hasVerdictsFile
      ? JSON.parse(fs.readFileSync(verdictsFile, "utf8")).verdicts
      : []
    const skeleton = buildVerdictsSkeleton({
      candidates,
      figmaVersion: figmaFile.version,
      lookUpInFigmaToCodeMap,
      previousEntries,
    })
    fs.writeFileSync(verdictsFile, JSON.stringify(skeleton, null, 2))
    namesOfLostDeveloperDecisions = previousEntries
      .filter((entry) => entry.decidedBy === "developer")
      .map((entry) => entry.figmaName)
      .filter(
        (figmaName) =>
          !candidates.some((candidate) => candidate.figmaName === figmaName),
      )
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
  if (namesOfLostDeveloperDecisions.length)
    console.log(
      `Developer decisions dropped, their Figma name is no longer on the screens: ${namesOfLostDeveloperDecisions.join(", ")}`,
    )
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(EXIT_CODE_FAILED)
}
