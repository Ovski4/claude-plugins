// @ts-check
// Usage: node scripts/apply.mjs <owner/repo> <pr-number>
// Writes the description prepared by prepare.mjs to the pull request. Run it only after the user
// approved the screenshots block prepare.mjs printed.
// Exit codes: 1 nothing prepared for this pull request, 2 the description changed on GitHub since
// the preparation (run prepare.mjs again so that the change is kept).
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { buildPendingDescriptionFile, readPullRequestDescription } from "./lib/pendingDescription.mjs"

const [repository, pullRequestNumber] = process.argv.slice(2)
const pendingDescriptionFile = buildPendingDescriptionFile(repository ?? "", pullRequestNumber ?? "")
if (!fs.existsSync(pendingDescriptionFile)) {
  console.error(`Nothing prepared for ${repository} #${pullRequestNumber}: run scripts/prepare.mjs first.`)
  process.exit(1)
}
const { descriptionBeforeScreenshots, descriptionWithScreenshots } = JSON.parse(
  fs.readFileSync(pendingDescriptionFile, "utf8"),
)

if (readPullRequestDescription(repository, pullRequestNumber) !== descriptionBeforeScreenshots) {
  console.error("The description changed on GitHub since the preparation: run scripts/prepare.mjs again.")
  process.exit(2)
}

execFileSync("gh", ["pr", "edit", pullRequestNumber, "--repo", repository, "--body-file", "-"], {
  input: descriptionWithScreenshots,
  stdio: ["pipe", "inherit", "inherit"],
})
fs.rmSync(pendingDescriptionFile)
console.log(`Screenshots written in the description of ${repository} #${pullRequestNumber}.`)
