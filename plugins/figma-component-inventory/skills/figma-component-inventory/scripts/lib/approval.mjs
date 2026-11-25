// @ts-check
// The developer's approval of a file the model filled (verdicts.json, specs.json): the day
// he gave it and a hash of what he approved, so that any later change makes the page a
// draft again. Each file keeps its hash under its own field name.
// He approves with a command the page shows once he has ticked every box. The command
// carries a code, the start of the hash of what the page shows: the approval is refused
// when the file changed since that page was built.
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
const APPROVAL_CODE_LENGTH = 8

/**
 * The code the page's command carries, "3f9a1c2e": it names the content the page shows.
 * @param {unknown} contentToApprove
 */
export const buildApprovalCode = (contentToApprove) =>
  hashApprovedContent(contentToApprove).slice(0, APPROVAL_CODE_LENGTH)

/**
 * Whether the command asks for the approval, and with which code.
 * @param {string[]} commandArguments what follows the script's name
 * @returns {{ isApprovalAsked: boolean, givenCode: string | null }} `givenCode`: null for
 *   a bare "--approve"
 */
export function readApprovalAsked(commandArguments) {
  const flag = commandArguments.find(
    (argument) =>
      argument === APPROVE_FLAG || argument.startsWith(`${APPROVE_FLAG}=`),
  )
  return {
    isApprovalAsked: flag !== undefined,
    givenCode: flag?.slice(APPROVE_FLAG.length + 1) || null,
  }
}

/**
 * Why the approval is refused, or null when it can be given: nothing waits for the
 * developer's decision, and the code is the one of the content as it is.
 * @param {object} asked
 * @param {string | null} asked.givenCode
 * @param {unknown} asked.contentToApprove
 * @param {string} asked.pageFileName "inventory.html": where the developer finds the command
 * @param {string[]} asked.stillToDecide what still asks him a question: "candidate 7", "Select zone C"
 * @returns {string | null}
 */
export function explainRefusedApproval({
  givenCode,
  contentToApprove,
  pageFileName,
  stillToDecide,
}) {
  if (stillToDecide.length)
    return `Not approved: still "to-decide": ${stillToDecide.join(", ")}`
  if (givenCode === null) {
    return `Not approved: ${APPROVE_FLAG} needs the code that ${pageFileName} gives. The developer ticks every box of the page, then runs the command it shows; nobody else runs it.`
  }
  if (givenCode !== buildApprovalCode(contentToApprove)) {
    return `Not approved: the code ${givenCode} names another content than the current one. The page it was copied from is out of date: reload ${pageFileName}, check what changed, then run the command it shows.`
  }
  return null
}

/**
 * A path as one word of a shell command: between single quotes the shell reads every
 * character as it is, "$" and spaces included.
 * @param {string} filePath
 */
const quoteForShell = (filePath) => `'${filePath.replaceAll("'", `'\\''`)}'`

/**
 * The command the page shows once every box is ticked, ready to paste in a terminal. It
 * runs between parentheses, so that the terminal stays in the folder it was in.
 * @param {object} input
 * @param {string} input.workingFolder where the command runs from
 * @param {string} input.renderScript the render.mjs that approves
 * @param {string} input.outDir the folder of the files to approve
 * @param {unknown} input.contentToApprove
 */
export function buildApproveCommand({
  workingFolder,
  renderScript,
  outDir,
  contentToApprove,
}) {
  const [folder, script, files] = [workingFolder, renderScript, outDir].map(
    quoteForShell,
  )
  return `(cd ${folder} && node ${script} ${files} ${APPROVE_FLAG}=${buildApprovalCode(contentToApprove)})`
}
