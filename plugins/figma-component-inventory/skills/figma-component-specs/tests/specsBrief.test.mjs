// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import { buildSpecsBrief } from "../scripts/lib/specsBrief.mjs"
import { buildApprovedInventory } from "./specsFixtures.mjs"

const SELECT_SOURCE = `import styles from "./select.module.css"

export interface SelectProps {
  value: string
  onValueChange: (value: string) => void
}

export function Select(props: SelectProps) {}
`

test("the brief gives, per component to specify, the inventory's words, its declared props and what it holds", () => {
  const brief = buildSpecsBrief({
    inventory: buildApprovedInventory(),
    readCodeFile: (codePath) =>
      codePath === "src/components/ui/select.tsx" ? SELECT_SOURCE : "",
    projectLanguage: "en",
  })

  assert.equal(
    brief,
    `# 2 components to specify

From the inventory approved on 2026-11-23 (Figma version 2423993102449653660, commit 34ee98aa6).

Language of this repo: English. Write in it everything the developer will read: notes, questions and their options, names of zones, his decisions.

1. Editor — regulation · Continuous · Default — \`screen-87-91461.png\`

Under a component, what a nested React component holds is not repeated: the zone names that component, and its content is listed in its own section when it is to specify.

A zone's "parts" name what is listed under a component: a candidate by its number (\`{ "candidate": 19 }\`), one use by number and letter (\`{ "instance": "11a" }\`), a text by its exact characters (\`{ "text": "Consigne" }\`).

## Select — To adapt

- Inventory candidate: 8 Input — field
- Inventory's reason: Le libellé au-dessus du champ manque.
- Decided by the developer, not to be judged again: Le libellé devient une prop du Select.
- Props declared in \`src/components/ui/select.tsx\`:
\`\`\`ts
export interface SelectProps {
  value: string
  onValueChange: (value: string) => void
}
\`\`\`

What it holds, on each screen it is drawn on:

- Screen 1, instance 8a, variant "State=Default", 200 × 40 px
  - Texts: "19,5 °C"

## OrderDeliverySettings — To create

- Inventory candidate: 17 Mode settings
- Inventory's reason: Aucun composant ne dessine ces réglages.

What it holds, on each screen it is drawn on:

- Screen 1, instance 17b, 432 × 92 px
  - 8a Input — field [State=Default] — Select, To adapt
  - 19a Group — no React component of its own
  - 20a Field row — no React component of its own
  - Texts: "Consigne"
`,
  )
})

test("the brief names the icon of a use, which tells apart two uses of one variant", () => {
  const inventory = buildApprovedInventory()
  const select = inventory.judgedCandidates.find(
    (candidate) => candidate.number === 8,
  )
  if (select) select.instances[0].icons = ["ic/caret-down/16"]

  const brief = buildSpecsBrief({
    inventory,
    readCodeFile: () => "",
    projectLanguage: "fr",
  })

  assert.match(
    brief,
    /^ {2}- 8a Input — field \[State=Default\], icon ic\/caret-down\/16 — Select, To adapt$/m,
  )
})
