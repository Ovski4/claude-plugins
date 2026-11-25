// render.mjs pastes lib/specsFeedbackText.mjs into specs.html before page.js, as a plain
// script: page.js calls its functions as globals.
type SpecsFeedbackText = typeof import("../lib/specsFeedbackText.mjs")
declare const nameCorrectionTarget: SpecsFeedbackText["nameCorrectionTarget"]
declare const buildSpecCorrection: SpecsFeedbackText["buildSpecCorrection"]
declare const listSpecCorrectionFields: SpecsFeedbackText["listSpecCorrectionFields"]
declare const sortSpecCorrections: SpecsFeedbackText["sortSpecCorrections"]
declare const buildSpecsFeedbackText: SpecsFeedbackText["buildSpecsFeedbackText"]
