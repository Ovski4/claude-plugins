// @ts-check
// The corrections the developer makes on specs.html, and the text the page builds from
// them for him to paste into the chat. render.mjs pastes this file into the page as a plain
// script, without its "export" words: its functions use nothing but each other, and take
// the page's texts from the `translate` they are given.

/** @typedef {import("../../../figma-component-inventory/scripts/page/pageTexts.mjs").Translate} Translate */

/**
 * One correction made on the page.
 * @typedef {object} SpecCorrection
 * @property {string} target what it applies to: "Select" for the component, "Select · zone A" for one zone
 * @property {string | null} answer the option picked for the question a zone asks
 * @property {string | null} note anything else, in the developer's words
 */

/**
 * @param {string} codeComponent
 * @param {string} [zoneLetter] left out for the whole component
 */
export function nameCorrectionTarget(codeComponent, zoneLetter) {
  return zoneLetter ? `${codeComponent} · zone ${zoneLetter}` : codeComponent
}

/**
 * The correction the form holds for a target; null when the form is empty.
 * @param {string} target
 * @param {{ answer: string | null, note: string }} form the choice as picked, the note as typed
 * @returns {SpecCorrection | null}
 */
export function buildSpecCorrection(target, form) {
  const note = form.note.trim() || null
  return form.answer || note ? { target, answer: form.answer, note } : null
}

/**
 * What a correction says, each field named: ["réponse : …", "note : …"].
 * @param {SpecCorrection} correction
 * @param {Translate} translate gives the page's texts in its language
 */
export function listSpecCorrectionFields({ answer, note }, translate) {
  return [
    ["answer", answer],
    ["note", note],
  ]
    .filter(([, value]) => value)
    .map(([field, value]) =>
      translate("corrections.field", {
        name: translate(`corrections.field.${field}`),
        value: value ?? "",
      }),
    )
}

/**
 * In the page's order: a component, then its zones, then the next component.
 * @param {SpecCorrection[]} corrections
 * @param {string[]} targetsInPageOrder every target the page has
 */
export function sortSpecCorrections(corrections, targetsInPageOrder) {
  return corrections.toSorted(
    (a, b) =>
      targetsInPageOrder.indexOf(a.target) -
      targetsInPageOrder.indexOf(b.target),
  )
}

/**
 * The text to paste into the chat: a title, then per correction its target and one
 * indented line per field. "" when there is no correction.
 * @param {string} specsTitle
 * @param {SpecCorrection[]} corrections in the order to write them
 * @param {Translate} translate gives the page's texts in its language
 */
export function buildSpecsFeedbackText(specsTitle, corrections, translate) {
  if (!corrections.length) return ""
  return [
    translate("corrections.title", { subject: specsTitle }),
    ...corrections.map((correction) =>
      [
        translate("corrections.target", { target: correction.target }),
        ...listSpecCorrectionFields(correction, translate),
      ].join("\n  "),
    ),
  ].join("\n")
}
