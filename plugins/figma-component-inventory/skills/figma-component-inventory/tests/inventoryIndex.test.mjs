// @ts-check
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { buildApproval, SPECS_HASH_KEY } from "../scripts/lib/approval.mjs"
import {
  buildInventoryIndex,
  writeInventoryIndex,
} from "../scripts/lib/inventoryIndex.mjs"
import { VERDICTS_HASH_KEY } from "../scripts/lib/verdicts.mjs"

test("the index has one line per inventory, with where it and its specs stand", () => {
  const screens = [
    { number: 1, figmaUrl: "https://figma.example/?node-id=87-1" },
    { number: 2, figmaUrl: "https://figma.example/?node-id=87-2" },
  ]
  const index = buildInventoryIndex([
    {
      folder: "planning-week",
      title: "Planning — week",
      screens: [screens[0]],
      builtOn: "2026-11-25",
      gitCommit: "7e0db2c23",
      inventoryApprovedOn: null,
      hasSpecs: false,
      specsApprovedOn: null,
    },
    {
      folder: "editor-modes-6",
      title: "Editor — regulation (2 écrans)",
      screens,
      builtOn: "2026-11-23",
      gitCommit: "34ee98aa6",
      inventoryApprovedOn: "2026-11-23",
      hasSpecs: true,
      specsApprovedOn: null,
    },
  ])

  assert.deepEqual(index.split("\n").slice(6), [
    "| Dossier | Ce qu'il couvre | Écrans Figma | Inventaire | Specs | Construit le · commit |",
    "| --- | --- | --- | --- | --- | --- |",
    "| `editor-modes-6/` | Editor — regulation (2 écrans) | [1](https://figma.example/?node-id=87-1) [2](https://figma.example/?node-id=87-2) | Validé le 2026-11-23 | Brouillon | 2026-11-23 · 34ee98aa6 |",
    "| `planning-week/` | Planning — week | [1](https://figma.example/?node-id=87-1) | Brouillon | — | 2026-11-25 · 7e0db2c23 |",
    "",
  ])
})

test("the index is written beside the inventories' folders, from what each folder holds", () => {
  const foldersRoot = fs.mkdtempSync(path.join(os.tmpdir(), "inventories-"))
  /** @param {string} folder @param {string} fileName @param {unknown} content */
  const writeJson = (folder, fileName, content) => {
    fs.mkdirSync(path.join(foldersRoot, folder), { recursive: true })
    fs.writeFileSync(
      path.join(foldersRoot, folder, fileName),
      JSON.stringify(content),
    )
  }
  const candidatesFile = {
    fingerprint: {
      createdAt: "2026-11-23",
      figma: { fileKey: "abc", version: "1", lastModified: "2026-11-20" },
      gitCommit: "34ee98aa6",
    },
    screens: [{ number: 1, name: "Checkout", nodeId: "87:1" }],
  }
  const verdicts = [{ number: 1, verdict: "reused" }]
  const components = [{ codeComponent: "Select", props: [], zones: [] }]
  const approvedOn = new Date("2026-11-24T10:00:00Z")

  writeJson("checkout", "candidates.json", candidatesFile)
  writeJson("checkout", "verdicts.json", {
    verdicts,
    approval: buildApproval(VERDICTS_HASH_KEY, verdicts, approvedOn),
  })
  writeJson("checkout", "specs.json", {
    components,
    approval: buildApproval(SPECS_HASH_KEY, components, approvedOn),
  })
  // Approved, then a verdict changed: a draft again.
  writeJson("checkout-changed", "candidates.json", candidatesFile)
  writeJson("checkout-changed", "verdicts.json", {
    verdicts: [{ number: 1, verdict: "to-adapt" }],
    approval: buildApproval(VERDICTS_HASH_KEY, verdicts, approvedOn),
  })
  // Not an inventory: left out.
  writeJson("archive", "notes.json", {})

  const indexFile = writeInventoryIndex(path.join(foldersRoot, "checkout"))

  assert.equal(indexFile, path.join(foldersRoot, "index.md"))
  const rows = fs
    .readFileSync(indexFile, "utf8")
    .split("\n")
    .filter((line) => line.startsWith("| `"))
    .map((row) => row.split(" | ").slice(3, 5).join(" / "))
  assert.deepEqual(rows, [
    "Validé le 2026-11-24 / Validé le 2026-11-24",
    "Brouillon / —",
  ])
})
