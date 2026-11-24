// @ts-check
// Usage: node scripts/login.mjs
// Opens a browser window on GitHub's sign-in page, for the user to sign in (two-factor step
// included). The session stays in the browser profile, so later runs need no sign-in until GitHub
// ends it. Prints the signed-in login and exits 0; exits 1 when the window is closed, or 10 minutes
// pass, before the user is signed in.
// Already signed in: prints the login and closes the window right away.
import { openSignedInBrowser, readSignedInGitHubLogin } from "./lib/browser.mjs"

const SIGN_IN_TIME_LIMIT_MS = 10 * 60 * 1000
const SIGN_IN_CHECK_INTERVAL_MS = 2000

const browser = await openSignedInBrowser({ visibleWindow: true })
let isWindowClosed = false
browser.on("close", () => (isWindowClosed = true))

const page = browser.pages()[0] ?? (await browser.newPage())
await page.goto("https://github.com/login")

const signInDeadline = Date.now() + SIGN_IN_TIME_LIMIT_MS
let signedInLogin = await readSignedInGitHubLogin(page)
while (!signedInLogin && !isWindowClosed && Date.now() < signInDeadline) {
  await new Promise((resolve) => setTimeout(resolve, SIGN_IN_CHECK_INTERVAL_MS))
  if (!isWindowClosed) signedInLogin = await readSignedInGitHubLogin(page)
}

if (!isWindowClosed) await browser.close()

if (signedInLogin) {
  console.log(`Signed in to GitHub as ${signedInLogin}.`)
} else {
  console.error(isWindowClosed ? "Window closed before signing in." : "Not signed in after 10 minutes.")
  process.exit(1)
}
