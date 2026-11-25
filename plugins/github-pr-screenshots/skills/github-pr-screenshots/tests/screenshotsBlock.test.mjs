import assert from "node:assert/strict"
import test from "node:test"

import {
  buildScreenshotsBlock,
  placeScreenshotsInComment,
  placeScreenshotsInDescription,
} from "../scripts/lib/screenshotsBlock.mjs"

const TEMPLATE_PLACEHOLDER =
  "- <!-- SCREENSHOT PLACEHOLDER -->\n  ![screenshot](<!-- url -->)"

const SCREENSHOTS_BLOCK = buildScreenshotsBlock([
  {
    caption: "Editor, Continuous mode",
    imageUrl: "https://github.com/user-attachments/assets/aaa-111",
  },
  {
    caption: "Editor, Period mode",
    imageUrl: "https://github.com/user-attachments/assets/bbb-222",
  },
])

test("the block shows each caption above its image, in order, between the markers", () => {
  assert.equal(
    SCREENSHOTS_BLOCK,
    "<!-- screenshots -->\n\n" +
      "**Editor, Continuous mode**\n\n![Editor, Continuous mode](https://github.com/user-attachments/assets/aaa-111)\n\n" +
      "**Editor, Period mode**\n\n![Editor, Period mode](https://github.com/user-attachments/assets/bbb-222)\n\n" +
      "<!-- /screenshots -->",
  )
})

test("a description without marker gets a Screenshots section at the end", () => {
  assert.deepEqual(
    placeScreenshotsInDescription(
      "## Summary\n\nText.\n\n",
      SCREENSHOTS_BLOCK,
      null,
    ),
    {
      text: `## Summary\n\nText.\n\n## Screenshots\n\n${SCREENSHOTS_BLOCK}\n`,
      place: "end section",
    },
  )
})

test("a lone start marker is replaced where it stands", () => {
  assert.deepEqual(
    placeScreenshotsInDescription(
      "## Tests\n\n<!-- screenshots -->\n\n## Notes",
      SCREENSHOTS_BLOCK,
      null,
    ),
    {
      text: `## Tests\n\n${SCREENSHOTS_BLOCK}\n\n## Notes`,
      place: "start marker",
    },
  )
})

test("the block of an earlier run is replaced, not added to", () => {
  const earlierBlock =
    "<!-- screenshots -->\n\n![old](https://github.com/user-attachments/assets/old)\n\n<!-- /screenshots -->"
  assert.deepEqual(
    placeScreenshotsInDescription(
      `## Tests\n\n${earlierBlock}\n\n## Notes`,
      SCREENSHOTS_BLOCK,
      TEMPLATE_PLACEHOLDER,
    ),
    {
      text: `## Tests\n\n${SCREENSHOTS_BLOCK}\n\n## Notes`,
      place: "earlier block",
    },
  )
})

test("the placeholder named in the repo's settings is replaced, and the block keeps its $ signs", () => {
  const blockWithDollar =
    "<!-- screenshots -->\n\n**Price in $**\n\n<!-- /screenshots -->"
  assert.deepEqual(
    placeScreenshotsInDescription(
      `## Changes\n\n${TEMPLATE_PLACEHOLDER}\n\n## Impacts`,
      blockWithDollar,
      TEMPLATE_PLACEHOLDER,
    ),
    {
      text: `## Changes\n\n${blockWithDollar}\n\n## Impacts`,
      place: "configured placeholder",
    },
  )
})

test("a configured placeholder missing from the description leads to the end section", () => {
  assert.equal(
    placeScreenshotsInDescription(
      "## Summary",
      SCREENSHOTS_BLOCK,
      TEMPLATE_PLACEHOLDER,
    ).place,
    "end section",
  )
})

test("a review comment gets the block at its end without heading, and only once over two runs", () => {
  const commentWithScreenshots = placeScreenshotsInComment(
    "Labels are cut on a phone.\n",
    SCREENSHOTS_BLOCK,
  )
  assert.equal(
    commentWithScreenshots,
    `Labels are cut on a phone.\n\n${SCREENSHOTS_BLOCK}`,
  )
  assert.equal(
    placeScreenshotsInComment(commentWithScreenshots, SCREENSHOTS_BLOCK),
    commentWithScreenshots,
  )
})
