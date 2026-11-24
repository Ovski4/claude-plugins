// render.mjs pastes lib/feedbackText.mjs into inventory.html before page.js, as a plain
// script: page.js calls its functions as globals.
type FeedbackText = typeof import("../lib/feedbackText.mjs")
declare const buildCorrection: FeedbackText["buildCorrection"]
declare const sortCorrections: FeedbackText["sortCorrections"]
declare const listCorrectionFields: FeedbackText["listCorrectionFields"]
declare const buildFeedbackText: FeedbackText["buildFeedbackText"]
