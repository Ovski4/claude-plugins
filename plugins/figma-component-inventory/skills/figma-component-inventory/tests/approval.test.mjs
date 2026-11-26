// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  isApprovalAsked,
  refuseApprovalWhileUndecided,
} from "../scripts/lib/approval.mjs"

test("the command reads whether the approval is asked", () => {
  assert.equal(isApprovalAsked(["out"]), false)
  assert.equal(isApprovalAsked(["out", "--approve"]), true)
})

test("the approval is refused only while a question is open", () => {
  assert.doesNotThrow(() => refuseApprovalWhileUndecided([]))
  assert.throws(
    () => refuseApprovalWhileUndecided(["candidate 3", "candidate 7"]),
    {
      message: 'Not approved: still "to-decide": candidate 3, candidate 7',
      exitCode: 4,
    },
  )
})
