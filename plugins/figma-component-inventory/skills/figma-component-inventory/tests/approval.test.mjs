// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  checkApprovalAsked,
  hashApprovedContent,
} from "../scripts/lib/approval.mjs"

const VERDICTS_ON_THE_PAGE = [{ number: 1, verdict: "reused" }]
const VERDICTS_CHANGED_SINCE = [{ number: 1, verdict: "to-adapt" }]

/** @param {Partial<Parameters<typeof checkApprovalAsked>[0]>} asked */
const check = (asked) =>
  checkApprovalAsked({
    commandArguments: ["out", "--approve"],
    stillToDecide: [],
    pageFile: "out/inventory.html",
    readHashOnThePage: () => hashApprovedContent(VERDICTS_ON_THE_PAGE),
    contentToApprove: VERDICTS_ON_THE_PAGE,
    ...asked,
  })

test("the command reads whether the approval is asked, and stops on any other option", () => {
  assert.equal(check({ commandArguments: ["out"] }), false)
  assert.equal(check({}), true)
  assert.throws(
    () => check({ commandArguments: ["out", "--approve=3f9a1c2e"] }),
    {
      message:
        "Not approved: unknown option --approve=3f9a1c2e. The developer approves in the conversation; the command then takes --approve alone.",
      exitCode: 4,
    },
  )
})

test("the approval is refused while a question is open", () => {
  assert.throws(
    () => check({ stillToDecide: ["candidate 3", "candidate 7"] }),
    {
      message: 'Not approved: still "to-decide": candidate 3, candidate 7',
      exitCode: 4,
    },
  )
  // A plain redraw is not stopped by an open question.
  assert.equal(
    check({ commandArguments: ["out"], stillToDecide: ["candidate 3"] }),
    false,
  )
})

test("the approval is refused when the page does not show the content to approve", () => {
  const refusal = {
    message:
      /^Not approved: out\/inventory\.html does not show the content to approve/,
    exitCode: 4,
  }
  assert.throws(
    () => check({ readHashOnThePage: () => undefined }),
    refusal,
    "no page",
  )
  assert.throws(
    () => check({ contentToApprove: VERDICTS_CHANGED_SINCE }),
    refusal,
  )
  // A plain redraw is how the page catches up with the content.
  assert.equal(
    check({
      commandArguments: ["out"],
      contentToApprove: VERDICTS_CHANGED_SINCE,
    }),
    false,
  )
})
