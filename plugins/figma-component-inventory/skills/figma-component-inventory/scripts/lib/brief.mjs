// @ts-check
// Writes the brief the model reads before judging: for each candidate, what the scripts can
// already find in the repo, so that the model opens a file only to settle a verdict.
import { listScreenNumbers } from "./mergeScreens.mjs"

/** @typedef {import("./mergeScreens.mjs").MergedCandidate} Candidate */
/**
 * What the brief says of one screen.
 * @typedef {object} BriefScreen
 * @property {number} number from 1, in the order the screens are shown
 * @property {string} name
 * @property {number} width
 * @property {number} height
 * @property {string | null} backdrop the name of the veil drawn behind a dialog, when the screen has one
 * @property {{ file: string }} capture the screen's image in the output folder
 */
/** @typedef {import("./figmaToCodeMap.mjs").LookUpInFigmaToCodeMap} LookUpInFigmaToCodeMap */

// Shorter words of a Figma name ("row", "day", "tag") match too many files to help.
const MIN_SEARCHED_WORD_LENGTH = 4
const MAX_FILES_WITH_A_CLOSE_NAME = 6
const MAX_SIZES_SHOWN = 3
// A longer props declaration is cut: the model opens the file if it needs the rest.
const MAX_PROPS_DECLARATION_LINES = 40
const FIRST_LINE_OF_A_PROPS_DECLARATION =
  /^(?:export )?(?:interface|type) \w*Props\b/
// The declaration ends at the first line that closes it at the left margin: "}", "}>" or ">".
const LAST_LINE_OF_A_DECLARATION = /^[}>]/

/**
 * The props a component file declares: every top-level `interface …Props` or `type …Props`.
 * @param {string} sourceText the content of a .tsx file
 * @returns {string} the declarations as written in the file; "" when it declares none
 */
