// @ts-check
// Reading and writing the texts the screenshots go into, through GitHub's `gh` command: the pull
// request description, or a review comment (a comment on a line of the changes, `#r<id>` in its
// link).
// prepare.mjs keeps the proposed change on disk until the user approves it and apply.mjs writes
// it. The text read at preparation is kept too: nothing is written when someone changed it in
// between, so that their change isn't overwritten.
import { execFileSync } from "node:child_process"
import path from "node:path"
import { PLUGIN_DATA_FOLDER } from "./browser.mjs"

/**
 * @typedef {object} PendingChange
 * @property {"description" | "comment edit" | "comment reply"} kind "comment edit" adds the
 *   screenshots to a review comment the signed-in user wrote; "comment reply" answers someone
 *   else's review comment in its thread.
 * @property {string | null} textBefore the text read at preparation; null for a reply, which
 *   changes no existing text.
 * @property {string} textAfter the text to write: the whole description or comment, or the reply.
 */

/**
 * @param {string} repository owner/repo
 * @param {string} pullRequestNumber
 * @param {string | null} commentId the review comment, null for the description
 */
export function buildPendingChangeFile(repository, pullRequestNumber, commentId) {
  const target = commentId ? `comment-${commentId}` : "description"
  return path.join(
    PLUGIN_DATA_FOLDER,
    "pending",
    `${repository.replace("/", "__")}__${pullRequestNumber}__${target}.json`,
  )
}

/**
 * @param {string[]} ghArguments
 * @param {string} [standardInput]
 */
function runGh(ghArguments, standardInput) {
  return execFileSync("gh", ghArguments, { encoding: "utf8", input: standardInput })
}

/**
 * @param {string} repository owner/repo
 * @param {string} pullRequestNumber
 */
export function readPullRequestDescription(repository, pullRequestNumber) {
  const description = runGh(["pr", "view", pullRequestNumber, "--repo", repository, "--json", "body", "--jq", ".body"])
  return description.replace(/\n$/, "")
}

/**
 * @param {string} repository owner/repo
 * @param {string} commentId
 * @returns {{ body: string, authorLogin: string }}
 */
export function readReviewComment(repository, commentId) {
  const comment = JSON.parse(runGh(["api", `repos/${repository}/pulls/comments/${commentId}`]))
  return { body: comment.body, authorLogin: comment.user.login }
}

/**
 * Writes the pending change. Returns false, writing nothing, when the text changed since preparation.
 * @param {string} repository owner/repo
 * @param {string} pullRequestNumber
 * @param {string | null} commentId null for the description
 * @param {PendingChange} pendingChange
 */
export function writePendingChange(repository, pullRequestNumber, commentId, { kind, textBefore, textAfter }) {
  if (kind === "description") {
    if (readPullRequestDescription(repository, pullRequestNumber) !== textBefore) return false
    runGh(["pr", "edit", pullRequestNumber, "--repo", repository, "--body-file", "-"], textAfter)
    return true
  }
  const commentRequestBody = JSON.stringify({ body: textAfter })
  if (kind === "comment edit") {
    if (readReviewComment(repository, /** @type {string} */ (commentId)).body !== textBefore) return false
    runGh(
      ["api", "--method", "PATCH", `repos/${repository}/pulls/comments/${commentId}`, "--input", "-"],
      commentRequestBody,
    )
    return true
  }
  const repliesEndpoint = `repos/${repository}/pulls/${pullRequestNumber}/comments/${commentId}/replies`
  runGh(["api", "--method", "POST", repliesEndpoint, "--input", "-"], commentRequestBody)
  return true
}
