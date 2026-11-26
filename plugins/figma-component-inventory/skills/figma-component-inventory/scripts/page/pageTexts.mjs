// @ts-check
// The texts inventory.html and specs.html show alike, in each language the developer can
// read the pages in. render.mjs pastes this file into the page before pageReview.mjs, as a
// plain script without its "export" words: pageReview.mjs picks the language and gives the
// texts through `translate`, the shared ones and those of the page's ownTexts.mjs. The
// scripts that write a page's data or a file take their words here too. Nothing here touches the page, so that the tests can load it.
// A text in braces is replaced when the text is shown: "{date}".

/** The languages of the pages, each under the name its own speakers give it. */
export const PAGE_LANGUAGES = { fr: "Français", en: "English" }
/** @typedef {keyof typeof PAGE_LANGUAGES} PageLanguage */

/**
 * The language of a page whose developer has not picked one.
 * @type {PageLanguage}
 */
export const DEFAULT_PAGE_LANGUAGE = "fr"

/** @type {Record<PageLanguage, Record<string, string>>} */
export const SHARED_PAGE_TEXTS = {
  fr: {
    "header.builtOn": "Sur quoi la page est construite",
    "header.mockupAndCommit": "maquette modifiée le {date} · commit {commit}",
    "inventory.sharedNameOfScreens": "{sharedStart} ({count} écrans)",
    "inventory.screensOfOneDesign": "{count} écrans d'un même design",
    "screens.one": "écran {numbers}",
    "screens.several": "écrans {numbers}",
    "screen.link": "Écran {number} — {name}",
    "verdict.reused": "Réutilisé",
    "verdict.to-adapt": "À adapter",
    "verdict.to-create": "À créer",
    "verdict.out-of-scope": "Hors périmètre",
    "verdict.to-decide": "À trancher",
    "verdict.not-a-component": "Pas un composant",
    "settings.title": "Paramètres",
    "settings.language": "Langue",
    "approval.given": "Validé par le développeur le {date}",
    "approval.missing": "Brouillon — pas encore validé par le développeur",
    "approval.invitation":
      "Plus rien à trancher ni à corriger. Pour valider, le dire dans la conversation : « je valide ».",
    "review.count": "{reviewedCount} / {totalCount} vérifiés ({subjects})",
    "review.next": "Suivant à vérifier →",
    "review.notYet.corrected":
      "Corrigé : à vérifier une fois la page reconstruite",
    "review.notYet.undecided": "À trancher d'abord",
    "review.subject.component.one": "{count} composant",
    "review.subject.component.several": "{count} composants",
    "review.subject.screen.one": "{count} écran",
    "review.subject.screen.several": "{count} écrans",
    "correction.note": "Note",
    "correction.clear": "Annuler cette correction",
    "corrections.copy": "Copier les corrections",
    "corrections.copied": "Copié",
    "corrections.reset": "Tout effacer",
    "corrections.confirmReset": "Effacer toutes les corrections ?",
    "corrections.count.one": "{count} correction à coller dans la conversation",
    "corrections.count.several":
      "{count} corrections à coller dans la conversation",
    "correction.reopen": "Rouvrir cette correction",
    "corrections.target": "{target} :",
    "corrections.field": "{name} : {value}",
    "corrections.field.answer": "réponse",
    "corrections.field.note": "note",
    "panel.developerDecision": "Décidé par le développeur : {decision}",
  },
  en: {
    "header.builtOn": "What the page is built on",
    "header.mockupAndCommit": "mock-up changed on {date} · commit {commit}",
    "inventory.sharedNameOfScreens": "{sharedStart} ({count} screens)",
    "inventory.screensOfOneDesign": "{count} screens of one design",
    "screens.one": "screen {numbers}",
    "screens.several": "screens {numbers}",
    "screen.link": "Screen {number} — {name}",
    "verdict.reused": "Reused",
    "verdict.to-adapt": "To adapt",
    "verdict.to-create": "To create",
    "verdict.out-of-scope": "Out of scope",
    "verdict.to-decide": "To decide",
    "verdict.not-a-component": "Not a component",
    "settings.title": "Settings",
    "settings.language": "Language",
    "approval.given": "Approved by the developer on {date}",
    "approval.missing": "Draft — not approved by the developer yet",
    "approval.invitation":
      "Nothing left to decide or to correct. To approve, say so in the conversation: “I approve”.",
    "review.count": "{reviewedCount} / {totalCount} checked ({subjects})",
    "review.next": "Next to check →",
    "review.notYet.corrected": "Corrected: to check once the page is rebuilt",
    "review.notYet.undecided": "To decide first",
    "review.subject.component.one": "{count} component",
    "review.subject.component.several": "{count} components",
    "review.subject.screen.one": "{count} screen",
    "review.subject.screen.several": "{count} screens",
    "correction.note": "Note",
    "correction.clear": "Cancel this correction",
    "corrections.copy": "Copy the corrections",
    "corrections.copied": "Copied",
    "corrections.reset": "Clear all",
    "corrections.confirmReset": "Clear all the corrections?",
    "corrections.count.one": "{count} correction to paste in the conversation",
    "corrections.count.several":
      "{count} corrections to paste in the conversation",
    "correction.reopen": "Reopen this correction",
    "corrections.target": "{target}:",
    "corrections.field": "{name}: {value}",
    "corrections.field.answer": "answer",
    "corrections.field.note": "note",
    "panel.developerDecision": "Decided by the developer: {decision}",
  },
}

/**
 * Gives a text of the page in its language, its braces replaced: what `translate` of
 * pageReview.mjs does in the page.
 * @typedef {(key: string, values?: Record<string, string | number>) => string} Translate
 */

/**
 * A text with its braces replaced: "Validé par le développeur le {date}" and
 * { date: "2026-11-23" } give "Validé par le développeur le 2026-11-23".
 * @param {string} text
 * @param {Record<string, string | number>} [values] what each name in braces becomes
 */
export const fillText = (text, values = {}) =>
  text.replace(/\{(\w+)\}/g, (inBraces, name) =>
    name in values ? String(values[name]) : inBraces,
  )

/**
 * The `translate` of a page read in one language: gives a text by its name in the
 * dictionaries, its braces replaced, and the name itself when no dictionary has it.
 * A text that counts something has two forms, "<name>.one" and "<name>.several": asked by
 * its name with a `count`, it comes in the form that language uses for that count
 * ("1 correction", "2 corrections"; "0 correction" in French, "0 corrections" in English).
 * @param {PageLanguage} language
 * @param {Record<PageLanguage, Record<string, string>>} ownTexts the texts only that page shows
 * @returns {Translate}
 */
export function buildTranslate(language, ownTexts) {
  const textsOfThePage = {
    ...SHARED_PAGE_TEXTS[language],
    ...ownTexts[language],
  }
  const pluralRules = new Intl.PluralRules(language)
  return (key, values = {}) => {
    const formForTheCount =
      pluralRules.select(Number(values.count)) === "one" ? "one" : "several"
    const text =
      textsOfThePage[key] ?? textsOfThePage[`${key}.${formForTheCount}`]
    return fillText(text ?? key, values)
  }
}
