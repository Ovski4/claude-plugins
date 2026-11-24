# github-pr-screenshots — validation screenshots in a GitHub pull request comment

Claude posts the screenshots that show its work (PNG captures of a page, a component, a report)
in a comment of a GitHub pull request, the way you would by dropping them in the comment box.

GitHub's API can't attach images to a comment, so the scripts drive a Chromium browser signed in
to your GitHub account. The images are uploaded by GitHub's page itself: nothing is committed to
the repo, and they are visible only to people who can see the pull request.

Call it with `/github-pr-screenshots <owner/repo> <pr-number> <png-file>...`, or ask Claude to put
screenshots on a pull request.

It runs on Claude Haiku: the scripts do the work, the model only runs them and relays the preview.
In Claude Code, the `model` field of `SKILL.md` selects it; a tool that ignores that field runs
the skill on its current model.

## Before the first post

Claude runs the sign-in script: a window opens on GitHub's sign-in page, you sign in once (two-factor
step included), and the window closes. The session is kept until GitHub ends it, usually after a
few weeks; Claude asks you to sign in again then.

## Your account, your OK

- Comments are posted **under your name**. Claude shows you each comment, text and images, and
  sends it only after you say yes.
- The browser profile holds your GitHub session. It lives in the plugin's data folder
  (`~/.claude/plugins/data/github-pr-screenshots-ovski4/`), outside any repo. Whoever copies that
  folder can act as you: keep it on your machine. Delete it to sign out for good.

## What it needs

| Needed                 | Why                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Node 20 or later       | To run the scripts.                                                                   |
| npm and network access | The first run installs Playwright and its Chromium (about 150 MB) in the data folder. |
| A GitHub account       | Signed in once in the window the plugin opens.                                        |
