// @ts-check
// Uploads images to GitHub through a pull request's comment box, without sending any comment:
// GitHub's API has no upload, its page does. Each upload writes the image's link in the box; the
// links are read back, then the box is emptied so that GitHub doesn't keep them as a draft.

const UPLOAD_TIME_LIMIT_MS = 60_000
const COMMENT_BOX_SELECTOR = "#new_comment_field"
const UPLOADED_IMAGE_URL_PATTERN =
  /https:\/\/github\.com\/user-attachments\/assets\/[0-9a-f-]+/g

/**
 * @param {any} page a Playwright page showing the pull request, signed in
 * @param {string[]} imageFiles
 * @returns {Promise<{ uploadedImageUrls: string[] } | { imageFileNotUploaded: string }>} the links in
 *   the order of imageFiles, or the first image whose upload didn't finish within a minute
 */
export async function uploadImagesThroughCommentBox(page, imageFiles) {
  const commentBox = page.locator(COMMENT_BOX_SELECTOR)
  const commentBoxFileInput = page.locator("#fc-new_comment_field")
  try {
    // One image at a time: GitHub inserts each link with the same alt text, so the order of the
    // links is the only way to tell which image is which.
    /** @type {string[]} */
    const uploadedImageUrls = []
    for (const imageFile of imageFiles) {
      await commentBoxFileInput.setInputFiles(imageFile)
      const hasUploadFinished = await page
        .waitForFunction(
          /** @param {{ selector: string, linksBefore: number }} arg */
          ({ selector, linksBefore }) =>
            /** @type {HTMLTextAreaElement | null} */ (
              document
                .querySelector(selector)
                ?.value.match(/user-attachments\/assets\//g) ?? []
            ).length > linksBefore,
          {
            selector: COMMENT_BOX_SELECTOR,
            linksBefore: uploadedImageUrls.length,
          },
          { timeout: UPLOAD_TIME_LIMIT_MS },
        )
        .then(() => true)
        .catch(() => false)
      if (!hasUploadFinished) return { imageFileNotUploaded: imageFile }
      const linksInCommentBox =
        (await commentBox.inputValue()).match(UPLOADED_IMAGE_URL_PATTERN) ?? []
      uploadedImageUrls.push(linksInCommentBox[uploadedImageUrls.length])
    }
    return { uploadedImageUrls }
  } finally {
    await commentBox.fill("")
  }
}
