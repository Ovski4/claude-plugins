// @ts-check
// Where the screenshots go in a pull request description. The rule is fixed so that the result
// doesn't depend on the model running the skill:
// - a block between SCREENSHOTS_START and SCREENSHOTS_END (left by an earlier run) is replaced;
// - else a SCREENSHOTS_START line alone (a placeholder written with the description) is replaced;
// - else a "## Screenshots" section is added at the end.

export const SCREENSHOTS_START = "<!-- screenshots -->"
export const SCREENSHOTS_END = "<!-- /screenshots -->"

/**
 * @param {{ caption: string, imageUrl: string }[]} screenshots in the order they are shown
 */
export function buildScreenshotsBlock(screenshots) {
  const shownScreenshots = screenshots.map(({ caption, imageUrl }) => `**${caption}**\n\n![${caption}](${imageUrl})`)
  return [SCREENSHOTS_START, ...shownScreenshots, SCREENSHOTS_END].join("\n\n")
}

/**
 * @param {string} description the pull request description as it is now
 * @param {string} screenshotsBlock from buildScreenshotsBlock
 */
export function placeScreenshotsInDescription(description, screenshotsBlock) {
  const blockStart = description.indexOf(SCREENSHOTS_START)
  if (blockStart === -1) {
    return `${description.trimEnd()}\n\n## Screenshots\n\n${screenshotsBlock}\n`
  }
  const blockEnd = description.indexOf(SCREENSHOTS_END, blockStart)
  const replacedUntil = blockEnd === -1 ? blockStart + SCREENSHOTS_START.length : blockEnd + SCREENSHOTS_END.length
  return description.slice(0, blockStart) + screenshotsBlock + description.slice(replacedUntil)
}
