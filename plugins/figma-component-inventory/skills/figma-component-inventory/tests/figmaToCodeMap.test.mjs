// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  addApprovedComponentsToMap,
  buildLookUpInFigmaToCodeMap,
} from "../scripts/lib/figmaToCodeMap.mjs"

const MAP_TEXT = `# Figma to React

## Components

| Figma | Code | Props |
| ----- | ---- | ----- |
| Button · 251:958 · Design Tokens | \`services/frontend/src/components/ui/button.tsx\` · \`Button\` | Style → props |
| Button · 9:41 · UI | \`services/frontend/src/components/ui/button.tsx\` · \`Button\` | — |
| Divider · 8:56 · UI | \`services/frontend/src/components/ui/separator.tsx\` | — |
| Form field · 271:568 · Design Tokens | \`services/frontend/src/components/ui/input.tsx\` · \`Input\` (with « Input — field », Icon None); \`services/frontend/src/components/ui/select.tsx\` · \`Select\` (with « Input — field », Icon Caret) | — |
| Input — field · 251:1004 · Design Tokens | \`services/frontend/src/components/ui/input.tsx\` · \`Input\` | — |

## Tokens

| Figma | Code |
| ----- | ---- |
| Tag · 1:2 · UI | \`services/frontend/src/tokens.css\` |
`

test("a name is pre-filled only when its lines agree on one file and no other line mentions it", () => {
  const lookUp = buildLookUpInFigmaToCodeMap(MAP_TEXT)

  assert.deepEqual(lookUp("Button"), {
    mapLines: [
      "Button · 251:958 · Design Tokens → `services/frontend/src/components/ui/button.tsx` · `Button`",
      "Button · 9:41 · UI → `services/frontend/src/components/ui/button.tsx` · `Button`",
    ],
    mapNotes: ["Style → props"],
    codeComponent: "Button",
    codePath: "services/frontend/src/components/ui/button.tsx",
  })
  // The component's name is the file's name when the line does not write it.
  assert.equal(lookUp("Divider").codeComponent, "separator")
  // "Form field" says an "Input — field" with a caret is a Select: the model has to choose.
  const inputField = lookUp("Input — field")
  assert.equal(inputField.codeComponent, null)
  assert.equal(inputField.codePath, null)
  assert.equal(inputField.mapLines.length, 2)
  // Only the "Components" table is read; an unknown name gets nothing.
  assert.deepEqual(lookUp("Tag"), {
    mapLines: [],
    mapNotes: [],
    codeComponent: null,
    codePath: null,
  })
  assert.deepEqual(buildLookUpInFigmaToCodeMap("")("Button"), {
    mapLines: [],
    mapNotes: [],
    codeComponent: null,
    codePath: null,
  })
})

test("at approval, the map gets the Figma components that existing code draws and that it does not name", () => {
  /**
   * @param {string} figmaName
   * @param {"instance" | "frame"} kind
   * @param {import("../scripts/lib/verdicts.mjs").VerdictKey} verdict
   * @param {string | null} codePath
   * @returns {import("../scripts/lib/verdicts.mjs").JudgedCandidate}
   */
  const buildJudged = (figmaName, kind, verdict, codePath) => ({
    number: 1,
    kind,
    mustBeJudged: true,
    figmaName,
    icons: [],
    contentsThatDiffer: [],
    outlined: true,
    verdict,
    instances: [
      {
        letter: "a",
        nodeId: "1:1",
        variant: "",
        level: 1,
        box: { x: 0, y: 0, width: 10, height: 10 },
        parent: null,
        screen: 1,
        verdict,
        codeComponent: codePath ? "MonthDayPicker" : "FlowEditor",
        codePath,
        note: null,
        developerDecision: null,
      },
    ],
  })

  const { mapText, addedFigmaNames } = addApprovedComponentsToMap(
    MAP_TEXT,
    [
      buildJudged(
        "Field — date",
        "instance",
        "to-adapt",
        "src/ui/monthDayPicker.tsx",
      ),
      buildJudged("Button", "instance", "reused", "src/ui/other.tsx"),
      buildJudged("Editor", "instance", "to-create", null),
      buildJudged("Group", "frame", "reused", "src/ui/monthDayPicker.tsx"),
    ],
    "2026-11-23",
  )

  // "Button" is already in the map, which wins; frames and components to create are left out.
  assert.deepEqual(addedFigmaNames, ["Field — date"])
  assert.equal(
    buildLookUpInFigmaToCodeMap(mapText)("Field — date").codePath,
    "src/ui/monthDayPicker.tsx",
  )
  assert.ok(
    mapText.includes(
      "| Field — date | `src/ui/monthDayPicker.tsx` · `MonthDayPicker` | approved by the developer, 2026-11-23 (figma-component-inventory) |\n\n## Tokens",
    ),
  )
})
