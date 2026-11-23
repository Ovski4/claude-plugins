// @ts-check
// What the scripts ask Git about the repo they are run in.
import { execFileSync } from "node:child_process"

/** @param {string[]} gitArguments */
function runGit(...gitArguments) {
  return execFileSync("git", gitArguments, { encoding: "utf8" }).trim()
}

/** The folder that holds the repo the command is run from, whatever its subfolder. */
export function findRepoRoot() {
  return runGit("rev-parse", "--show-toplevel")
}

/** The short hash of the commit the code is read at, e.g. "34ee98aa6". */
export function readCurrentCommit() {
  return runGit("rev-parse", "--short", "HEAD")
}

/**
 * The files Git tracks under a folder, from the repo's root.
 * @param {string} repoRoot
 * @param {string} folder from the repo's root
 */
export function listTrackedFiles(repoRoot, folder) {
  return execFileSync("git", ["-C", repoRoot, "ls-files", folder], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
}
