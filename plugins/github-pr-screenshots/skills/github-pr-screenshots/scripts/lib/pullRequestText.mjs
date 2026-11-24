// @ts-check
// Reading and writing the texts the screenshots go into, through GitHub's `gh` command: the pull
// request description, or a review comment (a comment on a line of the changes, `#r<id>` in its
// link).
// prepare.mjs keeps the proposed change on disk until the user approves it and apply.mjs writes
// it. The text read at preparation is kept too: nothing is written when someone changed it in
// between, so that their change isn't overwritten.
import { execFileSync } from "node:child_process"
import path from "node:path"
import { parseArgs } from "node:util"
import { PLUGIN_DATA_FOLDER } from "./browser.mjs"

/**
 * @typedef {object} PullRequestTarget
 * @property {string} repository owner/repo
 * @property {string} pullRequestNumber
 * @property {string | null} commentId the review comment (the number after `#r` in its link), null
 *   for the description
 */

/**
 * @typedef {PullRequestTarget & {
 *   kind: "description" | "comment edit" | "comment reply",
 *   textBefore: string | null,
 *   textAfter: string,
 * }} PendingChange
 * kind: "comment edit" adds the screenshots to a review comment the signed-in user wrote;
 * "comment reply" answers someone else's review comment in its thread.
 * textBefore: the text read at preparation; null for a reply, which changes no existing text.
 * textAfter: the text to write: the whole description or comment, or the reply.
 */

/**
 * Reads `<owner/repo> <pr-number> [--comment <id>] [other arguments...]`.
 * @param {string[]} commandLineArguments process.argv without node and the script
 * @returns {(PullRequestTarget & { otherArguments: string[] }) | null} null when they don't match
 */
export function parsePullRequestTarget(commandLineArguments) {
  const { values, positionals } = parseArgs({
    args: commandLineArguments,
    options: { comment: { type: "string" } },
    allowPositionals: true,
    strict: false,
  })
  const [repository, pullRequestNumber, ...otherArguments] = positionals
  const commentId = typeof values.comment === "string" ? values.comment : null
  if (!repository?.includes("/") || !/^\d+$/.test(pullRequestNumber ?? "")) return null
  if (values.comment !== undefined && !/^\d+$/.test(commentId ?? "")) return null
  return { repository, pullRequestNumber, commentId, otherArguments }
}

/** @param {PullRequestTarget} target */
export function buildPendingChangeFile({ repository, pullRequestNumber, commentId }) {
  const textName = commentId ? `comment-${commentId}` : "description"
  return path.join(
    PLUGIN_DATA_FOLDER,
    "pending",
    `${repository.replace("/", "__")}__${pullRequestNumber}__${textName}.json`,
  )
}

/**
 * @param {string[]} ghArguments
 * @param {string} [standardInput]
 */
function runGh(ghArguments, standardInput) {
  return execFileSync("gh", ghArguments, { encoding: "utf8", input: standardInput })
}

/** @param {PullRequestTarget} target */
export function readPullRequestDescription({ repository, pullRequestNumber }) {
  const description = runGh(["pr", "view", pullRequestNumber, "--repo", repository, "--json", "body", "--jq", ".body"])
  return description.replace(/\n$/, "")
}

/**
 * @param {PullRequestTarget} target
 * @returns {{ body: string, authorLogin: string }}
 */
export function readReviewComment({ repository, commentId }) {
  const comment = JSON.parse(runGh(["api", `repos/${repository}/pulls/comments/${commentId}`]))
  return { body: comment.body, authorLogin: comment.user.login }
}

/** @type {Record<PendingChange["kind"], { readCurrentText?: (target: PullRequestTarget) => string, write: (change: PendingChange) => void }>} */
const WRITERS_BY_KIND = {
  description: {
    readCurrentText: readPullRequestDescription,
    write: ({ repository, pullRequestNumber, textAfter }) =>
      runGh(["pr", "edit", pullRequestNumber, "--repo", repository, "--body-file", "-"], textAfter),
  },
  "comment edit": {
    readCurrentText: (target) => readReviewComment(target).body,
    write: ({ repository, commentId, textAfter }) =>
      runGh(
        ["api", "--method", "PATCH", `repos/${repository}/pulls/comments/${commentId}`, "--input", "-"],
        JSON.stringify({ body: textAfter }),
      ),
  },
  "comment reply": {
    write: ({ repository, pullRequestNumber, commentId, textAfter }) =>
      runGh(
        [
          "api",
          "--method",
          "POST",
          `repos/${repository}/pulls/${pullRequestNumber}/comments/${commentId}/replies`,
          "--input",
          "-",
        ],
        JSON.stringify({ body: textAfter }),
      ),
  },
}

/**
 * Writes the pending change. Returns false, writing nothing, when the text changed since preparation.
 * @param {PendingChange} pendingChange
 */
export function writePendingChange(pendingChange) {
  const { readCurrentText, write } = WRITERS_BY_KIND[pendingChange.kind]
  if (readCurrentText && readCurrentText(pendingChange) !== pendingChange.textBefore) return false
  write(pendingChange)
  return true
}
