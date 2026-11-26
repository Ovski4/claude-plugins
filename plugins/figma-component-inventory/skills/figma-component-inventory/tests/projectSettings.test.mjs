// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  isComponentFile,
  parseProjectSettings,
} from "../scripts/lib/projectSettings.mjs"

test("the settings file gives the repo's folders, and says what is wrong in it", () => {
  assert.deepEqual(
    parseProjectSettings(
      '{ "componentsFolder": "src/components", "componentFileExtensions": [".tsx", ".vue"] }',
    ),
    {
      componentsFolder: "src/components",
      componentFileExtensions: [".tsx", ".vue"],
      designSystemFolder: null,
      figmaToCodeMap: null,
      language: "en",
    },
  )
  assert.equal(
    parseProjectSettings(
      '{ "componentsFolder": "src", "componentFileExtensions": [".tsx"], "language": "fr" }',
    ).language,
    "fr",
  )
  assert.throws(
    () =>
      parseProjectSettings(
        '{ "componentFileExtensions": ["tsx"], "figmaToCodeMap": 3, "language": "de" }',
      ),
    {
      message:
        '.claude/figma-component-inventory.json: "componentsFolder" must be a folder path; "componentFileExtensions" must list at least one extension like ".tsx"; "figmaToCodeMap" must be a file path or null; "language" must be one of fr, en',
    },
  )

  // "constructor" is a name every object has: it is no language for all that.
  assert.throws(
    () =>
      parseProjectSettings(
        '{ "componentsFolder": "src", "componentFileExtensions": [".tsx"], "language": "constructor" }',
      ),
    {
      message:
        '.claude/figma-component-inventory.json: "language" must be one of fr, en',
    },
  )

  assert.equal(isComponentFile("src/ui/button.tsx", [".tsx", ".vue"]), true)
  assert.equal(isComponentFile("src/ui/Card.vue", [".tsx", ".vue"]), true)
  assert.equal(isComponentFile("src/ui/button.test.tsx", [".tsx"]), false)
  assert.equal(isComponentFile("src/ui/button.stories.tsx", [".tsx"]), false)
  assert.equal(isComponentFile("src/ui/button.module.css", [".tsx"]), false)
})
