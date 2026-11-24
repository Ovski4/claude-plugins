---
name: github-pr-screenshots
description: Put validation screenshots (PNG captures of the work, taken with Playwright or by hand) in the description of a GitHub pull request or in one of its review comments, uploaded from a browser signed in to the user's GitHub account. Use when the user asks to put screenshots, captures or visual proof on a PR or a review comment. Nothing is written before the user's OK.
argument-hint: <owner/repo> <pr-number> [--comment <id>] <png-file>...
model: haiku
---

# Screenshots in a GitHub pull request description

GitHub's API cannot upload an image: only its web page can. The scripts drive a Chromium browser
signed in to the user's GitHub account, and the images go through the page's own upload, as if
the user had dropped them in a comment box. Nothing is added to the repo.

The description is changed under the user's name: only after the user has seen the screenshots
block and said yes, for this pull request. An earlier yes doesn't cover the next one.

## First use: sign in

Run `node ${CLAUDE_SKILL_DIR}/scripts/login.mjs`.

- The first run installs Playwright and its Chromium in the plugin's data folder (a minute or
  two), then opens a window on GitHub's sign-in page.
- Tell the user to sign in there, two-factor step included, and wait: the script ends on its own
  once they are signed in, and prints the GitHub login. The window closes by itself.
- Exit code 1: the window was closed, or 10 minutes passed, before signing in. Ask the user
  whether to try again.

The data folder holds the GitHub session: whoever copies it can act as the user. Never copy it,
print its contents, or put it in a repo.

## Putting the screenshots in the description

1. Write one short caption per image: what it shows, in the language of the text it goes into,
   the description or the comment (`Éditeur, mode Continu`).
2. From the root of the pull request's repo, run `node ${CLAUDE_SKILL_DIR}/scripts/prepare.mjs <owner/repo> <pr-number> <png-file> "<caption>" [<png-file> "<caption>"...]`,
   in the order the images should appear.
   - It uploads the images and prints the screenshots block and where it goes. The script
     decides the place: don't move the block, don't edit the description yourself.
   - Exit code 2: the browser is signed out. Run `login.mjs` as above, then `prepare.mjs` again.
3. Show the user the printed block and the paths of the PNG files, and ask whether to write it.
4. On their yes, run `node ${CLAUDE_SKILL_DIR}/scripts/apply.mjs <owner/repo> <pr-number>`.
   Exit code 2: someone changed the description in between. Run `prepare.mjs` again, and ask
   again.

## Adding screenshots to a review comment

A review comment is a comment on a line of the changes; its link ends with `#r<id>`. Same steps,
with `--comment <id>` right after the pull request number, in both scripts:

- `prepare.mjs <owner/repo> <pr-number> --comment <id> <png-file> "<caption>"...` puts the block
  at the end of the comment when the signed-in user wrote it, else in a reply in its thread. It
  prints which one.
- `apply.mjs <owner/repo> <pr-number> --comment <id>` on the user's yes.

To choose the place in advance, the description holds a `<!-- screenshots -->` line where the
block goes, or the placeholder the repo names in `.claude/github-pr-screenshots.json`. Running
the skill again on the same pull request replaces the block of the earlier run.
