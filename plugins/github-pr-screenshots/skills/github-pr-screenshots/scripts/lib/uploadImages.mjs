// @ts-check
// Uploads images to GitHub through a pull request's comment box, without sending any comment:
// GitHub's API has no upload, its page does. Each upload writes the image's link in the box; the
// links are read back, then the box is emptied so that GitHub doesn't keep them as a draft.

const UPLOAD_TIME_LIMIT_MS = 60_000
const UPLOADED_IMAGE_URL_PATTERN = /https:\/\/github\.com\/user-attachments\/assets\/[0-9a-f-]+/g

/**
 * @param {any} page a Playwright page showing the pull request, signed in
 * @param {string[]} imageFiles
 * @returns {Promise<{ uploadedImageUrls: string[] } | { imageFileNotUploaded: string }>} the links in
 *   the order of imageFiles, or the first image whose upload didn't finish within a minute
 */
export async function uploadImagesThroughCommentBox(page, imageFiles) {
  const commentBox = page.locator("#new_comment_field")
  const commentBoxFileInput = page.locator("#fc-new_comment_field")

  // One image at a time: GitHub inserts each link with the same alt text, so the order of the
  // links is the only way to tell which image is which.
  /** @type {string[]} */
  const uploadedImageUrls = []
  for (const imageFile of imageFiles) {
    await commentBoxFileInput.setInputFiles(imageFile)
    const uploadDeadline = Date.now() + UPLOAD_TIME_LIMIT_MS
    /** @type {string[]} */
    let linksInCommentBox = []
    while (linksInCommentBox.length <= uploadedImageUrls.length && Date.now() < uploadDeadline) {
      await page.waitForTimeout(500)
      linksInCommentBox = (await commentBox.inputValue()).match(UPLOADED_IMAGE_URL_PATTERN) ?? []
    }
    if (linksInCommentBox.length <= uploadedImageUrls.length) {
      await commentBox.fill("")
      return { imageFileNotUploaded: imageFile }
    }
    uploadedImageUrls.push(linksInCommentBox[uploadedImageUrls.length])
  }
  await commentBox.fill("")
  return { uploadedImageUrls }
}
