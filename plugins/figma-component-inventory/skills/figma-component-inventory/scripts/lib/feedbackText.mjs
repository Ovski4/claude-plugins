// @ts-check
// The corrections the developer makes on inventory.html, and the text the page builds from
// them for him to paste into the chat. render.mjs pastes this file into the page as a plain
// script, without its "export" words: its functions use nothing but each other, and take
// the page's texts from the `translate` they are given.

/** @typedef {import("../page/pageTexts.mjs").Translate} Translate */

/**
 * One correction made on the page. Fields left as the inventory has them are null.
 * @typedef {object} PageCorrection
 * @property {string} target what it applies to: "7" for every use; "7b", or "7 · écran 2", for one outline
 * @property {string | null} verdict the verdict picked, by its key: "to-create", or
 *   "not-a-component" for an outline that is no React component of its own
 * @property {string | null} codeComponent the React component that should draw it: "OrderDayRow"
 * @property {string | null} answer the option picked for a question the inventory asks
 * @property {string | null} sameAs another outline that is the same component: "8"
 * @property {string | null} note anything else, in the developer's words
 */
/**
 * What the form holds when the developer changes a field: the text fields as typed, the
 * choices as picked (null when none is).
 * @typedef {object} CorrectionForm
 * @property {string | null} verdict
 * @property {string} codeComponent
 * @property {string | null} answer
 * @property {string} sameAs
 * @property {string} note
 */

/**
 * The correction the form holds for a target: only the fields that differ from what the
 * inventory says. null when nothing differs.
 * @param {string} target
 * @param {{ verdict: string | null, codeComponent: string | null }} judgement what the inventory says of the target
 * @param {CorrectionForm} form
 * @returns {PageCorrection | null}
 */
export function buildCorrection(target, judgement, form) {
  const codeComponent = form.codeComponent.trim() || null
  const changes = {
    verdict: form.verdict === judgement.verdict ? null : form.verdict,
    codeComponent:
      codeComponent === judgement.codeComponent ? null : codeComponent,
    answer: form.answer,
    sameAs: form.sameAs.trim() || null,
    note: form.note.trim() || null,
  }
  return Object.values(changes).some((value) => value !== null)
    ? { target, ...changes }
    : null
}

/**
 * Sorted by outline, as the page lists them and the text gives them: "7", "7b", "11".
 * @param {PageCorrection[]} corrections
 */
export function sortCorrections(corrections) {
  return corrections.toSorted((a, b) =>
    a.target.localeCompare(b.target, undefined, { numeric: true }),
  )
}

/**
 * What a correction changes, each field named: ["verdict : À créer", "composant React :
 * OrderDayRow", "note : une ligne par jour"]. The name tells a component from a note.
 * @param {PageCorrection} correction
 * @param {Record<string, string>} verdictLabels each verdict's key → its label on the page
 * @param {Translate} translate gives the page's texts in its language
 */
export function listCorrectionFields(
  { verdict, codeComponent, answer, sameAs, note },
  verdictLabels,
  translate,
) {
  return [
    ["verdict", verdict && verdictLabels[verdict]],
    ["component", codeComponent],
    ["answer", answer],
    ["sameAs", sameAs],
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
 * The text to paste into the chat: a title, then per correction its outline and one
 * indented line per field, sorted by outline. "" when there is no correction.
 * @param {string} inventoryTitle
 * @param {PageCorrection[]} corrections
 * @param {Record<string, string>} verdictLabels each verdict's key → its label on the page
 * @param {Translate} translate gives the page's texts in its language
 */
export function buildFeedbackText(
  inventoryTitle,
  corrections,
  verdictLabels,
  translate,
) {
  if (!corrections.length) return ""
  return [
    translate("corrections.title", { subject: inventoryTitle }),
    ...sortCorrections(corrections).map((correction) =>
      [
        translate("corrections.target", { target: correction.target }),
        ...listCorrectionFields(correction, verdictLabels, translate),
      ].join("\n  "),
    ),
  ].join("\n")
}
