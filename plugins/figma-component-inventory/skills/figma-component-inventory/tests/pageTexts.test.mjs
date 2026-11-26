// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  DEFAULT_PAGE_LANGUAGE,
  fillText,
  PAGE_LANGUAGES,
  SHARED_PAGE_TEXTS,
} from "../scripts/page/pageTexts.mjs"
import { OWN_PAGE_TEXTS as INVENTORY_PAGE_TEXTS } from "../scripts/page/ownTexts.mjs"
import { OWN_PAGE_TEXTS as SPECS_PAGE_TEXTS } from "../../figma-component-specs/scripts/page/ownTexts.mjs"
import { ZONE_KIND_KEYS } from "../../figma-component-specs/scripts/lib/componentSpecs.mjs"
import { NOT_A_COMPONENT_KEY, VERDICT_KEYS } from "../scripts/lib/verdicts.mjs"

/** @param {string} text the names in braces of a text, sorted: ["date"] */
const listNamesInBraces = (text) =>
  [...text.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).toSorted()

test("every language has every text, with the same names in braces", () => {
  assert.deepEqual(Object.keys(PAGE_LANGUAGES), ["fr", "en"])
  assert.equal(DEFAULT_PAGE_LANGUAGE, "fr")
  for (const { fr, en } of [
    SHARED_PAGE_TEXTS,
    INVENTORY_PAGE_TEXTS,
    SPECS_PAGE_TEXTS,
  ]) {
    assert.deepEqual(Object.keys(en), Object.keys(fr))
    for (const [key, frenchText] of Object.entries(fr)) {
      assert.deepEqual(
        listNamesInBraces(en[key]),
        listNamesInBraces(frenchText),
        key,
      )
      assert.notEqual(en[key], "", key)
    }
  }
})

test("a page's own texts take no name of the shared ones", () => {
  const sharedKeys = Object.keys(SHARED_PAGE_TEXTS.fr)
  for (const ownTexts of [INVENTORY_PAGE_TEXTS, SPECS_PAGE_TEXTS]) {
    assert.deepEqual(
      Object.keys(ownTexts.fr).filter((key) => sharedKeys.includes(key)),
      [],
    )
  }
})

test("every verdict and every kind of zone has its name in the dictionaries", () => {
  for (const key of [...VERDICT_KEYS, NOT_A_COMPONENT_KEY])
    assert.ok(SHARED_PAGE_TEXTS.fr[`verdict.${key}`], key)
  for (const key of ZONE_KIND_KEYS)
    assert.ok(SPECS_PAGE_TEXTS.fr[`zoneKind.${key}`], key)
  for (const key of ["to-add", "to-modify"])
    assert.ok(SPECS_PAGE_TEXTS.fr[`propChange.${key}`], key)
})

test("a text's braces are replaced by the values given, and left when none is", () => {
  assert.equal(
    fillText("Validé par le développeur le {date}", { date: "2026-11-23" }),
    "Validé par le développeur le 2026-11-23",
  )
  assert.equal(
    fillText("{reviewedCount} / {totalCount} vérifiés", {
      reviewedCount: 0,
      totalCount: 21,
    }),
    "0 / 21 vérifiés",
  )
  assert.equal(fillText("Suivant à vérifier →"), "Suivant à vérifier →")
  assert.equal(fillText("le {date}", {}), "le {date}")
})
