// @ts-check
// The developer's approval of a file the model filled (verdicts.json, specs.json): the day
// he gave it and a hash of what he approved, so that any later change makes the page a
// draft again. Each file keeps its hash under its own field name.
// He approves in the conversation, once the page asks him nothing more: the model then runs
// the render script with "--approve", which is refused while a question is open.
import { createHash } from "node:crypto"

/**
 * @template {string} HashKey
 * @typedef {{ date: string } & Record<HashKey, string>} ApprovalOf
 * `date`: the day the developer approved, "2026-11-23"; the hash key holds the hash of
 * what he approved.
 */

/**
 * Changes as soon as anything in the content changes.
 * @param {unknown} approvedContent
 */
export const hashApprovedContent = (approvedContent) =>
  createHash("sha256").update(JSON.stringify(approvedContent)).digest("hex")

const REVIEW_HASH_LENGTH = 12

/**
 * A short hash of one thing the developer checks on the page (a component, a screen): the
 * browser keeps it once checked, and the check holds while a rebuilt page gives the same.
 * @param {unknown} reviewedContent what the developer reads about that thing
 */
export const hashWhatIsReviewed = (reviewedContent) =>
  hashApprovedContent(reviewedContent).slice(0, REVIEW_HASH_LENGTH)

/**
 * @template {string} HashKey
 * @param {HashKey} hashKey the field the file keeps the hash in: "verdictsHash", "specsHash"
 * @param {unknown} approvedContent what the developer has just approved
 * @param {Date} now
 * @returns {ApprovalOf<HashKey>}
 */
export function buildApproval(hashKey, approvedContent, now) {
  return /** @type {ApprovalOf<HashKey>} */ ({
    date: now.toISOString().slice(0, 10),
    [hashKey]: hashApprovedContent(approvedContent),
  })
}

/**
 * The day of the approval while it stands: null when the developer has not approved, or
 * when the content changed since.
 * @template {string} HashKey
 * @param {HashKey} hashKey
 * @param {ApprovalOf<HashKey> | undefined} approval
 * @param {unknown} content the content as it is now
 * @returns {string | null}
 */
export function readStandingApprovalDate(hashKey, approval, content) {
  return approval?.[hashKey] === hashApprovedContent(content)
    ? approval.date
    : null
}

/** The exit code of a render.mjs whose approval is refused, whatever the reason. */
export const EXIT_CODE_NOT_APPROVED = 4
// The file the specs skill fills in an inventory's folder, and the field of its approval
// that holds the hash of the approved components.
export const SPECS_FILE_NAME = "specs.json"
export const SPECS_HASH_KEY = "specsHash"

const APPROVE_FLAG = "--approve"

/**
 * Whether the command asks for the approval.
 * @param {string[]} commandArguments what follows the script's name
 */
export const isApprovalAsked = (commandArguments) =>
  commandArguments.includes(APPROVE_FLAG)

/**
 * Why the approval is refused, or null when it can be given: nothing waits for the
 * developer's decision.
 * @param {string[]} stillToDecide what still asks him a question: "candidate 7", "Select zone C"
 * @returns {string | null}
 */
export const explainRefusedApproval = (stillToDecide) =>
  stillToDecide.length
    ? `Not approved: still "to-decide": ${stillToDecide.join(", ")}`
    : null
