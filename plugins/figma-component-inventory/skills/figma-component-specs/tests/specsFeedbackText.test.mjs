// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildSpecCorrection,
  buildSpecsFeedbackText,
  nameCorrectionTarget,
  sortSpecCorrections,
} from "../scripts/lib/specsFeedbackText.mjs"
import { OWN_PAGE_TEXTS } from "../scripts/page/ownTexts.mjs"
import { buildTranslate } from "../../figma-component-inventory/scripts/page/pageTexts.mjs"

/** @param {"fr" | "en"} language the page's `translate`, for a page read in that language */
const translateIn = (language) => buildTranslate(language, OWN_PAGE_TEXTS)

test("an empty form gives no correction, a filled one keeps the answer and the trimmed note", () => {
  assert.equal(
    buildSpecCorrection("Select", { answer: null, note: "  " }),
    null,
  )
  assert.deepEqual(
    buildSpecCorrection("Select · zone A", {
      answer: "Seulement en Continu.",
      note: " sans prop de plus ",
    }),
    {
      target: "Select · zone A",
      answer: "Seulement en Continu.",
      note: "sans prop de plus",
    },
  )
})

test("the text to paste lists the corrections in the page's order, one line per field", () => {
  const corrections = sortSpecCorrections(
    [
      {
        target: nameCorrectionTarget("OrderSettings", "C"),
        answer: "Seulement en Continu.",
        note: "sans prop de plus",
      },
      {
        target: nameCorrectionTarget("Select"),
        answer: null,
        note: "une prop size plutôt qu'un changement pour tous",
      },
    ],
    ["Select", "Select · zone A", "OrderSettings", "OrderSettings · zone C"],
  )

  assert.equal(
    buildSpecsFeedbackText("Editor — order", corrections, translateIn("fr")),
    `Corrections des specs « Editor — order » :
Select :
  note : une prop size plutôt qu'un changement pour tous
OrderSettings · zone C :
  réponse : Seulement en Continu.
  note : sans prop de plus`,
  )
  assert.equal(
    buildSpecsFeedbackText("Editor — order", corrections, translateIn("en")),
    `Corrections of the specs “Editor — order”:
Select:
  note: une prop size plutôt qu'un changement pour tous
OrderSettings · zone C:
  answer: Seulement en Continu.
  note: sans prop de plus`,
  )
  assert.equal(
    buildSpecsFeedbackText("Editor — order", [], translateIn("fr")),
    "",
  )
})
