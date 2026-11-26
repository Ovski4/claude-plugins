// @ts-check
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import {
  hashApprovedContent,
  readWhetherApprovalIsAsked,
  refuseApprovalOfContentNotOnThePage,
  refuseApprovalWhileUndecided,
} from "../scripts/lib/approval.mjs"

const VERDICTS_ON_THE_PAGE = [{ number: 1, verdict: "reused" }]
const VERDICTS_CHANGED_SINCE = [{ number: 1, verdict: "to-adapt" }]

test("the command reads whether the approval is asked, and stops on any other option", () => {
  assert.equal(readWhetherApprovalIsAsked(["out"]), false)
  assert.equal(readWhetherApprovalIsAsked(["out", "--approve"]), true)
  assert.throws(
    () => readWhetherApprovalIsAsked(["out", "--approve=3f9a1c2e"]),
    {
      message:
        "Not approved: unknown option --approve=3f9a1c2e. The developer approves in the conversation; the command then takes --approve alone.",
      exitCode: 4,
    },
  )
})

test("the approval is refused while a question is open", () => {
  assert.doesNotThrow(() => refuseApprovalWhileUndecided([]))
  assert.throws(
    () => refuseApprovalWhileUndecided(["candidate 3", "candidate 7"]),
    {
      message: 'Not approved: still "to-decide": candidate 3, candidate 7',
      exitCode: 4,
    },
  )
})

test("the approval is refused when the page does not show the content to approve", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "approval-test-"))
  const pageFile = path.join(folder, "inventory.html")
  /** @param {unknown} contentToApprove */
  const refuse = (contentToApprove) =>
    refuseApprovalOfContentNotOnThePage({
      pageFile,
      hashKey: "verdictsHash",
      contentToApprove,
    })
  const refusal = {
    message: new RegExp(`^Not approved: ${pageFile} does not show the content`),
    exitCode: 4,
  }

  assert.throws(() => refuse(VERDICTS_ON_THE_PAGE), refusal, "no page drawn")
  fs.writeFileSync(
    pageFile,
    `<script>{"verdictsHash":"${hashApprovedContent(VERDICTS_ON_THE_PAGE)}","title":"Editor"}</script>`,
  )
  assert.doesNotThrow(() => refuse(VERDICTS_ON_THE_PAGE))
  assert.throws(() => refuse(VERDICTS_CHANGED_SINCE), refusal)
  fs.rmSync(folder, { recursive: true })
})
