// render.mjs pastes lib/feedbackText.mjs's functions into inventory.html before page.js, as a
// plain script: page.js calls them as globals.
declare const buildFeedbackText: typeof import("../lib/feedbackText.mjs").buildFeedbackText
declare const listCorrectionFields: typeof import("../lib/feedbackText.mjs").listCorrectionFields
