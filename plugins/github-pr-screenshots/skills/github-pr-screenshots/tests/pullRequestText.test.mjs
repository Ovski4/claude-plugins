import assert from "node:assert/strict"
import test from "node:test"

import { parsePullRequestTarget } from "../scripts/lib/pullRequestText.mjs"

test("the pull request, the optional comment and the other arguments are read; malformed ones are refused", () => {
  assert.deepEqual(parsePullRequestTarget(["acme/shop", "12", "--comment", "4680", "a.png", "Caption"]), {
    repository: "acme/shop",
    pullRequestNumber: "12",
    commentId: "4680",
    otherArguments: ["a.png", "Caption"],
  })
  assert.equal(parsePullRequestTarget(["acme/shop", "12"])?.commentId, null)
  assert.equal(parsePullRequestTarget(["shop", "12"]), null)
  assert.equal(parsePullRequestTarget(["acme/shop", "12", "--comment", "r4680"]), null)
})
