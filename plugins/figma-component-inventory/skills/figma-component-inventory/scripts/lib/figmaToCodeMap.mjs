// @ts-check
// Reads the repo's Figma-to-code map: the table that says which React component draws each
// Figma component.
import fs from "node:fs"
import path from "node:path"

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
 * @param {string} mapText the content of the map file; "" when the repo has none
 * @returns {LookUpInFigmaToCodeMap}
 */
export function buildLookUpInFigmaToCodeMap(mapText) {
  const componentsSection =
    mapText
      .split(/^## /m)
      .find((section) => section.startsWith(COMPONENTS_SECTION_TITLE)) ?? ""
  const rows = componentsSection
    .split("\n")
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