function extractPropsDeclarations(sourceText) {
  const lines = sourceText.split("\n")
  const declarations = []
  for (let index = 0; index < lines.length; index++) {
    if (!FIRST_LINE_OF_A_PROPS_DECLARATION.test(lines[index])) continue
    const isOnOneLine = !/[{<(]\s*$/.test(lines[index])
    const lengthToClosingLine =
      lines
        .slice(index + 1)
        .findIndex((line) => LAST_LINE_OF_A_DECLARATION.test(line)) + 2
    const length = isOnOneLine ? 1 : lengthToClosingLine
    const declaration = lines.slice(
      index,
      index + Math.min(length, MAX_PROPS_DECLARATION_LINES),
    )
    if (length > MAX_PROPS_DECLARATION_LINES)
      declaration.push("  // … cut here: open the file for the rest")
    declarations.push(declaration.join("\n"))
    index += declaration.length - 1
  }
  return declarations.join("\n")
}

/**
 * The component files whose name holds a word of the Figma name: "Tile — status" finds
 * StatusTile.tsx and ProductTileHeader.tsx. The design system's files come first, then the
 * files sharing the most words.
 * @param {string} figmaName
 * @param {string[]} componentFiles paths from the repo's root
 * @param {string | null} designSystemFolder from the repo's root; null when the repo has none
 * @returns {string[]} at most 6 paths
 */
function findFilesWithACloseName(
  figmaName,
  componentFiles,
  designSystemFolder,
) {
  /** @param {string} file */
  const isInDesignSystem = (file) =>
    designSystemFolder !== null && file.startsWith(`${designSystemFolder}/`)
  const searchedWords = figmaName
    .toLowerCase()
    .split(/[^a-zà-ÿ]+/)
    .filter((word) => word.length >= MIN_SEARCHED_WORD_LENGTH)
  return componentFiles
    .map((file) => {
      const fileName = (file.split("/").at(-1) ?? "").toLowerCase()
      return {
        file,
        sharedWordCount: searchedWords.filter((word) => fileName.includes(word))
          .length,
      }
    })
    .filter(({ sharedWordCount }) => sharedWordCount > 0)
    .toSorted(
      (a, b) =>
        Number(isInDesignSystem(b.file)) - Number(isInDesignSystem(a.file)) ||
        b.sharedWordCount - a.sharedWordCount ||
        a.file.localeCompare(b.file),
    )
    .slice(0, MAX_FILES_WITH_A_CLOSE_NAME)
    .map(({ file }) => file)
}

/**
 * @param {Candidate} candidate
 * @returns {string} "### 6 — Segment ×4 (component, level 3, inside 5)"
 */
function titleCandidate(candidate) {
  const levels = [
    ...new Set(candidate.instances.map((instance) => instance.level)),
  ].join(" and ")
  const parents = [
    ...new Set(
      candidate.instances.map((instance) => instance.parent).filter(Boolean),
    ),
  ]
  const kindOfFrame = candidate.contentsThatDiffer.length
    ? "frame whose content differs between screens"
    : "frame used several times"
  const kind = candidate.kind === "instance" ? "component" : kindOfFrame
  const where = parents.length ? `, inside ${parents.join(" and ")}` : ""
  return `### ${candidate.number} — ${candidate.figmaName} ×${candidate.instances.length} (${kind}, level ${levels}${where})`
}

/**
 * The sizes the candidate's uses have in the mock-up, to compare with the component's style.
 * @param {Candidate} candidate
 * @returns {string} "106 × 28 px", or the first sizes when the uses differ
 */
function describeSizes(candidate) {
  const sizes = [
    ...new Set(
      candidate.instances.map(({ box }) => `${box.width} × ${box.height} px`),
    ),
  ]
  const shownSizes = sizes.slice(0, MAX_SIZES_SHOWN).join(", ")
  return sizes.length > MAX_SIZES_SHOWN ? `${shownSizes}, …` : shownSizes
}

/**
 * @param {object} cut
 * @param {BriefScreen[]} cut.screens one screen, or several screens of one design
 * @param {Candidate[]} cut.candidates
 * @param {LookUpInFigmaToCodeMap} cut.lookUpInFigmaToCodeMap
 * @param {boolean} cut.hasFigmaToCodeMap false when the repo has no Figma-to-code map
 * @param {string | null} cut.designSystemFolder the folder of the shared components, from
 *   the repo's root; null when the repo has none
 * @param {string[]} cut.componentFiles every component file of the repo, from its root
 * @param {(codePath: string) => string} cut.readCodeFile "" when the file cannot be read
 * @returns {string} the content of brief.md
 */
export function buildBrief({
  screens,
  candidates,
  lookUpInFigmaToCodeMap,
  hasFigmaToCodeMap,
  designSystemFolder,
  componentFiles,
  readCodeFile,
}) {
  const hasSeveralScreens = screens.length > 1
  const backdrop = screens.find((screen) => screen.backdrop)?.backdrop
  /** @param {number[]} screenNumbers */
  const nameScreens = (screenNumbers) =>
    screenNumbers.length === screens.length
      ? "every screen"
      : `screen${screenNumbers.length > 1 ? "s" : ""} ${screenNumbers.join(" ")}`
  const lines = hasSeveralScreens
    ? [
        `# ${screens.length} screens of one design`,
        "",
        ...screens.map(
          ({ number, name, width, height, capture }) =>
            `${number}. ${name} — ${width} × ${height} px — \`${capture.file}\``,
        ),
        "",
        "A candidate has one number on every screen: one entry in verdicts.json covers them all.",
      ]
    : [`# ${screens[0].name}`]
  lines.push(
    "",
    designSystemFolder
      ? `Design system: the components of \`${designSystemFolder}\` win over a feature's own.`
      : "This repo declares no design-system folder: no component wins over another.",
    "",
  )
  if (!hasFigmaToCodeMap)
    lines.push(
      "This repo has no Figma-to-code map: every name comes from the code.",
      "",
    )
  if (backdrop)
    lines.push(
      `Backdrop "${backdrop}": only the dialog in front of it is cut, never the page behind.`,
      "",
    )
  lines.push("## Candidates to judge: one entry each in verdicts.json", "")
  // A file's props are written once, under the first candidate that uses it.
  /** @type {Map<string, number>} */
  const candidateNumbersByCodePath = new Map()
  for (const candidate of candidates.filter((each) => each.mustBeJudged)) {
    const screensByVariant = Map.groupBy(
      candidate.instances.filter((instance) => instance.variant),
      (instance) => instance.variant,
    )
    const variants = [...screensByVariant].map(([variant, instances]) => {
      const screenNumbers = listScreenNumbers(instances)
      return hasSeveralScreens &&
        screenNumbers.length < listScreenNumbers(candidate.instances).length
        ? `${variant} (${nameScreens(screenNumbers)})`
        : variant
    })
    const { mapLines, mapNotes, codeComponent, codePath } =
      lookUpInFigmaToCodeMap(candidate.figmaName)
    lines.push(titleCandidate(candidate))
    if (hasSeveralScreens)
      lines.push(`- On: ${nameScreens(listScreenNumbers(candidate.instances))}`)
    if (variants.length) lines.push(`- Variants: ${variants.join(" | ")}`)
    lines.push(`- Size in the mock-up: ${describeSizes(candidate)}`)
    if (candidate.icons.length)
      lines.push(`- Icons inside: ${candidate.icons.join(", ")}`)
    if (candidate.contentsThatDiffer.length) {
      lines.push(
        "- Its content differs between screens: choose one component with a prop, or several components",
        ...candidate.contentsThatDiffer.map(
          ({ screens: screenNumbers, holds }) =>
            `  - ${nameScreens(screenNumbers)}: holds ${holds.join(" + ") || "no candidate"}`,
        ),
      )
    }
    if (codePath) {
      lines.push(
        `- Figma-to-code map: \`${codeComponent}\` in \`${codePath}\` (pre-filled in verdicts.json)`,
      )
      lines.push(...mapNotes.map((note) => `  - Figma → props: ${note}`))
      const firstCandidateOfThatFile = candidateNumbersByCodePath.get(codePath)
      if (firstCandidateOfThatFile) {
        lines.push(
          `- Props declared in that file: see candidate ${firstCandidateOfThatFile}`,
        )
      } else {
        const propsDeclarations = extractPropsDeclarations(
          readCodeFile(codePath),
        )
        if (propsDeclarations) {
          candidateNumbersByCodePath.set(codePath, candidate.number)
          lines.push(
            "- Props declared in that file:",
            "```ts",
            propsDeclarations,
            "```",
          )
        }
      }
    } else {
      if (mapLines.length) {
        lines.push(
          "- Figma-to-code map, lines that do not settle the component (choose):",
        )
        lines.push(...mapLines.map((mapLine) => `  - ${mapLine}`))
        lines.push(...mapNotes.map((note) => `  - Figma → props: ${note}`))
      } else if (hasFigmaToCodeMap) {
        lines.push("- Figma-to-code map: no line")
      }
      const closeFiles = findFilesWithACloseName(
        candidate.figmaName,
        componentFiles,
        designSystemFolder,
      )
      lines.push(
        `- Component files with a close name: ${closeFiles.length ? closeFiles.join(", ") : "none"}`,
      )
    }
    lines.push("")
  }
  const optionalFrames = candidates.filter((each) => !each.mustBeJudged)
  if (optionalFrames.length) {
    const names = optionalFrames.map(
      (frame) =>
        `${frame.number} ${frame.figmaName} ×${frame.instances.length}`,
    )
    lines.push(
      "## Plain frames: an entry only if one is a React component of its own",
      "",
      names.join(" · "),
      "",
    )
  }
  return lines.join("\n")
}
