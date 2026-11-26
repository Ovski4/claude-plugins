// @ts-check
// The languages of what the scripts write: a page is read in the language its developer
// picks, so a script writes each of the page's texts once per language; the files the next
// steps read are written in one language.
import { buildTranslate, PAGE_LANGUAGES } from "../page/pageTexts.mjs"

/** @typedef {import("../page/pageTexts.mjs").PageLanguage} PageLanguage */
/** @typedef {import("../page/pageTexts.mjs").Translate} Translate */
/**
 * A text of a page, written once per language: { fr: "2 écrans", en: "2 screens" }. The
 * page shows the one of its language.
 * @typedef {Record<PageLanguage, string>} TextInEveryLanguage
 */

const NO_OWN_TEXTS = { fr: {}, en: {} }

/**
 * The language of inventory.md, specs.md and index.md.
 * @type {PageLanguage}
 */
export const WRITTEN_FILES_LANGUAGE = "fr"

/** The shared texts in the language of the written files, for what has no page of its own. */
export const translateForWrittenFiles = buildTranslate(
  WRITTEN_FILES_LANGUAGE,
  NO_OWN_TEXTS,
)

/**
 * The words of the names the corrections give to what they apply to ("7 · écran 2"). A
 * name is the same whatever the language the page is read in: the browser keeps the
 * corrections under it, and the model reads it back in the text the developer pastes.
 */
export const translateForCorrectionTargets = buildTranslate("fr", NO_OWN_TEXTS)

/**
 * Gives what writes a text of one page in every language.
 * @param {Record<PageLanguage, Record<string, string>>} ownTexts the texts only that page shows
 * @returns {(write: (translate: Translate) => string) => TextInEveryLanguage} `write`
 *   composes the text with the `translate` of one language
 */
export function buildWriterInEveryLanguage(ownTexts) {
  const translators = Object.keys(PAGE_LANGUAGES).map((language) => ({
    language,
    translate: buildTranslate(/** @type {PageLanguage} */ (language), ownTexts),
  }))
  return (write) =>
    /** @type {TextInEveryLanguage} */ (
      Object.fromEntries(
        translators.map(({ language, translate }) => [
          language,
          write(translate),
        ]),
      )
    )
}

// The briefs are written in English for the model: a language is named there in English.
/** @type {Record<PageLanguage, string>} */
const LANGUAGE_NAMES_IN_ENGLISH = { fr: "French", en: "English" }

/**
 * The line of a brief that tells the model which language to write in: what it writes in
 * the file it fills is read by the repo's team, on the page and in the tickets.
 * @param {PageLanguage} projectLanguage the `language` of the repo's settings file
 */
export const tellLanguageToWriteIn = (projectLanguage) =>
  `Language of this repo: ${LANGUAGE_NAMES_IN_ENGLISH[projectLanguage]}. Write in it everything the developer will read: notes, questions and their options, names of zones, his decisions.`
