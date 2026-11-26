// render.mjs pastes page/ownTexts.mjs into the page before pageReview.mjs, as a plain
// script: pageReview.mjs reads its texts as a global.
declare const OWN_PAGE_TEXTS: (typeof import("./ownTexts.mjs"))["OWN_PAGE_TEXTS"]
