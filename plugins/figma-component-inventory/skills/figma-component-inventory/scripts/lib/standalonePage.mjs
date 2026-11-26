// @ts-check
// What the render.mjs of both skills share: the page they write is one HTML file that opens
// without a server, and the way a command stops with an exit code that tells why.
import fs from "node:fs"
import path from "node:path"

export { CommandFailure } from "./commandFailure.mjs"

// What the pages of both skills look alike by: pasted before each page's own page.css.
const SHARED_STYLES_FILE = path.join(
  import.meta.dirname,
  "..",
  "page",
  "pageBase.css",
)
// The texts the pages of both skills show alike, in every language: pasted first, the
// shared review script reads them.
const SHARED_TEXTS_FILE = path.join(
  import.meta.dirname,
  "..",
  "page",
  "pageTexts.mjs",
)
// The texts only one page shows, in every language, in that page's folder: pasted before
// its page.js.
const OWN_TEXTS_FILE_NAME = "ownTexts.mjs"
// What the pages of both skills tick alike: pasted before each page's own page.js.
const SHARED_REVIEW_SCRIPT_FILE = path.join(
  import.meta.dirname,
  "..",
  "page",
  "pageReview.mjs",
)
// Each comment of page/page.html is replaced: by the shared styles and page.css, by the
// feedback text module, by the shared texts, the shared review script and page.js, and by the data page.js
// draws.
const PLACEHOLDERS_IN_PAGE = {
  styles: "/*PAGE_STYLES*/",
  feedbackText: "/*FEEDBACK_TEXT_MODULE*/",
  script: "/*PAGE_SCRIPT*/",
  data: "/*PAGE_DATA*/",
}

/**
 * A PNG capture as a data URL, so that the page holds its images.
 * @param {string} captureFile
 */
export const readCaptureAsDataUrl = (captureFile) =>
  `data:image/png;base64,${fs.readFileSync(captureFile).toString("base64")}`

/**
 * A module as the page takes it: a plain script has no "export".
 * @param {string} moduleFile
 */
const readAsPlainScript = (moduleFile) =>
  fs.readFileSync(moduleFile, "utf8").replace(/^export /gm, "")

/**
 * Writes the page: page/page.html of `pageFolder` with its styles, its scripts and its data
 * pasted in.
 * @param {object} input
 * @param {string} input.pageFolder holds page.html, page.css, page.js and ownTexts.mjs
 * @param {string} input.feedbackTextModule the module that builds the corrections text: pasted as a plain script, its functions become the page's globals
 * @param {unknown} input.pageData what page.js draws
 * @param {string} input.pageFile where to write the page
 */
export function writeStandalonePage({
  pageFolder,
  feedbackTextModule,
  pageData,
  pageFile,
}) {
  /** @param {string} fileName */
  const readPageFile = (fileName) =>
    fs.readFileSync(path.join(pageFolder, fileName), "utf8")
  // TODO: specs.html still writes its own texts in French in page.html and page.js. Once
  // they are in an ownTexts.mjs of its page folder, that file is required like the others.
  const ownTextsFile = path.join(pageFolder, OWN_TEXTS_FILE_NAME)
  const ownTextsScripts = fs.existsSync(ownTextsFile)
    ? [readAsPlainScript(ownTextsFile)]
    : []
  // "<" is escaped so that a note containing "</script>" cannot close the data's script.
  const pageDataAsJson = JSON.stringify(pageData).replace(/</g, "\\u003c")
  fs.writeFileSync(
    pageFile,
    readPageFile("page.html")
      .replace(
        PLACEHOLDERS_IN_PAGE.styles,
        () =>
          `${fs.readFileSync(SHARED_STYLES_FILE, "utf8")}\n${readPageFile("page.css")}`,
      )
      .replace(PLACEHOLDERS_IN_PAGE.feedbackText, () =>
        readAsPlainScript(feedbackTextModule),
      )
      .replace(PLACEHOLDERS_IN_PAGE.script, () =>
        [
          readAsPlainScript(SHARED_TEXTS_FILE),
          readAsPlainScript(SHARED_REVIEW_SCRIPT_FILE),
          ...ownTextsScripts,
          readPageFile("page.js"),
        ].join("\n"),
      )
      .replace(PLACEHOLDERS_IN_PAGE.data, () => pageDataAsJson),
  )
}
