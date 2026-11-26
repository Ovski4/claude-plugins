// @ts-check
// The developer's approval of a file the model filled (verdicts.json, specs.json): the day
// he gave it and a hash of what he approved, so that any later change makes the page a
// draft again. Each file keeps its hash under its own field name.
// He approves in the conversation, once the page asks him nothing more: the model then runs
// the render script with "--approve", which is refused while a question is open, and when
// the file is not the one the page he read was drawn from.
import { createHash } from "node:crypto"
import fs from "node:fs"
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
export const EXIT_CODE_NOT_APPROVED = 4
// The file the specs skill fills in an inventory's folder, and the field of its approval
// that holds the hash of the approved components.
export const SPECS_FILE_NAME = "specs.json"
export const SPECS_HASH_KEY = "specsHash"

const APPROVE_FLAG = "--approve"

/**
 * Whether the command asks for the approval. "--approve" is the only option of a
 * render.mjs: any other one stops the command, so that a mistyped approval
 * ("--approve=3f9a1c2e") is not taken for a plain redraw of the page.
 * @param {string[]} commandArguments what follows the script's name
 */
export function readWhetherApprovalIsAsked(commandArguments) {
  const unknownOption = commandArguments.find(
    (argument) => argument.startsWith("--") && argument !== APPROVE_FLAG,
  )
  if (unknownOption === undefined)
    return commandArguments.includes(APPROVE_FLAG)
  throw new CommandFailure(
    `Not approved: unknown option ${unknownOption}. The developer approves in the conversation; the command then takes ${APPROVE_FLAG} alone.`,
    EXIT_CODE_NOT_APPROVED,
  )
}

/**
 * Stops the command while something waits for the developer's decision: nothing is
 * approved before he has answered.
 * @param {string[]} stillToDecide what still asks him a question: "candidate 7", "Select zone C"
 */
export function refuseApprovalWhileUndecided(stillToDecide) {
  if (!stillToDecide.length) return
  throw new CommandFailure(
    `Not approved: still "to-decide": ${stillToDecide.join(", ")}`,
    EXIT_CODE_NOT_APPROVED,
  )
}

/**
 * Stops the command when the file to approve is not the one the page shows: the developer
 * approves what he read, and the model may have changed the file since that page was drawn.
 * @param {object} asked
 * @param {string} asked.pageFile the page the developer read, "out/inventory.html"
 * @param {string} asked.hashKey the field the page's data keeps the hash of its content
 *   in: "verdictsHash", "specsHash"
 * @param {unknown} asked.contentToApprove the file's content as it is now
 */
export function refuseApprovalOfContentNotOnThePage({
  pageFile,
  hashKey,
  contentToApprove,
}) {
  const pageText = fs.existsSync(pageFile)
    ? fs.readFileSync(pageFile, "utf8")
    : ""
  const hashOnThePage = pageText.match(
    new RegExp(`"${hashKey}":"([0-9a-f]+)"`),
  )?.[1]
  if (hashOnThePage === hashApprovedContent(contentToApprove)) return
  throw new CommandFailure(
    `Not approved: ${pageFile} does not show the content to approve, which changed since the page was drawn. Run the command without ${APPROVE_FLAG}, hand the page to the developer and wait for his approval of that page.`,
    EXIT_CODE_NOT_APPROVED,
  )
}
