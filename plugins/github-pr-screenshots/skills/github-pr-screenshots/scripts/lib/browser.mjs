// @ts-check
// The browser the scripts drive: Playwright's Chromium, with a profile kept on disk so that the
// user signs in to GitHub once and later runs find the session.
// Playwright is not shipped with the plugin: the first run installs it in the plugin's data folder,
// next to the profile. That folder survives plugin updates and is never inside a Git repo.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"

// Bump together with a test run: the Chromium build Playwright downloads depends on this version.
const PLAYWRIGHT_VERSION = "1.64.1"

// Claude Code sets CLAUDE_PLUGIN_DATA for an installed plugin. The fallback is the same folder,
// for a script run by hand or from a clone of the marketplace repo.
export const PLUGIN_DATA_FOLDER =
  process.env.CLAUDE_PLUGIN_DATA ??
  path.join(os.homedir(), ".claude", "plugins", "data", "github-pr-screenshots-ovski4")

// Holds the GitHub session cookies: whoever copies this folder can act as the signed-in user.
const BROWSER_PROFILE_FOLDER = path.join(PLUGIN_DATA_FOLDER, "browser-profile")

// Typed loosely: Playwright lives in the data folder, where the editor's type checker can't see it.
/** @returns {{ chromium: any }} */
function loadPlaywrightInstallingItIfMissing() {
  const playwrightPackageFile = path.join(PLUGIN_DATA_FOLDER, "node_modules", "playwright", "package.json")
  if (!fs.existsSync(playwrightPackageFile)) {
    console.error(`First run: installing Playwright ${PLAYWRIGHT_VERSION} and its Chromium in ${PLUGIN_DATA_FOLDER}`)
    fs.mkdirSync(PLUGIN_DATA_FOLDER, { recursive: true })
    execFileSync("npm", ["install", "--prefix", PLUGIN_DATA_FOLDER, `playwright@${PLAYWRIGHT_VERSION}`], {
      stdio: ["ignore", "inherit", "inherit"],
    })
    const playwrightCli = path.join(PLUGIN_DATA_FOLDER, "node_modules", "playwright", "cli.js")
    execFileSync(process.execPath, [playwrightCli, "install", "chromium"], { stdio: ["ignore", "inherit", "inherit"] })
  }
  return createRequire(playwrightPackageFile)("playwright")
}

/**
 * Opens the browser on the saved profile.
 * @param {{ visibleWindow: boolean }} options visibleWindow: true when the user has to act in
 *   the window (signing in); false to work without showing anything.
 */
export async function openSignedInBrowser({ visibleWindow }) {
  const { chromium } = loadPlaywrightInstallingItIfMissing()
  return chromium.launchPersistentContext(BROWSER_PROFILE_FOLDER, {
    headless: !visibleWindow,
    // null: the page follows the window's size, so the user can resize it while signing in.
    viewport: visibleWindow ? null : { width: 1280, height: 900 },
  })
}

/**
 * The login of the GitHub account the page is signed in to, or null when signed out.
 * GitHub writes it in a meta tag of every page.
 * @param {any} page a Playwright page
 */
export async function readSignedInGitHubLogin(page) {
  const login = await page
    .locator('meta[name="user-login"]')
    .getAttribute("content", { timeout: 5000 })
    .catch(() => null)
  return login || null
}
