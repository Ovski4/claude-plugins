// @ts-check
// The text inventory.html builds from the corrections the developer makes on the page, for
// him to paste into the chat. render.mjs pastes the source of these two functions into the
// page, so they use nothing but each other.

/**
 * One correction made on the page. Fields left as the inventory has them are null.
 * @typedef {object} PageCorrection
 * @property {string} target what it applies to: "7" for every use; "7b", or "7 · écran 2", for one outline
 * @property {string | null} verdictLabel the verdict picked, as the page names it: "À créer",
 *   or "Pas un composant" for an outline that is no React component of its own
 * @property {string | null} codeComponent the React component that should draw it: "OrderDayRow"
 * @property {string | null} answer the option picked for a question the inventory asks
 * @property {string | null} sameAs another outline that is the same component: "8"
 * @property {string | null} note anything else, in the developer's words
 */

/**
 * What a correction changes, each field named: ["verdict : À créer", "composant React :
 * OrderDayRow", "note : une ligne par jour"]. The name tells a component from a note.
 * @param {PageCorrection} correction
 */
export function listCorrectionFields({
  verdictLabel,
  codeComponent,
  answer,
  sameAs,
  note,
}) {
  return [
    ["verdict", verdictLabel],
    ["composant React", codeComponent],
    ["réponse", answer],
    ["même composant que", sameAs],
    ["note", note],
  ]
    .filter(([, value]) => value)
    .map(([fieldName, value]) => `${fieldName} : ${value}`)
}

/**
 * The text to paste into the chat: a title, then per correction its outline and one
 * indented line per field, sorted by outline. "" when there is no correction.
 * @param {string} inventoryTitle
 * @param {PageCorrection[]} corrections
 */
export function buildFeedbackText(inventoryTitle, corrections) {
  if (!corrections.length) return ""
  return [
    `Corrections de l'inventaire « ${inventoryTitle} » :`,
    ...corrections
      .toSorted((a, b) =>
        a.target.localeCompare(b.target, undefined, { numeric: true }),
      )
      .map((correction) =>
        [`${correction.target} :`, ...listCorrectionFields(correction)].join(
          "\n  ",
        ),
      ),
  ].join("\n")
}
