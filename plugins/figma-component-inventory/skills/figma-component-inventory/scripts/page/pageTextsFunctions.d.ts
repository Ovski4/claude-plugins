// render.mjs pastes page/pageTexts.mjs into the page before pageReview.mjs, as a plain
// script: pageReview.mjs reads its texts as globals.
type PageTexts = typeof import("./pageTexts.mjs")
type PageLanguage = import("./pageTexts.mjs").PageLanguage
declare const PAGE_LANGUAGES: PageTexts["PAGE_LANGUAGES"]
declare const SHARED_PAGE_TEXTS: PageTexts["SHARED_PAGE_TEXTS"]
declare const fillText: PageTexts["fillText"]
declare const buildTranslate: PageTexts["buildTranslate"]
