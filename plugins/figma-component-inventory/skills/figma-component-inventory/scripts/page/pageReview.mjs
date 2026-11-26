// @ts-check
// What inventory.html and specs.html do alike, beyond their look: render.mjs pastes this
// file before each page's own page.js as a plain script, without its "export" words, so its
// functions are that script's globals. It fills the page's header, makes the boxes the
// developer ticks as he checks the page, keeps what is ticked in the browser, shows the
// count in the bar at the bottom, invites him to approve once nothing blocks it, and tells
// the stylesheet how high that bar is.
// The page has the elements "screen-name", "approval", "fingerprint", "feedback" and
// "feedback-count".

/** @param {string} id */
const getSharedElement = (id) =>
  /** @type {HTMLElement} */ (document.getElementById(id))

// The corrections bar covers the bottom of the window, and its height changes: the form
// opens, the corrections add up. The stylesheet reads that height to end the page above
// the bar, so that the last line of the page can be scrolled into view.
const correctionsBar = getSharedElement("feedback")
new ResizeObserver(() => {
  document.documentElement.style.setProperty(
    "--corrections-bar-height",
    `${correctionsBar.offsetHeight}px`,
  )
}).observe(correctionsBar)

/**
 * The header's texts: what the page is about, where its approval stands, what it is
 * built on.
 * @param {object} page
 * @param {string} page.subject what the screens' names share: "Editor — regulation (6 écrans)"
 * @param {string | null} page.approvalDate null for a draft
 * @param {string} page.fingerprintLine
 */
export function showPageHeader({ subject, approvalDate, fingerprintLine }) {
  getSharedElement("screen-name").textContent = subject
  const approval = getSharedElement("approval")
  approval.textContent = approvalDate
    ? `Validé par le développeur le ${approvalDate}`
    : "Brouillon — pas encore validé par le développeur"
  approval.classList.toggle("approved", Boolean(approvalDate))
  getSharedElement("fingerprint").textContent = fingerprintLine
}

/**
 * True while the caret is in a field: the page's keys (the arrows, Escape) then belong to
 * what is being typed.
 * @param {Event} event
 */
export const isTypingInAField = (event) =>
  event.target instanceof Element &&
  Boolean(event.target.closest("input, select, textarea"))

// Escape typed in a field leaves the field, so that the page's keys answer again.
document.addEventListener("keydown", (event) => {
  const isLeavingAField = event.key === "Escape" && isTypingInAField(event)
  if (isLeavingAField && event.target instanceof HTMLElement)
    event.target.blur()
})

const COPIED_SHOWN_FOR_MILLISECONDS = 1500

/**
 * Copies a text for the developer to paste, and says so on the button for a moment.
 * @param {HTMLElement} button
 * @param {string} text
 * @param {() => void} selectForManualCopy called when the browser refuses the clipboard:
 *   shows the text selected, for a copy by hand
 */
export async function copyWithConfirmation(button, text, selectForManualCopy) {
  const idleText = button.textContent
  try {
    await navigator.clipboard.writeText(text)
    button.textContent = "Copié"
    setTimeout(
      () => (button.textContent = idleText),
      COPIED_SHOWN_FOR_MILLISECONDS,
    )
  } catch {
    selectForManualCopy()
  }
}

/** Why a box cannot be ticked yet, written in place of its label. */
export const WHY_NOT_YET = {
  corrected: "Corrigé : à vérifier une fois la page reconstruite",
  undecided: "À trancher d'abord",
}

/**
 * What a box is about, as the count names it for one and for several.
 * @typedef {keyof typeof REVIEW_SUBJECT_NAMES} ReviewSubject
 */
const REVIEW_SUBJECT_NAMES = {
  component: ["composant", "composants"],
  screen: ["écran", "écrans"],
}

/**
 * What the boxes are about: "8 composants, 6 écrans".
 * @param {ReviewCheck[]} checks
 */
const countReviewSubjects = (checks) =>
  /** @type {ReviewSubject[]} */ (Object.keys(REVIEW_SUBJECT_NAMES))
    .map((subject) => {
      const subjectCount = checks.filter(
        (check) => check.subject === subject,
      ).length
      const [nameOfOne, nameOfSeveral] = REVIEW_SUBJECT_NAMES[subject]
      return {
        subjectCount,
        name: subjectCount > 1 ? nameOfSeveral : nameOfOne,
      }
    })
    .filter(({ subjectCount }) => subjectCount > 0)
    .map(({ subjectCount, name }) => `${subjectCount} ${name}`)
    .join(", ")

/**
 * A box as it stands now.
 * @typedef {object} ReviewCheck
 * @property {string} reviewHash names what the developer read: it changes when that does
 * @property {string} label what ticking the box means, written beside it
 * @property {ReviewSubject} subject what the box is about, for the count's detail
 * @property {string | null} whyNotYet why it cannot be ticked, written in place of the
 *   label (a question still open, a correction); null when it can
 */

// What the developer has checked, as the hashes of the things checked. A rebuilt page gives
// the same hash to what did not change: its box stays ticked.
/** @type {Set<string>} */
const reviewedHashes = new Set()
let reviewStorageKey = ""

/**
 * Finds back what the developer ticked on an earlier build of the page.
 * @param {string} storageKey names the page and its mock-up, the same from one build to the next
 * @param {string[]} hashesOnThePage what is ticked but no longer shown as it was is forgotten
 */
export function restoreReview(storageKey, hashesOnThePage) {
  reviewStorageKey = storageKey
  try {
    /** @type {string[]} */
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]")
    for (const reviewHash of saved)
      if (hashesOnThePage.includes(reviewHash)) reviewedHashes.add(reviewHash)
  } catch {
    // Nothing kept, or unreadable: the page starts with nothing checked.
  }
}

