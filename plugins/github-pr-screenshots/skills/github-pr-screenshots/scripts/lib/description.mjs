// @ts-check
// Where the screenshots go in a pull request description. The rule is fixed so that the result
// doesn't depend on the model running the skill. The first of these found is replaced:
// 1. a block between SCREENSHOTS_START and SCREENSHOTS_END, left by an earlier run;
// 2. the placeholder the repo's settings name (lib/repositorySettings.mjs);
// 3. a SCREENSHOTS_START line alone;
// else a "## Screenshots" section is added at the end.

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
 * @param {string | null} configuredPlaceholder from the repo's settings, null when it names none
 * @returns {"earlier block" | "configured placeholder" | "start marker" | "end section"}
 */
export function findScreenshotsPlace(description, configuredPlaceholder) {
  const blockStart = description.indexOf(SCREENSHOTS_START)
  if (blockStart !== -1 && description.indexOf(SCREENSHOTS_END, blockStart) !== -1) return "earlier block"
  if (configuredPlaceholder && description.includes(configuredPlaceholder)) return "configured placeholder"
  if (blockStart !== -1) return "start marker"
  return "end section"
}

/**
 * @param {string} description the pull request description as it is now
 * @param {string} screenshotsBlock from buildScreenshotsBlock
 * @param {string | null} configuredPlaceholder from the repo's settings, null when it names none
 */
export function placeScreenshotsInDescription(description, screenshotsBlock, configuredPlaceholder) {
  const blockStart = description.indexOf(SCREENSHOTS_START)
  switch (findScreenshotsPlace(description, configuredPlaceholder)) {
    case "earlier block": {
      const blockEnd = description.indexOf(SCREENSHOTS_END, blockStart) + SCREENSHOTS_END.length
      return description.slice(0, blockStart) + screenshotsBlock + description.slice(blockEnd)
    }
    case "configured placeholder":
      // A function as replacement, so that a "$" in the block is written as it is.
      return description.replace(/** @type {string} */ (configuredPlaceholder), () => screenshotsBlock)
    case "start marker":
      return description.replace(SCREENSHOTS_START, () => screenshotsBlock)
    case "end section":
      return `${description.trimEnd()}\n\n## Screenshots\n\n${screenshotsBlock}\n`
  }
}

/**
 * A review comment the user wrote gets the block at its end, without a heading, or in place of
 * the block of an earlier run.
 * @param {string} commentBody
 * @param {string} screenshotsBlock from buildScreenshotsBlock
 */
export function placeScreenshotsInComment(commentBody, screenshotsBlock) {
  if (findScreenshotsPlace(commentBody, null) === "earlier block") {
    return placeScreenshotsInDescription(commentBody, screenshotsBlock, null)
  }
  return `${commentBody.trimEnd()}\n\n${screenshotsBlock}`
}
