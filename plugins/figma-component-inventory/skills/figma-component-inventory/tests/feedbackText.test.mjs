import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCorrection,
  buildFeedbackText,
} from "../scripts/lib/feedbackText.mjs"

const VERDICT_LABELS = {
  "to-create": "À créer",
  "not-a-component": "Pas un composant",
}

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
  const text = buildFeedbackText(
    "Éditeur",
    [
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
    ],
    VERDICT_LABELS,
  )

  assert.equal(
    text,
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
  assert.equal(buildFeedbackText("Éditeur", [], VERDICT_LABELS), "")
})
