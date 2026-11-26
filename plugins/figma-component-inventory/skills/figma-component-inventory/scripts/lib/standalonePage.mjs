// @ts-check
// What the render.mjs of both skills share: the page they write is one HTML file that opens
// without a server.
import fs from "node:fs"
import path from "node:path"

// The folder of what the pages of both skills share.
const SHARED_PAGE_FOLDER = path.join(import.meta.dirname, "..", "page")
// The header both pages have: what the page is about, its approval, its settings.
const SHARED_HEADER_FILE = path.join(SHARED_PAGE_FOLDER, "pageHeader.html")
// What the pages look alike by: pasted before each page's own page.css.
const SHARED_STYLES_FILE = path.join(SHARED_PAGE_FOLDER, "pageBase.css")
// The texts both pages show, in every language.
const SHARED_TEXTS_FILE = path.join(SHARED_PAGE_FOLDER, "pageTexts.mjs")
// The texts only one page shows, in every language, in that page's own folder.
const OWN_TEXTS_FILE_NAME = "ownTexts.mjs"
// What the pages do alike, their texts first: it reads both dictionaries when it starts.
const SHARED_REVIEW_SCRIPT_FILE = path.join(
  SHARED_PAGE_FOLDER,
  "pageReview.mjs",
)
// Each comment of page/page.html is replaced: by the shared header; by the shared styles
// and page.css; by the feedback text module; by the two dictionaries, the shared review
// script and page.js, in that order; and by the data page.js draws.
const PLACEHOLDERS_IN_PAGE = {
  header: "<!--PAGE_HEADER-->",
  styles: "/*PAGE_STYLES*/",
  feedbackText: "/*FEEDBACK_TEXT_MODULE*/",
  script: "/*PAGE_SCRIPT*/",
  data: "/*PAGE_DATA*/",
}

// The settings only one page has: page.html writes them in this template, and they go
// into the settings panel of the shared header, in place of its comment.
const OWN_SETTINGS_TEMPLATE =
  /<template id="own-settings">([\s\S]*?)<\/template>\s*/
const OWN_SETTINGS_PLACEHOLDER = "<!--OWN_SETTINGS-->"

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
 * @param {string} input.pageFolder holds page.html, page.css, page.js and ownTexts.mjs;
 *   page.html may hold a template "own-settings", the settings only that page has
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
  // "<" is escaped so that a note containing "</script>" cannot close the data's script.
  const pageDataAsJson = JSON.stringify(pageData).replace(/</g, "\\u003c")
  const pageHtml = readPageFile("page.html")
  const ownSettings = pageHtml.match(OWN_SETTINGS_TEMPLATE)?.[1] ?? ""
  const header = fs
    .readFileSync(SHARED_HEADER_FILE, "utf8")
    .replace(OWN_SETTINGS_PLACEHOLDER, () => ownSettings)
  fs.writeFileSync(
    pageFile,
    pageHtml
      .replace(OWN_SETTINGS_TEMPLATE, "")
      .replace(PLACEHOLDERS_IN_PAGE.header, () => header)
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
          readAsPlainScript(path.join(pageFolder, OWN_TEXTS_FILE_NAME)),
          readAsPlainScript(SHARED_REVIEW_SCRIPT_FILE),
          readPageFile("page.js"),
        ].join("\n"),
      )
      .replace(PLACEHOLDERS_IN_PAGE.data, () => pageDataAsJson),
  )
}

/**
 * What a page drawn by `writeStandalonePage` was given to draw; undefined when there is
 * no such page.
 * @param {string} pageFile
 * @returns {Record<string, unknown> | undefined}
 */
export function readPageData(pageFile) {
  if (!fs.existsSync(pageFile)) return undefined
  // The data cannot hold "</script>": its "<" are escaped when the page is written.
  const [, pageDataAsJson] =
    fs
      .readFileSync(pageFile, "utf8")
      .match(/<script type="application\/json"[^>]*>\s*([^<]*)<\/script>/) ?? []
  return pageDataAsJson === undefined ? undefined : JSON.parse(pageDataAsJson)
}
