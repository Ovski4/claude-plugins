// @ts-check
// The description prepare.mjs proposes, kept on disk until the user approves it and apply.mjs
// writes it. The description read at preparation is kept too: apply.mjs refuses to write when
// someone changed the pull request in between, so that their change isn't overwritten.
import { execFileSync } from "node:child_process"
import path from "node:path"
import { PLUGIN_DATA_FOLDER } from "./browser.mjs"

/**
 * @param {string} repository owner/repo
 * @param {string} pullRequestNumber
 */
export function buildPendingDescriptionFile(repository, pullRequestNumber) {
  return path.join(PLUGIN_DATA_FOLDER, "pending", `${repository.replace("/", "__")}__${pullRequestNumber}.json`)
}

/**
 * @param {string} repository owner/repo
 * @param {string} pullRequestNumber
 */
export function readPullRequestDescription(repository, pullRequestNumber) {
  return execFileSync(
    "gh",
    ["pr", "view", pullRequestNumber, "--repo", repository, "--json", "body", "--jq", ".body"],
    {
      encoding: "utf8",
    },
  ).replace(/\n$/, "")
}
