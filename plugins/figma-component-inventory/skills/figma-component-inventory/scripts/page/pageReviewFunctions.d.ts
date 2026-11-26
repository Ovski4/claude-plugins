// render.mjs pastes page/pageReview.mjs of the inventory skill into the page before page.js,
// as a plain script: page.js calls its functions as globals.
type PageReview = typeof import("./pageReview.mjs")
type ReviewCheck = import("./pageReview.mjs").ReviewCheck
declare const showPageHeader: PageReview["showPageHeader"]
declare const isTypingInAField: PageReview["isTypingInAField"]
declare const copyWithConfirmation: PageReview["copyWithConfirmation"]
declare const wireSettingSwitch: PageReview["wireSettingSwitch"]
declare const WHY_NOT_YET: PageReview["WHY_NOT_YET"]
declare const restoreReview: PageReview["restoreReview"]
declare const isReviewed: PageReview["isReviewed"]
declare const fillReviewBox: PageReview["fillReviewBox"]
declare const createReviewBox: PageReview["createReviewBox"]
declare const pointAtReviewBox: PageReview["pointAtReviewBox"]
declare const showReviewProgress: PageReview["showReviewProgress"]
