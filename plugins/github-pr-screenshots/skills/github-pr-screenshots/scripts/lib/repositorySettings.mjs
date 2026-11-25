// @ts-check
// The settings a repo gives the skill, in `.claude/github-pr-screenshots.json` at the root of the
// repo the scripts run from. The file is optional:
// - screenshotsPlaceholder: the exact text the repo's pull request template leaves where
//   screenshots go, line breaks included. The screenshots replace it. Without it, only a
//   `<!-- screenshots -->` line marks the place.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

export const REPOSITORY_SETTINGS_FILE = path.join(
  ".claude",
  "github-pr-screenshots.json",
)

/** @returns {string | null} the placeholder the settings name, or null without settings or placeholder */
export function readConfiguredScreenshotsPlaceholder() {
  let repositoryRoot
  try {
    repositoryRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    }).trim()
  } catch {
    return null
  }
  const settingsFile = path.join(repositoryRoot, REPOSITORY_SETTINGS_FILE)
  if (!fs.existsSync(settingsFile)) return null

  const { screenshotsPlaceholder } = JSON.parse(
    fs.readFileSync(settingsFile, "utf8"),
  )
  if (
    screenshotsPlaceholder !== undefined &&
    (typeof screenshotsPlaceholder !== "string" || !screenshotsPlaceholder)
  ) {
    throw new Error(
      `${settingsFile}: screenshotsPlaceholder must be a non-empty string.`,
    )
  }
  return screenshotsPlaceholder ?? null
}
