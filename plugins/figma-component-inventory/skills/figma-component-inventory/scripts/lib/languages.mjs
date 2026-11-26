// @ts-check
// The languages of what the scripts write: a page is read in the language its developer
// picks, so a script writes each of the page's texts once per language; the files the next
// steps read are written in one language.
import { PAGE_LANGUAGES } from "../page/pageTexts.mjs"

/** @typedef {import("../page/pageTexts.mjs").PageLanguage} PageLanguage */
/**
 * A text of a page, written once per language: { fr: "2 écrans", en: "2 screens" }. The
 * page shows the one of its language.
 * @typedef {Record<PageLanguage, string>} TextInEveryLanguage
 */

/**
 * The language of inventory.md, specs.md and index.md, and of the names the corrections
 * give to what they apply to ("7 · écran 2").
 * @type {PageLanguage}
 */
export const WRITTEN_FILES_LANGUAGE = "fr"

/**
 * @param {(language: PageLanguage) => string} writeIn writes the text in one language
 * @returns {TextInEveryLanguage}
 */
export const writeInEveryLanguage = (writeIn) =>
  /** @type {TextInEveryLanguage} */ (
    Object.fromEntries(
      Object.keys(PAGE_LANGUAGES).map((language) => [
        language,
        writeIn(/** @type {PageLanguage} */ (language)),
      ]),
    )
  )
