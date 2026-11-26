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
    `# Component props — Editor — regulation · Continuous · Default

Approved by the developer on 2026-11-24. Built on the inventory approved on 2026-11-23: Figma design version 2423993102449653660, code at commit 34ee98aa6.
The decisions marked "Developer" are final: do not judge them again.

## Select — To adapt

\`src/components/ui/select.tsx\`

- Developer: La hauteur change pour tous les usages.
- To change: Hauteur du champ: 32 px → 36 px

Zones:

- **A — Champ** (Style change; screen 1)

## OrderDeliverySettings — To create

Props:

| Prop | Type | Required | Where the value comes from | Rule |
| --- | --- | --- | --- | --- |
| \`targetTemperature\` | \`"start" \\| "end"\` | yes | state.targetTemperature de useOrderEditorState |  |

Zones:

- **A — Consigne** (Driven by props: \`targetTemperature\`; screen 1)
- **B — Libellé « Consigne »** (Fixed, no prop; screen 1)
`,
  )
})
