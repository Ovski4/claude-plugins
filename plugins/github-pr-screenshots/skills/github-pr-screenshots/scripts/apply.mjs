// @ts-check
// Usage: node scripts/apply.mjs <owner/repo> <pr-number> [--comment <id>]
// Writes the change prepared by prepare.mjs with the same arguments: the description, the review
// comment, or the reply. Run it only after the user approved the screenshots block prepare.mjs
// printed.
// Exit codes: 1 nothing prepared, 2 the description or comment changed on GitHub since the
// preparation (run prepare.mjs again so that the change is kept).
import fs from "node:fs"
import { buildPendingChangeFile, writePendingChange } from "./lib/pullRequestText.mjs"

const [repository, pullRequestNumber, commentOption, commentIdArgument] = process.argv.slice(2)
const commentId = commentOption === "--comment" ? (commentIdArgument ?? null) : null
const pendingChangeFile = buildPendingChangeFile(repository ?? "", pullRequestNumber ?? "", commentId)
if (!fs.existsSync(pendingChangeFile)) {
  console.error(`Nothing prepared for ${repository} #${pullRequestNumber}: run scripts/prepare.mjs first.`)
  process.exit(1)
}
const pendingChange = JSON.parse(fs.readFileSync(pendingChangeFile, "utf8"))

if (!writePendingChange(repository, pullRequestNumber, commentId, pendingChange)) {
  console.error("The text changed on GitHub since the preparation: run scripts/prepare.mjs again.")
  process.exit(2)
}
fs.rmSync(pendingChangeFile)
console.log(`Screenshots written (${pendingChange.kind}) on ${repository} #${pullRequestNumber}.`)
