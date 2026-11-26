// render.mjs pastes page/ownTexts.mjs into the page before page.js, as a plain script:
// page.js reads its texts as a global.
declare const OWN_PAGE_TEXTS: (typeof import("./ownTexts.mjs"))["OWN_PAGE_TEXTS"]
