// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildSpecsApproval,
  listZonesStillToDecide,
  readStandingApprovalDate,
} from "../scripts/lib/specsApproval.mjs"
import { buildSpecsSummary } from "../scripts/lib/specsSummary.mjs"
import { buildApprovedInventory, buildSpecsFile } from "./specsFixtures.mjs"

test("an approval stands until anything changes in the specs", () => {
  const specsFile = buildSpecsFile()
  assert.equal(readStandingApprovalDate(specsFile), null)

  specsFile.approval = buildSpecsApproval(
    specsFile.components,
    new Date("2026-11-24T10:00:00Z"),
  )
  assert.equal(readStandingApprovalDate(specsFile), "2026-11-24")

  specsFile.components[1].props[0].required = false
  assert.equal(readStandingApprovalDate(specsFile), null)
})

test("the zones that still ask a question are named", () => {
  const specsFile = buildSpecsFile()
  assert.deepEqual(listZonesStillToDecide(specsFile), [])

  specsFile.components[1].zones[1].kind = "to-decide"
  assert.deepEqual(listZonesStillToDecide(specsFile), [
    "OrderDeliverySettings zone B",
  ])
})

test("specs.md gives each component's decisions, changes, props and zones", () => {
  const specsFile = buildSpecsFile()
  const [select, settings] = specsFile.components
  select.developerDecisions = ["La hauteur change pour tous les usages."]
  settings.props[0].type = '"start" | "end"'

  assert.equal(
    buildSpecsSummary({
      inventory: buildApprovedInventory(),
      specsFile,
      approvalDate: "2026-11-24",
    }),
    `# Props des composants — Editor — regulation · Continuous · Default

Validé par le développeur le 2026-11-24. Construit sur l'inventaire validé le 2026-11-23 : maquette Figma version 2423993102449653660, code au commit 34ee98aa6.
Les décisions marquées « développeur » font foi : ne pas les rejuger.

## Select — À adapter

\`src/components/ui/select.tsx\`

- Développeur : La hauteur change pour tous les usages.
- À changer : Hauteur du champ : 32 px → 36 px

Zones :

- **A — Champ** (Changement de style ; écran 1)

## OrderDeliverySettings — À créer

Props :

| Prop | Type | Obligatoire | D'où vient la valeur | Règle |
| --- | --- | --- | --- | --- |
| \`targetTemperature\` | \`"start" \\| "end"\` | oui | state.targetTemperature de useOrderEditorState |  |

Zones :

- **A — Consigne** (Pilotée par des props : \`targetTemperature\` ; écran 1)
- **B — Libellé « Consigne »** (Fixe, sans prop ; écran 1)
`,
  )
})
