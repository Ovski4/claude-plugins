// @ts-check
// Usage: node scripts/prepare.mjs <owner/repo> <pr-number> [--comment <id>] <png-file> <caption> [<png-file> <caption>...]
// Uploads the images to GitHub through the pull request's comment box, without sending any comment,
// to get their links. Then prepares the change, kept in a pending file, and prints the screenshots
// block and where it goes:
// - without --comment, the description with the screenshots placed (rules in
//   lib/screenshotsBlock.mjs, placeholder from the settings of the repo the script runs from);
// - with --comment <id> (the number after `#r` in a review comment's link), the comment with the
//   screenshots at its end when the signed-in user wrote it, else a reply in its thread.
// Nothing changes on the pull request: apply.mjs writes the change once the user approves.
// Exit codes: 1 wrong arguments, 2 the browser is signed out (run login.mjs), 3 an upload failed.
import fs from "node:fs"
import path from "node:path"
import { openSignedInBrowser, readSignedInGitHubLogin } from "./lib/browser.mjs"
import {
  buildPendingChangeFile,
  parsePullRequestTarget,
  readPullRequestDescription,
  readReviewComment,
} from "./lib/pullRequestText.mjs"
import { readConfiguredScreenshotsPlaceholder, REPOSITORY_SETTINGS_FILE } from "./lib/repositorySettings.mjs"
import {
  buildScreenshotsBlock,
  placeScreenshotsInComment,
  placeScreenshotsInDescription,
} from "./lib/screenshotsBlock.mjs"
import { uploadImagesThroughCommentBox } from "./lib/uploadImages.mjs"

const parsedArguments = parsePullRequestTarget(process.argv.slice(2))
const imagesAndCaptionsCount = parsedArguments?.otherArguments.length ?? 0
if (!parsedArguments || imagesAndCaptionsCount === 0 || imagesAndCaptionsCount % 2 !== 0) {
  console.error(
    "Usage: node scripts/prepare.mjs <owner/repo> <pr-number> [--comment <id>] <png-file> <caption> [<png-file> <caption>...]",
  )
  process.exit(1)
}
const { otherArguments: imagesAndCaptions, ...target } = parsedArguments
const imagesToShow = Array.from({ length: imagesAndCaptions.length / 2 }, (_, index) => ({
  imageFile: path.resolve(imagesAndCaptions[2 * index]),
  caption: imagesAndCaptions[2 * index + 1],
}))
const missingImageFiles = imagesToShow.filter(({ imageFile }) => !fs.existsSync(imageFile))
if (missingImageFiles.length > 0) {
  console.error(`Missing files: ${missingImageFiles.map(({ imageFile }) => imageFile).join(", ")}`)
  process.exit(1)
}

// Read before uploading, so that a wrong pull request, comment or settings file fails before any
// image is sent.
const configuredPlaceholder = target.commentId ? null : readConfiguredScreenshotsPlaceholder()
const description = target.commentId ? null : readPullRequestDescription(target)
const reviewComment = target.commentId ? readReviewComment(target) : null

const browser = await openSignedInBrowser({ visibleWindow: false })
const page = browser.pages()[0] ?? (await browser.newPage())
await page.goto(`https://github.com/${target.repository}/pull/${target.pullRequestNumber}`, {
  waitUntil: "domcontentloaded",
})
const signedInLogin = await readSignedInGitHubLogin(page)
if (!signedInLogin) {
  await browser.close()
  console.error("The browser is signed out of GitHub: run scripts/login.mjs, then this script again.")
  process.exit(2)
}
const uploadResult = await uploadImagesThroughCommentBox(
  page,
  imagesToShow.map(({ imageFile }) => imageFile),
)
await browser.close()
if ("imageFileNotUploaded" in uploadResult) {
  console.error(`Upload of ${uploadResult.imageFileNotUploaded} didn't finish within a minute.`)
  process.exit(3)
}

const screenshotsBlock = buildScreenshotsBlock(
  imagesToShow.map(({ caption }, index) => ({ caption, imageUrl: uploadResult.uploadedImageUrls[index] })),
)
/** @type {import("./lib/pullRequestText.mjs").PendingChange} */
let pendingChange
let placement
if (description !== null) {
  const { text, place } = placeScreenshotsInDescription(description, screenshotsBlock, configuredPlaceholder)
  pendingChange = { ...target, kind: "description", textBefore: description, textAfter: text }
  placement = {
    "earlier block": "in the description, in place of the screenshots of an earlier run",
    "configured placeholder": `in the description, in place of the placeholder named in ${REPOSITORY_SETTINGS_FILE}`,
    "start marker": "in the description, in place of the <!-- screenshots --> line",
    "end section": "in the description, in a new « Screenshots » section at the end",
  }[place]
} else if (reviewComment?.authorLogin === signedInLogin) {
  const textAfter = placeScreenshotsInComment(reviewComment.body, screenshotsBlock)
  pendingChange = { ...target, kind: "comment edit", textBefore: reviewComment.body, textAfter }
  placement = `at the end of review comment ${target.commentId}, which ${signedInLogin} wrote`
} else {
  pendingChange = { ...target, kind: "comment reply", textBefore: null, textAfter: screenshotsBlock }
  placement = `as a reply to review comment ${target.commentId}, written by ${reviewComment?.authorLogin}`
}

const pendingChangeFile = buildPendingChangeFile(target)
fs.mkdirSync(path.dirname(pendingChangeFile), { recursive: true })
fs.writeFileSync(pendingChangeFile, JSON.stringify(pendingChange))
console.log(`Screenshots block, to be written ${placement}:\n\n${screenshotsBlock}`)
