// @ts-check
// What inventory.html and specs.html do alike, beyond their look: render.mjs pastes this
// file before each page's own page.js as a plain script, without its "export" words, so its
// functions are that script's globals. It fills the page's header, makes the boxes the
// developer ticks as he checks the page, keeps what is ticked in the browser, shows the
// count in the bar at the bottom, invites him to approve once nothing blocks it, tells the
// stylesheet how high that bar is, keeps what he chooses in the page's settings, and gives
// every text in the language he picked there (the texts are in pageTexts.mjs and in the
// page's ownTexts.mjs, both pasted before this file).
// The page has the elements "screen-name", "approval", "fingerprint", "settings-button",
// "page-settings", "feedback", "feedback-count", "feedback-lines", "feedback-copy",
// "feedback-reset" and "feedback-text".

/** @param {string} id */
const getSharedElement = (id) =>
  /** @type {HTMLElement} */ (document.getElementById(id))

// What the browser keeps for the developer from one visit to the next. Some browsers keep
// nothing for a page opened from a file: the page then works without it.

/**
 * @param {string} storageKey
 * @returns {string | null} null when nothing is kept under that name
 */
function readKept(storageKey) {
  try {
    return localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

/**
 * A list the page keeps: what the developer ticked, his corrections.
 * @template Item
 * @param {string} storageKey
 * @returns {Item[]} none when nothing is kept, or when what is kept is not a list
 */
function readKeptList(storageKey) {
  try {
    const kept = JSON.parse(readKept(storageKey) ?? "[]")
    return Array.isArray(kept) ? kept : []
  } catch {
    return []
  }
}

/**
 * @param {string} storageKey
 * @param {string | null} value null forgets what is kept under that name
 * @returns {boolean} false when the browser keeps nothing for this page
 */
function keep(storageKey, value) {
  try {
    if (value === null) localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, value)
    return true
  } catch {
    return false
  }
}

// The language of the page: the one the developer picked in the settings, kept by the
// browser for every page of the same kind. Until he picks one, the language of the repo,
// which render.mjs wrote on the page's <html>.
const LANGUAGE_STORAGE_KEY = "page-language"
const keptLanguage = readKept(LANGUAGE_STORAGE_KEY)
const pageLanguage = /** @type {PageLanguage} */ (
  isPageLanguage(keptLanguage) ? keptLanguage : document.documentElement.lang
)
document.documentElement.lang = pageLanguage

/**
 * A text in the page's language, by its name in the dictionaries ("approval.given"),
 * with what each name in braces becomes.
 */
export const translate = buildTranslate(pageLanguage, OWN_PAGE_TEXTS)

/**
 * A text render.mjs wrote into the page's data once per language, in the page's one.
 * @param {Record<PageLanguage, string>} textInEveryLanguage { fr: "2 écrans", en: "2 screens" }
 */
export const inPageLanguage = (textInEveryLanguage) =>
  textInEveryLanguage[pageLanguage]

// The texts page.html leaves empty: an element names its text in `data-text`, and the
// text of its `aria-label` in `data-text-aria-label`.
for (const element of document.querySelectorAll("[data-text]"))
  element.textContent = translate(element.getAttribute("data-text") ?? "")
for (const element of document.querySelectorAll("[data-text-aria-label]")) {
  const key = element.getAttribute("data-text-aria-label") ?? ""
  element.setAttribute("aria-label", translate(key))
}

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
    ? translate("approval.given", { date: approvalDate })
    : translate("approval.missing")
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

// The page's settings: what the developer chooses there is his way of reading these pages,
// not a fact about one mock-up. The browser keeps each choice for every page of the same
// kind.
const KEPT_WHEN_A_SETTING_IS_ON = "on"

/**
 * The setting that picks the page's language. Every text is written when the page loads:
 * the page is loaded again in the language picked. What the developer ticked and
 * corrected is kept by the browser, so nothing is lost.
 */
function createLanguageChoice() {
  const select = document.createElement("select")
  for (const [language, name] of Object.entries(PAGE_LANGUAGES))
    select.append(new Option(name, language, false, language === pageLanguage))
  select.addEventListener("change", () => {
    // A browser that keeps nothing would load the page again in the same language.
    if (keep(LANGUAGE_STORAGE_KEY, select.value)) location.reload()
  })
  const choice = document.createElement("label")
  choice.className = "page-choice"
  choice.append(translate("settings.language"), select)
  return choice
}

// The cog of the header shows the settings over the page, and they stay there while the
// developer ticks their boxes: the cog, Escape or a click anywhere else hides them.
const settingsButton = getSharedElement("settings-button")
const settingsPanel = getSharedElement("page-settings")
/** @param {boolean} areShown */
function showSettings(areShown) {
  settingsPanel.hidden = !areShown
  settingsButton.setAttribute("aria-expanded", String(areShown))
}
settingsPanel.append(createLanguageChoice())
settingsButton.addEventListener("click", () =>
  showSettings(settingsPanel.hidden),
)
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") showSettings(false)
})
document.addEventListener("click", (event) => {
  const isOnTheSettings =
    event.target instanceof Node &&
    (settingsPanel.contains(event.target) ||
      settingsButton.contains(event.target))
  if (!isOnTheSettings) showSettings(false)
})

/**
 * Wires a box of the page's settings: while it is ticked, the page's body carries a class
 * named like the box, which the page's styles react to.
 * @param {string} switchId the id of the box: "differences-only"
 * @param {() => void} [onChange] called once the developer ticked or unticked the box,
 *   for what the page's styles cannot do alone (a count to work out again)
 */
