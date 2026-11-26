// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  explainRefusedApproval,
  isApprovalAsked,
} from "../scripts/lib/approval.mjs"

test("the command reads whether the approval is asked", () => {
  assert.equal(isApprovalAsked(["out"]), false)
  assert.equal(isApprovalAsked(["out", "--approve"]), true)
})

test("the approval is refused only while a question is open", () => {
  assert.equal(explainRefusedApproval([]), null)
  assert.equal(
    explainRefusedApproval(["candidate 3", "candidate 7"]),
    'Not approved: still "to-decide": candidate 3, candidate 7',
  )
})
