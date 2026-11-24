import assert from "node:assert/strict"
import test from "node:test"

import { buildScreenshotsBlock, placeScreenshotsInDescription } from "../scripts/lib/description.mjs"

const SCREENSHOTS_BLOCK = buildScreenshotsBlock([
  { caption: "Editor, Continuous mode", imageUrl: "https://github.com/user-attachments/assets/aaa-111" },
  { caption: "Editor, Period mode", imageUrl: "https://github.com/user-attachments/assets/bbb-222" },
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
  assert.equal(
    placeScreenshotsInDescription("## Summary\n\nText.\n\n", SCREENSHOTS_BLOCK),
    `## Summary\n\nText.\n\n## Screenshots\n\n${SCREENSHOTS_BLOCK}\n`,
  )
})

test("a lone start marker is replaced where it stands", () => {
  assert.equal(
    placeScreenshotsInDescription("## Tests\n\n<!-- screenshots -->\n\n## Notes", SCREENSHOTS_BLOCK),
    `## Tests\n\n${SCREENSHOTS_BLOCK}\n\n## Notes`,
  )
})

test("the block of an earlier run is replaced, not added to", () => {
  const earlierBlock =
    "<!-- screenshots -->\n\n![old](https://github.com/user-attachments/assets/old)\n\n<!-- /screenshots -->"
  assert.equal(
    placeScreenshotsInDescription(`## Tests\n\n${earlierBlock}\n\n## Notes`, SCREENSHOTS_BLOCK),
    `## Tests\n\n${SCREENSHOTS_BLOCK}\n\n## Notes`,
  )
})
