// @ts-check
// Usage: node scripts/prepare.mjs <owner/repo> <pr-number> <png-file> <caption> [<png-file> <caption>...]
// Uploads the images to GitHub through the pull request's comment box, without sending any comment,
// to get their links. Then writes the description with the screenshots placed (rule in
// lib/description.mjs, placeholder from the repo's settings) to a pending file, and prints the screenshots block and where it goes.
// Run from inside the repo whose settings apply.
// Nothing changes on the pull request: apply.mjs writes the description once the user approves.
// Exit codes: 1 wrong arguments, 2 the browser is signed out (run login.mjs), 3 an upload failed.
import fs from "node:fs"
import path from "node:path"
import { openSignedInBrowser, readSignedInGitHubLogin } from "./lib/browser.mjs"
import { buildScreenshotsBlock, findScreenshotsPlace, placeScreenshotsInDescription } from "./lib/description.mjs"
import { buildPendingDescriptionFile, readPullRequestDescription } from "./lib/pendingDescription.mjs"
import { readRepositorySettings, REPOSITORY_SETTINGS_FILE } from "./lib/repositorySettings.mjs"

const UPLOAD_TIME_LIMIT_MS = 60_000
const UPLOADED_IMAGE_URL_PATTERN = /https:\/\/github\.com\/user-attachments\/assets\/[0-9a-f-]+/g

const [repository, pullRequestNumber, ...imagesAndCaptions] = process.argv.slice(2)
if (!repository?.includes("/") || !/^\d+$/.test(pullRequestNumber ?? "") || imagesAndCaptions.length % 2 !== 0) {
  console.error(
    "Usage: node scripts/prepare.mjs <owner/repo> <pr-number> <png-file> <caption> [<png-file> <caption>...]",
  )
  process.exit(1)
}
const imagesToShow = []
for (let index = 0; index < imagesAndCaptions.length; index += 2) {
  imagesToShow.push({ imageFile: path.resolve(imagesAndCaptions[index]), caption: imagesAndCaptions[index + 1] })
}
const missingImageFiles = imagesToShow.filter(({ imageFile }) => !fs.existsSync(imageFile))
if (imagesToShow.length === 0 || missingImageFiles.length > 0) {
  console.error(`No image given, or missing files: ${missingImageFiles.map(({ imageFile }) => imageFile).join(", ")}`)
  process.exit(1)
}

const { screenshotsPlaceholder } = readRepositorySettings()
const descriptionBeforeScreenshots = readPullRequestDescription(repository, pullRequestNumber)

const browser = await openSignedInBrowser({ visibleWindow: false })
/**
 * @param {number} exitCode
 * @param {string} message
 */
async function exitAfterClosingBrowser(exitCode, message) {
  console.error(message)
  await browser.close()
  process.exit(exitCode)
}
try {
  const page = await browser.newPage()
  await page.goto(`https://github.com/${repository}/pull/${pullRequestNumber}`)
  if (!(await readSignedInGitHubLogin(page))) {
    await exitAfterClosingBrowser(
      2,
      "The browser is signed out of GitHub: run scripts/login.mjs, then this script again.",
    )
  }
  const commentBox = page.locator("#new_comment_field")
  const commentBoxFileInput = page.locator("#fc-new_comment_field")

  // One image at a time: GitHub inserts each link with the same alt text, so the order of the
  // links is the only way to tell which image is which.
  /** @type {string[]} */
  const uploadedImageUrls = []
  for (const { imageFile } of imagesToShow) {
    await commentBoxFileInput.setInputFiles(imageFile)
    const uploadDeadline = Date.now() + UPLOAD_TIME_LIMIT_MS
    let linksInCommentBox = []
    while (linksInCommentBox.length <= uploadedImageUrls.length && Date.now() < uploadDeadline) {
      await page.waitForTimeout(500)
      linksInCommentBox = (await commentBox.inputValue()).match(UPLOADED_IMAGE_URL_PATTERN) ?? []
    }
    if (linksInCommentBox.length <= uploadedImageUrls.length) {
      await exitAfterClosingBrowser(3, `Upload of ${imageFile} didn't finish within a minute.`)
    }
    uploadedImageUrls.push(linksInCommentBox[uploadedImageUrls.length])
  }
  // Emptied so that GitHub doesn't keep the links as a comment draft.
  await commentBox.fill("")

  const screenshotsBlock = buildScreenshotsBlock(
    imagesToShow.map(({ caption }, index) => ({ caption, imageUrl: uploadedImageUrls[index] })),
  )
  const descriptionWithScreenshots = placeScreenshotsInDescription(
    descriptionBeforeScreenshots,
    screenshotsBlock,
    screenshotsPlaceholder,
  )
  const pendingDescriptionFile = buildPendingDescriptionFile(repository, pullRequestNumber)
  fs.mkdirSync(path.dirname(pendingDescriptionFile), { recursive: true })
  fs.writeFileSync(pendingDescriptionFile, JSON.stringify({ descriptionBeforeScreenshots, descriptionWithScreenshots }))

  const placement = {
    "earlier block": "in place of the screenshots of an earlier run",
    "configured placeholder": `in place of the placeholder named in ${REPOSITORY_SETTINGS_FILE}`,
    "start marker": "in place of the <!-- screenshots --> line",
    "end section": "in a new « Screenshots » section at the end",
  }[findScreenshotsPlace(descriptionBeforeScreenshots, screenshotsPlaceholder)]
  console.log(`Screenshots block, to be written in the description ${placement}:\n\n${screenshotsBlock}`)
} finally {
  await browser.close()
}
