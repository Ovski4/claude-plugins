---
name: github-pr-screenshots
description: Post validation screenshots (PNG captures of the work, taken with Playwright or by hand) in a comment of a GitHub pull request, from a browser signed in to the user's GitHub account. Use when the user asks to put screenshots, captures or visual proof on a PR. The comment is shown to the user and sent only after their OK.
argument-hint: <owner/repo> <pr-number> <png-file>...
model: haiku
---

# Screenshots in a GitHub pull request comment

GitHub's API cannot attach an image to a comment: only its web page can. The scripts drive a
Chromium browser signed in to the user's GitHub account, and the images go through the page's
own upload, as if the user had dropped them in the comment box. Nothing is added to the repo.

The comment is posted under the user's name: it is sent only after the user has seen it and said
yes, for this comment. An earlier yes doesn't cover the next one.

## First use: sign in

Run `node ${CLAUDE_SKILL_DIR}/scripts/login.mjs`.

- The first run installs Playwright and its Chromium in the plugin's data folder (a minute or
  two), then opens a window on GitHub's sign-in page.
- Tell the user to sign in there, two-factor step included, and wait: the script ends on its own
  once they are signed in, and prints the GitHub login. The window closes by itself.
- Exit code 1: the window was closed, or 10 minutes passed, before signing in. Ask the user
  whether to try again.

Run it again whenever a later step says the browser is signed out: GitHub ends sessions after a
few weeks.

The data folder holds the GitHub session: whoever copies it can act as the user. Never copy it,
print its contents, or put it in a repo.

## Posting the screenshots

TODO: the posting script (open the pull request, attach the PNG files, fill the text, capture the
preview for the user, send after their OK) is not written yet. Until it is, give the user the
paths of the PNG files to drop in the comment themselves.
