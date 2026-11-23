// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import { buildCutSummary } from "../scripts/lib/cutSummary.mjs"
import {
  applyVerdictsToCandidates,
  buildApproval,
  buildVerdictsSkeleton,
  isApprovalStillValid,
  listNumbersStillToDecide,
  listVerdictProblems,
} from "../scripts/lib/verdicts.mjs"

/** @typedef {import("../scripts/lib/collectCandidates.mjs").Candidate} Candidate */
/** @typedef {import("../scripts/lib/verdicts.mjs").VerdictEntry} VerdictEntry */

const BUTTON_PATH = "services/frontend/src/components/ui/button.tsx"
const FIGMA_VERSION = "2423993102449653660"

/**
 * @param {number} number
 * @param {string} figmaName
 * @param {string[]} letters
 * @param {Partial<Candidate>} [more]
 * @returns {Candidate}
 */
const buildCandidate = (number, figmaName, letters, more = {}) => ({
  number,
  kind: "instance",
  mustBeJudged: true,
  figmaName,
  instances: letters.map((letter) => ({
    letter,
    nodeId: `87:${number}${letter}`,
    variant: "",
    level: 1,
    box: { x: 0, y: 0, width: 10, height: 10 },
    parent: null,
  })),
  icons: [],
  ...more,
})
const candidates = [
  buildCandidate(1, "Button — icon", ["a", "b", "c"]),
  buildCandidate(2, "Tag — status", ["a"]),
  buildCandidate(3, "Point", ["a"]),
  buildCandidate(4, "Body", ["a"], { kind: "frame", mustBeJudged: false }),
]
/** @type {VerdictEntry[]} */
const validEntries = [
  {
    number: 1,
    figmaName: "Button — icon",
    codeComponent: "Button",
    codePath: BUTTON_PATH,
    verdict: "reused",
    except: [
      {
        instances: ["a", "b"],
        verdict: "out-of-scope",
        note: "Traités à part.",
      },
    ],
  },
  {
    number: 2,
    figmaName: "Tag — status",
    codeComponent: "StatusTag",
    verdict: "to-create",
    note: "Aucun composant ne dessine cette pastille.",
  },
  {
    number: 3,
    figmaName: "Point",
    outlined: false,
    note: "Dessiné par StatusTag.",
  },
]
/** @param {VerdictEntry[]} entries */
const listProblemsOf = (entries, figmaVersion = FIGMA_VERSION) =>
  listVerdictProblems({
    candidates,
    figmaVersionOfCandidates: FIGMA_VERSION,
    verdictsFile: { figmaVersion, verdicts: entries },
    doesCodePathExist: (codePath) => codePath === BUTTON_PATH,
  })

test("valid verdicts have no problem; every broken rule is listed", () => {
  assert.deepEqual(listProblemsOf(validEntries), [])

  /** @type {any[]} */
  const brokenEntries = [
    {
      number: 1,
      figmaName: "Button — icon",
      codeComponent: "Button",
      codePath: "services/frontend/src/missing.tsx",
      verdict: "to-adapt",
      note: `Point à vérifier. ${"x".repeat(320)}`,
      except: [
        {
          instances: ["d"],
          verdict: "to-decide",
          note: "Le code ne le dit pas.",
          question: "Un composant ?",
          options: ["Oui"],
        },
      ],
    },
    { number: 2, figmaName: "Tag", verdict: "maybe" },
    { number: 2, figmaName: "Tag — status", verdict: "to-create" },
    { number: 9, figmaName: "Ghost", verdict: "reused" },
  ]
  assert.deepEqual(listProblemsOf(brokenEntries, "older-version"), [
    "verdicts.json was filled for Figma version older-version, candidates.json is at 2423993102449653660",
    "2 Tag — status: 2 entries in verdicts.json",
    "3 Point: no entry in verdicts.json",
    '1 Button — icon: codePath "services/frontend/src/missing.tsx" does not exist in the repo',
    '1 Button — icon: "note" is 338 characters, the limit is 330 (2 or 3 lines)',
    '1 Button — icon: "note" leaves a point to verify; check it in the code, or use "to-decide"',
    "1 Button — icon, except d: the candidate's instances are a b c",
    '1 Button — icon, except d: "options" needs 2 to 4 choices',
    '2 Tag: candidate 2 is "Tag — status"',
    '2 Tag: verdict "maybe" is not one of reused, to-adapt, to-create, out-of-scope, to-decide',
    '2 Tag — status: verdict "to-create" needs "codeComponent"',
    '2 Tag — status: verdict "to-create" needs "note"',
    "9 Ghost: no candidate has this number",
  ])
})

