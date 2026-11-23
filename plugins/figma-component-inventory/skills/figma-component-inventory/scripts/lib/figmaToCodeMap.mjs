// @ts-check
// Reads the repo's Figma-to-code map, the table that says which React component draws each
// Figma component, and adds to it what the developer approved.
import fs from "node:fs"
import path from "node:path"
import { groupByJudgement } from "./verdicts.mjs"

/**
 * What the map says about one Figma component.
 * @typedef {object} MapAnswer
 * @property {string[]} mapLines every line that names it, in its own Figma cell or inside
 *   another line's code cell ("Form field" says which component draws an "Input — field"
 *   with a caret), written "Figma cell → code cell"
 * @property {string[]} mapNotes what the lines of that Figma name say about props ("Style
 *   Primary → default; State=Disabled → `disabled`"); empty when they say nothing
 * @property {string | null} codeComponent the React component, only when the lines of that
 *   Figma name agree on one file and no other line mentions it; otherwise the model reads
 *   mapLines and decides
 * @property {string | null} codePath that component's file, from the repo's root; null with codeComponent
 */
/** @typedef {(figmaName: string) => MapAnswer} LookUpInFigmaToCodeMap */
/** @typedef {import("./verdicts.mjs").JudgedCandidate} JudgedCandidate */

const COMPONENTS_SECTION_TITLE = "Components"
// In a line's first cell, the Figma name is followed by its node id and its file: "Button · 251:958 · Design Tokens".
const FIGMA_CELL_SEPARATOR = " · "
// What the map writes in a cell that has nothing to say.
const EMPTY_CELL = "—"

/**
 * "`src/components/ui/button.tsx` · `Button` (`btn_icon`)" → Button and its file.
 * The component's name is the file's name when the cell does not write it.
 * @param {string} codeCell
 */
function readCodeCell(codeCell) {
  const quotedParts = [...codeCell.matchAll(/`([^`]+)`/g)].map(
    (match) => match[1],
  )
  const codePath = quotedParts.find((part) => part.includes("/")) ?? null
  const fileName = codePath
    ? path.basename(codePath, path.extname(codePath))
    : null
  return {
    codeComponent:
      quotedParts.find((part) => /^[A-Z]\w*$/.test(part)) ?? fileName,
    codePath,
  }
}

/**
 * The lines of the map's "Components" section; none when the map has no such section.
 * @param {string} mapText
 */
function listComponentsSectionLines(mapText) {
  const componentsSection =
    mapText
      .split(/^## /m)
      .find((section) => section.startsWith(COMPONENTS_SECTION_TITLE)) ?? ""
  return componentsSection.split("\n")
}

/**
 * @param {string} mapText the content of the map file; "" when the repo has none
 * @returns {LookUpInFigmaToCodeMap}
 */
export function buildLookUpInFigmaToCodeMap(mapText) {
  const rows = listComponentsSectionLines(mapText)
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .filter(([, figmaCell, codeCell]) => figmaCell && codeCell?.includes("`"))
    .map(([, figmaCell, codeCell, notesCell = ""]) => ({
      figmaName: figmaCell.split(FIGMA_CELL_SEPARATOR)[0],
      figmaCell,
      codeCell,
      notesCell,
    }))

  return function lookUpInFigmaToCodeMap(figmaName) {
    const ownRows = rows.filter((row) => row.figmaName === figmaName)
    const mentioningRows = rows.filter(
      (row) =>
        row.figmaName !== figmaName &&
        row.codeCell.includes(`« ${figmaName} »`),
    )
    const mapLines = [...ownRows, ...mentioningRows].map(
      (row) => `${row.figmaCell} → ${row.codeCell}`,
    )
    const ownComponents = ownRows.map((row) => readCodeCell(row.codeCell))
    const agreeOnOneFile =
      new Set(ownComponents.map((component) => component.codePath)).size === 1
    const isPreFilled =
      agreeOnOneFile &&
      ownComponents[0].codePath !== null &&
      mentioningRows.length === 0
    const mapNotes = ownRows
      .map((row) => row.notesCell)
      .filter((notes) => notes && notes !== EMPTY_CELL)
    return isPreFilled
      ? { mapLines, mapNotes, ...ownComponents[0] }
      : { mapLines, mapNotes, codeComponent: null, codePath: null }
  }
}

/**
 * @param {string} repoRoot
 * @param {string | null} figmaToCodeMap the map's path from the repo's root; null when the
 *   repo has none, and every look-up then answers that the map says nothing
 * @returns {LookUpInFigmaToCodeMap}
 */
export function readFigmaToCodeMap(repoRoot, figmaToCodeMap) {
  if (figmaToCodeMap === null) return buildLookUpInFigmaToCodeMap("")
  const mapFile = path.join(repoRoot, figmaToCodeMap)
  if (!fs.existsSync(mapFile))
    throw new Error(
      `The Figma-to-code map ${figmaToCodeMap} does not exist in ${repoRoot}`,
    )
  return buildLookUpInFigmaToCodeMap(fs.readFileSync(mapFile, "utf8"))
}

/**
 * Adds to the map's "Components" table one line per approved Figma component that existing
 * code draws (reused or to adapt, one React component for all its instances) and that the
 * map does not name yet, so that the next screen using it is pre-filled. A Figma name the
 * map already has keeps its lines: the map is maintained by hand and wins. Frames are left
 * out: their names are not stable components.
 * The line fills the table's first two columns ("Name", "`path` · `Component`"), puts the
 * approval in its last one when the table has a third, and "—" in between; its cells are
 * not padded to the others'.
 * @param {string} mapText
 * @param {JudgedCandidate[]} judgedCandidates
 * @param {string} approvalDate "2026-11-23"
 * @returns {{ mapText: string, addedFigmaNames: string[] }} the map unchanged, and no name,
 *   when it has no "Components" table
 */
export function addApprovedComponentsToMap(
  mapText,
  judgedCandidates,
  approvalDate,
) {
  const lines = mapText.split("\n")
  const sectionLines = listComponentsSectionLines(mapText)
  const tableLines = sectionLines.filter((line) => line.startsWith("|"))
  if (!tableLines.length) return { mapText, addedFigmaNames: [] }
  const columnCount = tableLines[0].split("|").length - 2
  const lookUp = buildLookUpInFigmaToCodeMap(mapText)
  const newLines = judgedCandidates.flatMap((candidate) => {
    const judgements = groupByJudgement(candidate.instances)
    if (candidate.kind !== "instance" || !candidate.outlined) return []
    if (judgements.length !== 1) return []
    const [{ verdict, codeComponent, codePath }] = judgements[0]
    if (verdict !== "reused" && verdict !== "to-adapt") return []
    if (!codePath || lookUp(candidate.figmaName).mapLines.length) return []
    const cells = [
      candidate.figmaName,
      `\`${codePath}\` · \`${codeComponent}\``,
      ...Array.from({ length: columnCount - 3 }, () => EMPTY_CELL),
      `approved by the developer, ${approvalDate} (figma-component-inventory)`,
    ].slice(0, columnCount)
    return [
      { figmaName: candidate.figmaName, line: `| ${cells.join(" | ")} |` },
    ]
  })
  if (!newLines.length) return { mapText, addedFigmaNames: [] }
  const lastTableLineIndex = lines.lastIndexOf(
    tableLines[tableLines.length - 1],
  )
  lines.splice(
    lastTableLineIndex + 1,
    0,
    ...newLines.map((newLine) => newLine.line),
  )
  return {
    mapText: lines.join("\n"),
    addedFigmaNames: newLines.map((newLine) => newLine.figmaName),
  }
}
