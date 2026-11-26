import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCorrection,
  buildFeedbackText,
} from "../scripts/lib/feedbackText.mjs"
import { OWN_PAGE_TEXTS } from "../scripts/page/ownTexts.mjs"
import { buildTranslate } from "../scripts/page/pageTexts.mjs"

const VERDICT_LABELS = {
  "to-create": "À créer",
  "not-a-component": "Pas un composant",
}

/** @param {"fr" | "en"} language the page's `translate`, for a page read in that language */
const translateIn = (language) => buildTranslate(language, OWN_PAGE_TEXTS)

test("a correction keeps only what differs from the inventory", () => {
  const judgement = { verdict: "to-adapt", codeComponent: "Select" }
  const untouchedForm = {
    verdict: "to-adapt",
    codeComponent: "Select",
    answer: null,
    sameAs: "",
    note: "",
  }

  assert.equal(buildCorrection("8", judgement, untouchedForm), null)
  assert.equal(
    buildCorrection("8", judgement, { ...untouchedForm, note: "   " }),
    null,
  )
  assert.deepEqual(
    buildCorrection("8", judgement, {
      ...untouchedForm,
      verdict: "to-create",
      codeComponent: " OrderDayRow ",
    }),
    {
      target: "8",
      verdict: "to-create",
      codeComponent: "OrderDayRow",
      answer: null,
      sameAs: null,
      note: null,
    },
  )
})

test("each correction names the fields it changes, in outline order", () => {
  const empty = {
    verdict: null,
    codeComponent: null,
    answer: null,
    sameAs: null,
    note: null,
  }
  const corrections = [
    { ...empty, target: "11", sameAs: "8" },
    { ...empty, target: "7b", verdict: "not-a-component" },
    { ...empty, target: "9", answer: "Select" },
    {
      ...empty,
      target: "7",
      verdict: "to-create",
      codeComponent: "OrderDayRow",
      note: "une ligne par jour",
    },
    { ...empty, target: "12", note: "le libellé vient de la ligne" },
  ]

  assert.equal(
    buildFeedbackText(
      "Éditeur",
      corrections,
      VERDICT_LABELS,
      translateIn("fr"),
    ),
    [
      "Corrections de l'inventaire « Éditeur » :",
      "7 :",
      "  verdict : À créer",
      "  composant React : OrderDayRow",
      "  note : une ligne par jour",
      "7b :",
      "  verdict : Pas un composant",
      "9 :",
      "  réponse : Select",
      "11 :",
      "  même composant que : 8",
      "12 :",
      "  note : le libellé vient de la ligne",
    ].join("\n"),
  )
  assert.equal(
    buildFeedbackText(
      "Editor",
      corrections.slice(0, 2),
      { "not-a-component": "Not a component" },
      translateIn("en"),
    ),
    [
      "Corrections of the inventory “Editor”:",
      "7b:",
      "  verdict: Not a component",
      "11:",
      "  same component as: 8",
    ].join("\n"),
  )
  assert.equal(
    buildFeedbackText("Éditeur", [], VERDICT_LABELS, translateIn("fr")),
    "",
  )
})