test("each instance takes its exception's verdict; a developer's decision and a to-decide are told apart", () => {
  /** @type {VerdictEntry[]} */
  const entries = [
    validEntries[0],
    {
      ...validEntries[1],
      decidedBy: "developer",
      developerDecision: "Le composant s'appelle StatusTag.",
    },
    validEntries[2],
    {
      number: 4,
      figmaName: "Body",
      verdict: "to-decide",
      note: "Le code ne le dit pas.",
      question: "Un composant ?",
      options: ["Oui", "Non"],
    },
  ]
  const judgedCandidates = applyVerdictsToCandidates(candidates, entries)

  assert.deepEqual(
    judgedCandidates.map((candidate) => [
      candidate.number,
      candidate.outlined,
      candidate.instances
        .map((instance) => `${instance.letter}:${instance.verdict}`)
        .join(" "),
      candidate.instances[0].developerDecision,
    ]),
    [
      [1, true, "a:out-of-scope b:out-of-scope c:reused", null],
      [2, true, "a:to-create", "Le composant s'appelle StatusTag."],
      [3, false, "a:undefined", null],
      [4, true, "a:to-decide", null],
    ],
  )
  assert.deepEqual(listNumbersStillToDecide(judgedCandidates), [4])
})

test("the file given to the model has one empty entry per candidate to judge and keeps the developer's entries", () => {
  const skeleton = buildVerdictsSkeleton({
    candidates,
    figmaVersion: FIGMA_VERSION,
    lookUpInFigmaToCodeMap: (figmaName) =>
      figmaName === "Button — icon"
        ? {
            mapLines: [],
            mapNotes: [],
            codeComponent: "Button",
            codePath: BUTTON_PATH,
          }
        : { mapLines: [], mapNotes: [], codeComponent: null, codePath: null },
    // The developer's entry was written when "Tag — status" was candidate 7.
    previousEntries: [
      {
        number: 7,
        figmaName: "Tag — status",
        codeComponent: "StatusTag",
        verdict: "to-create",
        note: "Rien d'existant.",
        decidedBy: "developer",
      },
      {
        number: 1,
        figmaName: "Button — icon",
        codeComponent: "IconButton",
        verdict: "to-create",
        note: "Avis du modèle.",
      },
    ],
  })

  assert.deepEqual(skeleton, {
    figmaVersion: FIGMA_VERSION,
    verdicts: [
      {
        number: 1,
        figmaName: "Button — icon",
        codeComponent: "Button",
        codePath: BUTTON_PATH,
        verdict: null,
      },
      {
        number: 2,
        figmaName: "Tag — status",
        codeComponent: "StatusTag",
        verdict: "to-create",
        note: "Rien d'existant.",
        decidedBy: "developer",
      },
      {
        number: 3,
        figmaName: "Point",
        codeComponent: null,
        codePath: null,
        verdict: null,
      },
    ],
  })
})

test("an approval holds until a verdict changes, and cut.md lists the approved components", () => {
  const approval = buildApproval(validEntries, new Date("2026-11-23T10:00:00Z"))
  assert.equal(approval.date, "2026-11-23")
  assert.equal(
    isApprovalStillValid({
      figmaVersion: FIGMA_VERSION,
      verdicts: validEntries,
      approval,
    }),
    true,
  )
  const changedEntries = [
    { ...validEntries[0], codeComponent: "IconButton" },
    ...validEntries.slice(1),
  ]
  assert.equal(
    isApprovalStillValid({
      figmaVersion: FIGMA_VERSION,
      verdicts: changedEntries,
      approval,
    }),
    false,
  )
  assert.equal(
    isApprovalStillValid({
      figmaVersion: FIGMA_VERSION,
      verdicts: validEntries,
    }),
    false,
  )

  const summary = buildCutSummary({
    screenName: "Editor — order",
    fingerprint: {
      createdAt: "2026-11-23",
      figma: {
        fileKey: "AbCdEfGhIjKlMnOpQrStUv",
        nodeId: "87:91461",
        version: FIGMA_VERSION,
        lastModified: "2026-11-20T10:18:35Z",
      },
      gitCommit: "34ee98aa6",
    },
    approvalDate: approval.date,
    judgedCandidates: applyVerdictsToCandidates(candidates, validEntries),
  })
  assert.equal(
    summary,
    `# Découpage en composants — Editor — order

Validé par le développeur le 2026-11-23. Maquette : [Figma](https://www.figma.com/design/AbCdEfGhIjKlMnOpQrStUv/?node-id=87-91461), modifiée le 2026-11-20 (version 2423993102449653660). Code : commit 34ee98aa6.
Les décisions marquées « développeur » font foi : ne pas les rejuger.

## Réutilisé

- **1c Button** — \`services/frontend/src/components/ui/button.tsx\` — Figma « Button — icon » ×1 ([nœud](https://www.figma.com/design/AbCdEfGhIjKlMnOpQrStUv/?node-id=87-1c))

## À créer

- **2 StatusTag** — Figma « Tag — status » ×1 ([nœud](https://www.figma.com/design/AbCdEfGhIjKlMnOpQrStUv/?node-id=87-2a))
  - Aucun composant ne dessine cette pastille.

## Hors périmètre

- **1a 1b Button** — \`services/frontend/src/components/ui/button.tsx\` — Figma « Button — icon » ×2 ([nœud](https://www.figma.com/design/AbCdEfGhIjKlMnOpQrStUv/?node-id=87-1a))
  - Traités à part.

## Pas un composant à part

- 3 Point — Dessiné par StatusTag.
`,
  )
})