export function wireSettingSwitch(switchId, onChange) {
  const storageKey = `page-setting ${switchId}`
  const box = /** @type {HTMLInputElement} */ (getSharedElement(switchId))
  const showSetting = () =>
    document.body.classList.toggle(switchId, box.checked)
  box.checked = readKept(storageKey) === KEPT_WHEN_A_SETTING_IS_ON
  showSetting()
  box.addEventListener("change", () => {
    keep(storageKey, box.checked ? KEPT_WHEN_A_SETTING_IS_ON : null)
    showSetting()
    onChange?.()
  })
}

const COPIED_SHOWN_FOR_MILLISECONDS = 1500

// The corrections, in the bar at the bottom: both pages list them, count them, copy their
// text and keep them in the browser the same way. A page says what its corrections are and
// how each one reads.

/**
 * A correction of either page, as the bar needs it.
 * @typedef {{ target: string }} ShownCorrection `target`: what it applies to, "7b",
 *   "Select · zone A"
 */

/**
 * Copies the text of the corrections for the developer to paste, and says so on the
 * button for a moment. When the browser refuses the clipboard, the text is shown selected
 * under the list, for a copy by hand.
 * @param {string} text
 */
export async function copyCorrectionsText(text) {
  const button = getSharedElement("feedback-copy")
  try {
    await navigator.clipboard.writeText(text)
    button.textContent = translate("corrections.copied")
    setTimeout(
      () => (button.textContent = translate(button.dataset.text ?? "")),
      COPIED_SHOWN_FOR_MILLISECONDS,
    )
  } catch {
    const textToCopyByHand = /** @type {HTMLTextAreaElement} */ (
      getSharedElement("feedback-text")
    )
    textToCopyByHand.value = text
    textToCopyByHand.hidden = false
    textToCopyByHand.select()
  }
}

/**
 * The corrections the browser kept for this page.
 * @template {ShownCorrection} Correction
 * @param {string} storageKey names the page and the content it was drawn from
 * @returns {Correction[]}
 */
export const readKeptCorrections = (storageKey) => readKeptList(storageKey)

/**
 * Lists the corrections in the bar with their count, shows the buttons that copy and clear
 * them while there is one, and keeps them in the browser.
 * @template {ShownCorrection} Correction
 * @param {object} shown
 * @param {Correction[]} shown.corrections in the order to list them
 * @param {(correction: Correction) => string[]} shown.listFields what a correction
 *   changes, each field named: ["verdict : À créer", "note : une ligne par jour"]
 * @param {(target: string) => void} shown.openCorrection opens the form on a correction
 *   again
 * @param {string} shown.storageKey
 */
export function showCorrectionsInTheBar({
  corrections,
  listFields,
  openCorrection,
  storageKey,
}) {
  getSharedElement("feedback-lines").replaceChildren(
    ...corrections.map((correction) => {
      const line = document.createElement("button")
      line.type = "button"
      line.textContent = `${correction.target} — ${listFields(correction).join(" · ")}`
      line.title = translate("correction.reopen")
      line.addEventListener("click", () => openCorrection(correction.target))
      const item = document.createElement("li")
      item.append(line)
      return item
    }),
  )
  const count = corrections.length
  getSharedElement("feedback-count").textContent = count
    ? translate("corrections.count", { count })
    : translate("corrections.none")
  getSharedElement("feedback-text").hidden = true
  for (const id of ["feedback-copy", "feedback-reset"])
    getSharedElement(id).hidden = !count
  keep(storageKey, count ? JSON.stringify(corrections) : null)
}

/** Why a box cannot be ticked yet, written in place of its label. */
export const WHY_NOT_YET = {
  corrected: translate("review.notYet.corrected"),
  undecided: translate("review.notYet.undecided"),
}

/**
 * What a box is about, as the count names it for one and for several.
 * @typedef {(typeof REVIEW_SUBJECTS)[number]} ReviewSubject
 */
const REVIEW_SUBJECTS = /** @type {const} */ (["component", "screen"])

/**
 * What the boxes are about: "8 composants, 6 écrans".
 * @param {ReviewCheck[]} checks
 */
const countReviewSubjects = (checks) =>
  REVIEW_SUBJECTS.map((subject) => ({
    subject,
    count: checks.filter((check) => check.subject === subject).length,
  }))
    .filter(({ count }) => count > 0)
    .map(({ subject, count }) =>
      translate(`review.subject.${subject}`, { count }),
    )
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
  /** @type {string[]} */
  const saved = readKeptList(storageKey)
  for (const reviewHash of saved)
    if (hashesOnThePage.includes(reviewHash)) reviewedHashes.add(reviewHash)
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
    keep(reviewStorageKey, JSON.stringify([...reviewedHashes]))
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
  nextButton.textContent = translate("review.next")
  nextButton.addEventListener("click", showNextToReview)
  const approvalInvitation = document.createElement("p")
  approvalInvitation.className = "approval-invitation"
  approvalInvitation.textContent = translate("approval.invitation")
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
 * @param {number} page.stillToDecideCount how many open questions the approving script
 *   would refuse on, as it counts them. The corrections are known to the page only: the
 *   script cannot refuse on them
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
  count.textContent = translate("review.count", {
    reviewedCount,
    totalCount: checks.length,
    subjects: countReviewSubjects(checks),
  })
  approvalInvitation.hidden =
    isApproved || stillToDecideCount > 0 || correctionCount > 0
}
