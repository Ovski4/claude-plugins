// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import { buildBrief } from "../scripts/lib/brief.mjs"

const BUTTON_PATH = "services/frontend/src/components/ui/button.tsx"
const BUTTON_SOURCE = `import { ReactNode } from "react"

interface ButtonProps extends HTMLProps<HTMLButtonElement> {
  /** Icon-only button. */
  btn_icon?: "true"
  children?: ReactNode
}
type Size = "small" | "large"

export function Button(props: ButtonProps) {
  return <button {...props} />
}
`

/**
 * @param {number} number
 * @param {string} figmaName
 * @param {Partial<import("../scripts/lib/mergeScreens.mjs").MergedCandidate>} [more]
 * @returns {import("../scripts/lib/mergeScreens.mjs").MergedCandidate}
 */
const buildCandidate = (number, figmaName, more = {}) => ({
  number,
  kind: "instance",
  mustBeJudged: true,
  figmaName,
  instances: [
    {
      letter: "a",
      nodeId: `87:${number}`,
      variant: number === 1 ? "Style=Ghost" : "",
      level: 2,
      box: { x: 0, y: 0, width: 10, height: 10 },
      parent: number === 1 ? null : 1,
      screen: 1,
    },
  ],
  icons: number === 1 ? ["ic/x/16"] : [],
  contentsThatDiffer: [],
  ...more,
})

test("the brief gives each candidate what the repo already says about it", () => {
  const brief = buildBrief({
    screens: [
      {
        number: 1,
        name: "Editor — order",
        width: 480,
        height: 420,
        backdrop: "Scrim — modal",
        capture: { file: "screen-87-1.png" },
      },
    ],
    candidates: [
      buildCandidate(1, "Button — icon"),
      buildCandidate(2, "Button"),
      buildCandidate(3, "Tile — status"),
      buildCandidate(4, "Body", { kind: "frame", mustBeJudged: false }),
    ],
    lookUpInFigmaToCodeMap: (figmaName) =>
      figmaName.startsWith("Button")
        ? {
            mapLines: [],
            mapNotes: ["Icon → `children`"],
            codeComponent: "Button",
            codePath: BUTTON_PATH,
          }
        : { mapLines: [], mapNotes: [], codeComponent: null, codePath: null },
    hasFigmaToCodeMap: true,
    designSystemFolder: "services/frontend/src/components/ui",
    componentFiles: [
      "services/frontend/src/components/admin/DashboardTileGrid.tsx",
      "services/frontend/src/components/ui/molecules/kpiTile/KpiTile.tsx",
      "services/frontend/src/components/ui/button.tsx",
    ],
    readCodeFile: (codePath) => (codePath === BUTTON_PATH ? BUTTON_SOURCE : ""),
  })

  assert.equal(
    brief,
    `# Editor — order

Design system: the components of \`services/frontend/src/components/ui\` win over a feature's own.

Backdrop "Scrim — modal": only the dialog in front of it is cut, never the page behind.

## Candidates to judge: one entry each in verdicts.json

### 1 — Button — icon ×1 (component, level 2)
- Variants: Style=Ghost
- Size in the mock-up: 10 × 10 px
- Icons inside: ic/x/16
- Figma-to-code map: \`Button\` in \`services/frontend/src/components/ui/button.tsx\` (pre-filled in verdicts.json)
  - Figma → props: Icon → \`children\`
- Props declared in that file:
\`\`\`ts
interface ButtonProps extends HTMLProps<HTMLButtonElement> {
  /** Icon-only button. */
  btn_icon?: "true"
  children?: ReactNode
}
\`\`\`

### 2 — Button ×1 (component, level 2, inside 1)
- Size in the mock-up: 10 × 10 px
- Figma-to-code map: \`Button\` in \`services/frontend/src/components/ui/button.tsx\` (pre-filled in verdicts.json)
  - Figma → props: Icon → \`children\`
- Props declared in that file: see candidate 1

### 3 — Tile — status ×1 (component, level 2, inside 1)
- Size in the mock-up: 10 × 10 px
- Figma-to-code map: no line
- Component files with a close name: services/frontend/src/components/ui/molecules/kpiTile/KpiTile.tsx, services/frontend/src/components/admin/DashboardTileGrid.tsx

## Plain frames: an entry only if one is a React component of its own

4 Body ×1
`,
  )
})
