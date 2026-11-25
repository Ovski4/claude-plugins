// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildApprovalCode,
  buildApproveCommand,
  explainRefusedApproval,
  readApprovalAsked,
} from "../scripts/lib/approval.mjs"

const VERDICTS_ON_THE_PAGE = [{ number: 1, verdict: "reused" }]
const VERDICTS_CHANGED_SINCE = [{ number: 1, verdict: "to-adapt" }]

test("the command reads whether the approval is asked, and with which code", () => {
  assert.deepEqual(readApprovalAsked(["out"]), {
    isApprovalAsked: false,
    givenCode: null,
  })
  assert.deepEqual(readApprovalAsked(["out", "--approve"]), {
    isApprovalAsked: true,
    givenCode: null,
  })
  assert.deepEqual(readApprovalAsked(["out", "--approve=3f9a1c2e"]), {
    isApprovalAsked: true,
    givenCode: "3f9a1c2e",
  })
})

test("the approval is refused while a question is open, without the page's code, or with the code of another content", () => {
  const codeOfThePage = buildApprovalCode(VERDICTS_ON_THE_PAGE)
  assert.match(codeOfThePage, /^[0-9a-f]{8}$/)
  /** @param {Partial<Parameters<typeof explainRefusedApproval>[0]>} asked */
  const explain = (asked) =>
    explainRefusedApproval({
      givenCode: codeOfThePage,
      contentToApprove: VERDICTS_ON_THE_PAGE,
      pageFileName: "inventory.html",
      stillToDecide: [],
      ...asked,
    })

  assert.equal(explain({}), null)
  assert.equal(
    explain({ stillToDecide: ["candidate 3", "candidate 7"] }),
    'Not approved: still "to-decide": candidate 3, candidate 7',
  )
  assert.match(
    explain({ givenCode: null }) ?? "",
    /needs the code that inventory\.html gives/,
  )
  assert.match(
    explain({ contentToApprove: VERDICTS_CHANGED_SINCE }) ?? "",
    /names another content than the current one/,
  )
})

test("the page's command runs the render script from the repo, with the code", () => {
  assert.equal(
    buildApproveCommand({
      workingFolder: "/work/my repo",
      renderScript: "/plugins/render.mjs",
      outDir: "/work/my repo/it's $out",
      contentToApprove: VERDICTS_ON_THE_PAGE,
    }),
    `(cd '/work/my repo' && node '/plugins/render.mjs' '/work/my repo/it'\\''s $out' --approve=${buildApprovalCode(VERDICTS_ON_THE_PAGE)})`,
  )
})
