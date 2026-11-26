// render.mjs pastes page/pageReview.mjs of the inventory skill into the page before page.js,
// as a plain script: page.js calls its functions as globals.
type PageReview =
  typeof import("../../../figma-component-inventory/scripts/page/pageReview.mjs")
type ReviewCheck =
  import("../../../figma-component-inventory/scripts/page/pageReview.mjs").ReviewCheck
declare const showPageHeader: PageReview["showPageHeader"]
declare const translate: PageReview["translate"]
declare const inPageLanguage: PageReview["inPageLanguage"]
declare const isTypingInAField: PageReview["isTypingInAField"]
declare const copyCorrectionsText: PageReview["copyCorrectionsText"]
declare const readKeptCorrections: PageReview["readKeptCorrections"]
declare const showCorrectionsInTheBar: PageReview["showCorrectionsInTheBar"]
declare const WHY_NOT_YET: PageReview["WHY_NOT_YET"]
declare const restoreReview: PageReview["restoreReview"]
declare const isReviewed: PageReview["isReviewed"]
declare const fillReviewBox: PageReview["fillReviewBox"]
declare const createReviewBox: PageReview["createReviewBox"]
declare const pointAtReviewBox: PageReview["pointAtReviewBox"]
declare const showReviewProgress: PageReview["showReviewProgress"]
