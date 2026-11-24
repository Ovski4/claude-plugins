// @ts-check
// The screenshots block and where it goes. The rules are fixed so that the result doesn't depend
// on the model running the skill.
// In a pull request description, the first of these found is replaced:
// 1. a block between SCREENSHOTS_START and SCREENSHOTS_END, left by an earlier run;
// 2. the placeholder the repo's settings name (lib/repositorySettings.mjs);
// 3. a SCREENSHOTS_START line alone;
// else a "## Screenshots" section is added at the end.
// In a review comment, the block of an earlier run is replaced, else the block is added at the end.

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
 * @param {string} text
 * @param {string} screenshotsBlock
 * @returns {string | null} the text with the block of an earlier run replaced, or null when it has none
 */
function replaceEarlierBlock(text, screenshotsBlock) {
  const blockStart = text.indexOf(SCREENSHOTS_START)
  const blockEnd = blockStart === -1 ? -1 : text.indexOf(SCREENSHOTS_END, blockStart)
  if (blockEnd === -1) return null
  return text.slice(0, blockStart) + screenshotsBlock + text.slice(blockEnd + SCREENSHOTS_END.length)
}

/**
 * @param {string} description the pull request description as it is now
 * @param {string} screenshotsBlock from buildScreenshotsBlock
 * @param {string | null} configuredPlaceholder from the repo's settings, null when it names none
 * @returns {{ text: string, place: "earlier block" | "configured placeholder" | "start marker" | "end section" }}
 */
export function placeScreenshotsInDescription(description, screenshotsBlock, configuredPlaceholder) {
  const descriptionWithEarlierBlockReplaced = replaceEarlierBlock(description, screenshotsBlock)
  if (descriptionWithEarlierBlockReplaced !== null) {
    return { text: descriptionWithEarlierBlockReplaced, place: "earlier block" }
  }
  // A function as replacement, so that a "$" in the block is written as it is.
  if (configuredPlaceholder && description.includes(configuredPlaceholder)) {
    return { text: description.replace(configuredPlaceholder, () => screenshotsBlock), place: "configured placeholder" }
  }
  if (description.includes(SCREENSHOTS_START)) {
    return { text: description.replace(SCREENSHOTS_START, () => screenshotsBlock), place: "start marker" }
  }
  return { text: `${description.trimEnd()}\n\n## Screenshots\n\n${screenshotsBlock}\n`, place: "end section" }
}

/**
 * @param {string} commentBody a review comment the signed-in user wrote
 * @param {string} screenshotsBlock from buildScreenshotsBlock
 */
export function placeScreenshotsInComment(commentBody, screenshotsBlock) {
  return replaceEarlierBlock(commentBody, screenshotsBlock) ?? `${commentBody.trimEnd()}\n\n${screenshotsBlock}`
}
