// @ts-check
// Usage: node scripts/prepare.mjs <owner/repo> <pr-number> [--comment <id>] <png-file> <caption> [<png-file> <caption>...]
// Uploads the images to GitHub through the pull request's comment box, without sending any comment,
// to get their links. Then prepares the change, kept in a pending file, and prints the screenshots
// block and where it goes:
// - without --comment, the description with the screenshots placed (rule in lib/description.mjs,
//   placeholder from the settings of the repo the script runs from);
// - with --comment <id> (the number after `#r` in a review comment's link), the comment with the
//   screenshots at its end when the signed-in user wrote it, else a reply in its thread.
// Nothing changes on the pull request: apply.mjs writes the change once the user approves.
// Exit codes: 1 wrong arguments, 2 the browser is signed out (run login.mjs), 3 an upload failed.
import fs from "node:fs"
import path from "node:path"
import { openSignedInBrowser, readSignedInGitHubLogin } from "./lib/browser.mjs"
import {
  buildScreenshotsBlock,
  findScreenshotsPlace,
  placeScreenshotsInComment,
  placeScreenshotsInDescription,
} from "./lib/description.mjs"
import { buildPendingChangeFile, readPullRequestDescription, readReviewComment } from "./lib/pullRequestText.mjs"
import { readRepositorySettings, REPOSITORY_SETTINGS_FILE } from "./lib/repositorySettings.mjs"
import { uploadImagesThroughCommentBox } from "./lib/uploadImages.mjs"

const [repository, pullRequestNumber, ...otherArguments] = process.argv.slice(2)
const commentId = otherArguments[0] === "--comment" ? otherArguments[1] : null
const imagesAndCaptions = commentId ? otherArguments.slice(2) : otherArguments
if (
  !repository?.includes("/") ||
  !/^\d+$/.test(pullRequestNumber ?? "") ||
  (otherArguments[0] === "--comment" && !/^\d+$/.test(commentId ?? "")) ||
  imagesAndCaptions.length % 2 !== 0
) {
  console.error(
    "Usage: node scripts/prepare.mjs <owner/repo> <pr-number> [--comment <id>] <png-file> <caption> [<png-file> <caption>...]",
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

const browser = await openSignedInBrowser({ visibleWindow: false })
const page = await browser.newPage()
await page.goto(`https://github.com/${repository}/pull/${pullRequestNumber}`)
const signedInLogin = await readSignedInGitHubLogin(page)
const uploadResult = signedInLogin
  ? await uploadImagesThroughCommentBox(
      page,
      imagesToShow.map(({ imageFile }) => imageFile),
    )
  : null
await browser.close()
if (!uploadResult) {
  console.error("The browser is signed out of GitHub: run scripts/login.mjs, then this script again.")
  process.exit(2)
}
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
if (!commentId) {
  const { screenshotsPlaceholder } = readRepositorySettings()
  const description = readPullRequestDescription(repository, pullRequestNumber)
  const textAfter = placeScreenshotsInDescription(description, screenshotsBlock, screenshotsPlaceholder)
  pendingChange = { kind: "description", textBefore: description, textAfter }
  placement = {
    "earlier block": "in the description, in place of the screenshots of an earlier run",
    "configured placeholder": `in the description, in place of the placeholder named in ${REPOSITORY_SETTINGS_FILE}`,
    "start marker": "in the description, in place of the <!-- screenshots --> line",
    "end section": "in the description, in a new « Screenshots » section at the end",
  }[findScreenshotsPlace(description, screenshotsPlaceholder)]
} else {
  const comment = readReviewComment(repository, commentId)
  if (comment.authorLogin === signedInLogin) {
    pendingChange = {
      kind: "comment edit",
      textBefore: comment.body,
      textAfter: placeScreenshotsInComment(comment.body, screenshotsBlock),
    }
    placement = `at the end of review comment ${commentId}, which ${signedInLogin} wrote`
  } else {
    pendingChange = { kind: "comment reply", textBefore: null, textAfter: screenshotsBlock }
    placement = `as a reply to review comment ${commentId}, written by ${comment.authorLogin}`
  }
}

const pendingChangeFile = buildPendingChangeFile(repository, pullRequestNumber, commentId)
fs.mkdirSync(path.dirname(pendingChangeFile), { recursive: true })
fs.writeFileSync(pendingChangeFile, JSON.stringify(pendingChange))
console.log(`Screenshots block, to be written ${placement}:\n\n${screenshotsBlock}`)
