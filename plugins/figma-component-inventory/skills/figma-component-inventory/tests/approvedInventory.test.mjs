// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  InventoryNotUsable,
  listInventoryFormatProblems,
  readApprovedInventory,
} from "../scripts/lib/approvedInventory.mjs"
import { buildApproval } from "../scripts/lib/verdicts.mjs"

/** @typedef {import("../scripts/lib/verdicts.mjs").VerdictsFile} VerdictsFile */

const FIGMA_VERSION = "2423993102449653660"
const BOX = { x: 24, y: 244, width: 432, height: 92 }

const buildCandidatesFile = () => ({
  fingerprint: {
    createdAt: "2026-11-23",
    figma: {
      fileKey: "AbCdEfGhIjKlMnOpQrStUv",
      version: FIGMA_VERSION,
      lastModified: "2026-11-20T10:18:35Z",
    },
    gitCommit: "34ee98aa6",
  },
  screens: [
    {
      number: 1,
      nodeId: "87:91461",
      name: "Editor — regulation · Continuous · Default",
      width: 480,
      height: 420,
      capture: {
        file: "screen-87-91461.png",
        x: -24,
        y: -16,
        width: 528,
        height: 468,
      },
      backdrop: null,
      texts: [{ nodeId: "87:1", characters: "Consigne", box: BOX }],
    },
  ],
  candidates: [
    {
      number: 1,
      kind: "instance",
      mustBeJudged: true,
      figmaName: "Mode settings",
      componentKey: null,
      instances: [
        {
          letter: "a",
          nodeId: "87:2",
          variant: "",
          level: 1,
          box: BOX,
          parent: null,
          screen: 1,
        },
      ],
      icons: [],
      contentsThatDiffer: [],
    },
  ],
})

/** @returns {VerdictsFile} */
const buildApprovedVerdictsFile = () => {
  /** @type {VerdictsFile["verdicts"]} */
  const verdicts = [
    {
      number: 1,
      figmaName: "Mode settings",
      codeComponent: "OrderDeliverySettings",
      verdict: "to-create",
      note: "Aucun composant ne dessine ces réglages.",
    },
  ]
  return {
    figmaVersion: FIGMA_VERSION,
    verdicts,
    approval: buildApproval(verdicts, new Date("2026-11-23T10:00:00Z")),
  }
}

test("an approved inventory in the promised format gives its screens and each candidate's verdict", () => {
  const inventory = readApprovedInventory({
    candidatesFile: buildCandidatesFile(),
    verdictsFile: buildApprovedVerdictsFile(),
  })

  assert.equal(inventory.approvedOn, "2026-11-23")
  assert.equal(inventory.fingerprint.gitCommit, "34ee98aa6")
  assert.equal(inventory.screens[0].capture.file, "screen-87-91461.png")
  assert.equal(inventory.judgedCandidates[0].instances[0].verdict, "to-create")
})

test("an inventory that is not approved, or changed since its approval, is refused", () => {
  const neverApproved = buildApprovedVerdictsFile()
  delete neverApproved.approval
  assert.throws(
    () =>
      readApprovedInventory({
        candidatesFile: buildCandidatesFile(),
        verdictsFile: neverApproved,
      }),
    { name: InventoryNotUsable.name, message: /has not approved/ },
  )

  const changedSinceApproval = buildApprovedVerdictsFile()
  changedSinceApproval.verdicts[0].note = "Une autre raison."
  assert.throws(
    () =>
      readApprovedInventory({
        candidatesFile: buildCandidatesFile(),
        verdictsFile: changedSinceApproval,
      }),
    { message: /changed after the developer's approval of 2026-11-23/ },
  )
})

test("every field that is not in the promised format is named", () => {
  assert.deepEqual(listInventoryFormatProblems(buildCandidatesFile()), [])

  const candidatesFile = /** @type {any} */ (buildCandidatesFile())
  delete candidatesFile.fingerprint.gitCommit
  delete candidatesFile.screens[0].capture.file
  candidatesFile.screens[0].texts[0].box = { x: 24 }
  candidatesFile.candidates[0].instances[0].screen = 2
  assert.deepEqual(listInventoryFormatProblems(candidatesFile), [
    "fingerprint.gitCommit must be a commit",
    "screens[0].capture must be a file name with x, y, width and height",
    "screens[0].texts must be a list of texts, each with nodeId, characters and box",
    "candidate 1: instances must be a list of instances, each with letter, nodeId, variant, box and the number of a listed screen",
  ])
  assert.throws(
    () =>
      readApprovedInventory({
        candidatesFile,
        verdictsFile: buildApprovedVerdictsFile(),
      }),
    { message: /^candidates\.json is not in the inventory's format:/ },
  )
})
