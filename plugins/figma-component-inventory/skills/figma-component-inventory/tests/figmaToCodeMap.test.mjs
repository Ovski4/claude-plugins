// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import { buildLookUpInFigmaToCodeMap } from "../scripts/lib/figmaToCodeMap.mjs"

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