/** @param {ReviewCheck} check */
export const isReviewed = (check) =>
  check.whyNotYet === null && reviewedHashes.has(check.reviewHash)

/**
 * Shows a box as its check stands now: ticked or not, and disabled with the reason.
 * @param {HTMLElement} reviewBox made by `createReviewBox`
 * @param {ReviewCheck} check
 */
export function fillReviewBox(reviewBox, check) {
  const [box, caption] = reviewBox.children
  if (!(box instanceof HTMLInputElement)) return
  box.checked = isReviewed(check)
  box.disabled = check.whyNotYet !== null
  caption.textContent = check.whyNotYet ?? check.label
}

/**
 * @param {ReviewCheck} check
 * @param {() => void} onToggle called once the developer ticked or unticked the box: the
 *   page shows the new count, and whatever else depends on it
 */
export function createReviewBox(check, onToggle) {
  const box = document.createElement("input")
  box.type = "checkbox"
  const reviewBox = document.createElement("label")
  reviewBox.className = "review-check"
  reviewBox.append(box, document.createElement("span"))
  fillReviewBox(reviewBox, check)
  // Ticking a box does not also click what the box sits on.
  reviewBox.addEventListener("click", (event) => event.stopPropagation())
  box.addEventListener("change", () => {
    if (box.checked) reviewedHashes.add(check.reviewHash)
    else reviewedHashes.delete(check.reviewHash)
    try {
      localStorage.setItem(
        reviewStorageKey,
        JSON.stringify([...reviewedHashes]),
      )
    } catch {
      // The browser keeps nothing for this page: the checks last until it is closed.
    }
    onToggle()
  })
  return reviewBox
}

/**
 * The count, the way to the next box and the invitation to approve, made at the first
 * call: the count and the button before the corrections' count, the invitation at the end
 * of the bar.
 * @type {{ count: HTMLElement, nextButton: HTMLElement, approvalInvitation: HTMLElement } | null}
 */
let reviewProgressElements = null
/**
 * What the button « Suivant à vérifier » works on: the boxes as they stand, the one it
 * showed last, and how the page brings a box into view.
 * @type {{ checks: ReviewCheck[], lastShownHash: string | null, showCheck: (check: ReviewCheck) => void }}
 */
const nextToReview = { checks: [], lastShownHash: null, showCheck: () => {} }

/** @param {ReviewCheck} check */
const isLeftToReview = (check) => check.whyNotYet === null && !isReviewed(check)

/**
 * Shows the next box that can be ticked and is not: the first one after the box shown
 * last, back to the top once the end is reached. A box skipped without a tick is found
 * again on the next round.
 */
function showNextToReview() {
  const { checks, lastShownHash, showCheck } = nextToReview
  const lastShownIndex = checks.findIndex(
    (check) => check.reviewHash === lastShownHash,
  )
  const next = [
    ...checks.slice(lastShownIndex + 1),
    ...checks.slice(0, lastShownIndex + 1),
  ].find(isLeftToReview)
  if (!next) return
  nextToReview.lastShownHash = next.reviewHash
  showCheck(next)
}

/**
 * Brings a box into view and marks it, until another one is pointed at.
 * @param {HTMLElement} reviewBox made by `createReviewBox`
 */
export function pointAtReviewBox(reviewBox) {
  for (const pointed of document.querySelectorAll(".review-check.pointed"))
    pointed.classList.remove("pointed")
  reviewBox.classList.add("pointed")
  reviewBox.scrollIntoView({ block: "center" })
  reviewBox.querySelector("input")?.focus({ preventScroll: true })
}

function createReviewProgressElements() {
  const count = document.createElement("p")
  count.className = "review-count"
  const nextButton = document.createElement("button")
  nextButton.type = "button"
  nextButton.textContent = "Suivant à vérifier →"
  nextButton.addEventListener("click", showNextToReview)
  const approvalInvitation = document.createElement("p")
  approvalInvitation.className = "approval-invitation"
  approvalInvitation.textContent =
    "Plus rien à trancher ni à corriger. Pour valider, le dire dans la conversation : « je valide »."
  getSharedElement("feedback-count").before(count, nextButton)
  getSharedElement("feedback").append(approvalInvitation)
  return { count, nextButton, approvalInvitation }
}

/**
 * In the bar at the bottom: how many boxes are ticked, and the invitation to approve. The
 * boxes only help the developer keep track of what he has read: the invitation shows as
 * soon as no question is open and no correction waits, ticked or not.
 * @param {ReviewCheck[]} checks every box of the page, shown or not
 * @param {object} page
 * @param {boolean} page.isApproved an approved page invites to nothing
 * @param {number} page.stillToDecideCount how many things the approving script would
 *   refuse on, as it counts them: the page and the script then never disagree
 * @param {number} page.correctionCount
 * @param {(check: ReviewCheck) => void} page.showCheck brings a box into view, whatever
 *   the page has to show first (a tab, a component), then calls `pointAtReviewBox` on it
 */
export function showReviewProgress(
  checks,
  { isApproved, stillToDecideCount, correctionCount, showCheck },
) {
  reviewProgressElements ??= createReviewProgressElements()
  const { count, nextButton, approvalInvitation } = reviewProgressElements
  nextToReview.checks = checks
  nextToReview.showCheck = showCheck
  nextButton.hidden = !checks.some(isLeftToReview)
  const reviewedCount = checks.filter(isReviewed).length
  count.textContent = `${reviewedCount} / ${checks.length} vérifiés (${countReviewSubjects(checks)})`
  approvalInvitation.hidden =
    isApproved || stillToDecideCount > 0 || correctionCount > 0
}
