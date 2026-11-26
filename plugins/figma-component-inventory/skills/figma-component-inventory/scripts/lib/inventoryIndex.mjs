// @ts-check
// index.md, beside the folders of the inventories: one line per inventory, with what it
// covers and where it stands, its specs included. Both skills' render.mjs write it again
// each time they run, so that a session finds an inventory without opening every folder.
import { WRITTEN_FILES_LANGUAGE } from "./languages.mjs"
import fs from "node:fs"
import path from "node:path"
import {
  readStandingApprovalDate,
  SPECS_FILE_NAME,
  SPECS_HASH_KEY,
} from "./approval.mjs"
import { buildFigmaNodeUrl } from "./figma.mjs"
import { titleInventory } from "./inventoryWording.mjs"
import { VERDICTS_HASH_KEY } from "./verdicts.mjs"

const INDEX_FILE_NAME = "index.md"

/**
 * One inventory as the index shows it.
 * @typedef {object} IndexedInventory
 * @property {string} folder the name of its folder, beside index.md: "editor-modes-6"
 * @property {string} title what its screens' names share: "Editor — regulation (6 écrans)"
 * @property {{ number: number, figmaUrl: string }[]} screens
 * @property {string} builtOn the day candidates.json was written: "2026-11-23"
 * @property {string} gitCommit the commit the code was read at
 * @property {string | null} inventoryApprovedOn null for a draft, or when a verdict changed since the approval
 * @property {boolean} hasSpecs false while the folder holds no specs.json
 * @property {string | null} specsApprovedOn null without specs, for a draft, or when the specs changed since the approval
 */

/**
 * @param {string} folder
 * @param {string} fileName
 */
const readJson = (folder, fileName) =>
  JSON.parse(fs.readFileSync(path.join(folder, fileName), "utf8"))

/**
 * @param {string} inventoryFolder
 * @returns {IndexedInventory | null} null for a folder that holds no inventory
 */
function readIndexedInventory(inventoryFolder) {
  try {
    const { fingerprint, screens } = readJson(
      inventoryFolder,
      "candidates.json",
    )
    const verdictsFile = readJson(inventoryFolder, "verdicts.json")
    const hasSpecs = fs.existsSync(path.join(inventoryFolder, SPECS_FILE_NAME))
    const specsFile = hasSpecs
      ? readJson(inventoryFolder, SPECS_FILE_NAME)
      : null
    return {
      folder: path.basename(inventoryFolder),
      title: titleInventory(screens, WRITTEN_FILES_LANGUAGE),
      screens: screens.map(
        /** @param {{ number: number, nodeId: string }} screen */
        ({ number, nodeId }) => ({
          number,
          figmaUrl: buildFigmaNodeUrl(fingerprint.figma.fileKey, nodeId),
        }),
      ),
      builtOn: fingerprint.createdAt,
      gitCommit: fingerprint.gitCommit,
      inventoryApprovedOn: readStandingApprovalDate(
        VERDICTS_HASH_KEY,
        verdictsFile.approval,
        verdictsFile.verdicts,
      ),
      hasSpecs,
      specsApprovedOn:
        specsFile &&
        readStandingApprovalDate(
          SPECS_HASH_KEY,
          specsFile.approval,
          specsFile.components,
        ),
    }
  } catch {
    // No candidates.json or verdicts.json, or a file cut short: not an inventory to list.
    return null
  }
}

/**
 * @param {IndexedInventory[]} inventories
 * @returns {string} the content of index.md, in French
 */
export function buildInventoryIndex(inventories) {
  /** @param {string | null} approvedOn */
  const tellApproval = (approvedOn) =>
    approvedOn ? `Validé le ${approvedOn}` : "Brouillon"
  const rows = inventories
    .toSorted((a, b) => a.folder.localeCompare(b.folder))
    .map((inventory) => {
      const screenLinks = inventory.screens
        .map(({ number, figmaUrl }) => `[${number}](${figmaUrl})`)
        .join(" ")
      return `| ${[
        `\`${inventory.folder}/\``,
        inventory.title,
        screenLinks,
        tellApproval(inventory.inventoryApprovedOn),
        inventory.hasSpecs ? tellApproval(inventory.specsApprovedOn) : "—",
        `${inventory.builtOn} · ${inventory.gitCommit}`,
      ].join(" | ")} |`
    })
  return [
    "# Inventaires de composants",
    "",
    "Écrit par `render.mjs` à chaque passage : ne pas modifier à la main. Un dossier par",
    "inventaire ; ses specs sont dans le même dossier. Seul un inventaire validé se lit",
    "(`inventory.md`), et seules des specs validées (`specs.md`).",
    "",
    "| Dossier | Ce qu'il couvre | Écrans Figma | Inventaire | Specs | Construit le · commit |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n")
}

/**
 * Writes index.md again, beside the folder of the inventory just drawn, from every
 * inventory found there.
 * @param {string} inventoryFolder
 * @returns {string} the path of index.md
 */
export function writeInventoryIndex(inventoryFolder) {
  const foldersRoot = path.dirname(path.resolve(inventoryFolder))
  const inventories = fs
    .readdirSync(foldersRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap(
      (entry) => readIndexedInventory(path.join(foldersRoot, entry.name)) ?? [],
    )
  const indexFile = path.join(foldersRoot, INDEX_FILE_NAME)
  fs.writeFileSync(indexFile, buildInventoryIndex(inventories))
  return indexFile
}
