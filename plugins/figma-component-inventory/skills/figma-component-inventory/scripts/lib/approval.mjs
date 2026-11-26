// @ts-check
// The developer's approval of a file the model filled (verdicts.json, specs.json): the day
// he gave it and a hash of what he approved, so that any later change makes the page a
// draft again. Each file keeps its hash under its own field name.
// He approves in the conversation, once the page asks him nothing more: the model then runs
// the render script with "--approve", which is refused while a question is open, and when
// the file is not the one the page he read was drawn from.
import { createHash } from "node:crypto"
import { CommandFailure } from "./commandFailure.mjs"

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

/** The exit code of a render.mjs whose approval is refused. */
const EXIT_CODE_NOT_APPROVED = 4
// The file the specs skill fills in an inventory's folder, and the field of its approval
// that holds the hash of the approved components.
export const SPECS_FILE_NAME = "specs.json"
export const SPECS_HASH_KEY = "specsHash"

const APPROVE_FLAG = "--approve"

/**
 * Whether the command asks for an approval that can be given; an approval asked for and
 * refused stops the command. "--approve" is the only option of a render.mjs: any other
 * one stops it too, so that a mistyped approval ("--aprove", "--approve=yes") is not taken
 * for a plain redraw of the page.
 * It is refused while something waits for the developer's decision, and when the page he
 * read does not show the content to approve: the model may have changed the file since
 * that page was drawn.
 * @param {object} asked
 * @param {string[]} asked.commandArguments what follows the script's name
 * @param {string[]} asked.stillToDecide what still asks the developer a question:
 *   "candidate 7", "Select zone C"
 * @param {string} asked.pageFile the page he read, "out/inventory.html"
 * @param {() => unknown} asked.readHashOnThePage reads the hash of its content that the
 *   page carries, undefined when no page is drawn; called only when the approval is asked
 * @param {unknown} asked.contentToApprove the file's content as it is now
 * @returns {boolean}
 */
export function checkApprovalAsked({
  commandArguments,
  stillToDecide,
  pageFile,
  readHashOnThePage,
  contentToApprove,
}) {
  const unknownOption = commandArguments.find(
    (argument) => argument.startsWith("--") && argument !== APPROVE_FLAG,
  )
  const isAsked = commandArguments.includes(APPROVE_FLAG)
  const refusals = [
    unknownOption !== undefined &&
      `unknown option ${unknownOption}. The developer approves in the conversation; the command then takes ${APPROVE_FLAG} alone.`,
    isAsked &&
      stillToDecide.length > 0 &&
      `still "to-decide": ${stillToDecide.join(", ")}`,
    isAsked &&
      readHashOnThePage() !== hashApprovedContent(contentToApprove) &&
      `${pageFile} does not show the content to approve, which changed since the page was drawn. Run the command without ${APPROVE_FLAG}, hand the page to the developer and wait for his approval of that page.`,
  ]
  const refusal = refusals.find((each) => typeof each === "string")
  if (refusal)
    throw new CommandFailure(`Not approved: ${refusal}`, EXIT_CODE_NOT_APPROVED)
  return isAsked
}
