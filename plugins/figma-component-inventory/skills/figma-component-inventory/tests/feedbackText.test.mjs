import assert from "node:assert/strict"
import test from "node:test"

import { buildFeedbackText } from "../scripts/lib/feedbackText.mjs"

test("each correction names the fields it changes, in outline order", () => {
  const empty = {
    verdictLabel: null,
    codeComponent: null,
    answer: null,
    sameAs: null,
    note: null,
  }
  const text = buildFeedbackText("Éditeur", [
    { ...empty, target: "11", sameAs: "8" },
    { ...empty, target: "7b", verdictLabel: "Pas un composant" },
    { ...empty, target: "9", answer: "Select" },
    {
      ...empty,
      target: "7",
      verdictLabel: "À créer",
      codeComponent: "OrderDayRow",
      note: "une ligne par jour",
    },
    { ...empty, target: "12", note: "le libellé vient de la ligne" },
  ])

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
  assert.equal(buildFeedbackText("Éditeur", []), "")
})
