# github-pr-screenshots — validation screenshots in a GitHub pull request description

Claude puts the screenshots that show its work (PNG captures of a page, a component, a report)
in the description of a GitHub pull request, each under a short caption.

GitHub's API can't upload images, so the scripts drive a Chromium browser signed in to your
GitHub account. The images are uploaded by GitHub's page itself, the way you would by dropping
them in a comment box (no comment is sent): nothing is committed to the repo, and they are
visible only to people who can see the pull request. The description is then written with
GitHub's `gh` command.

The place is fixed by the scripts, not chosen by the model: the placeholder your pull request
template leaves (see Settings), else a `<!-- screenshots -->` line in the description, else a
« Screenshots » section at the end. Running it again on the same pull request replaces the
earlier screenshots.

Call it with `/github-pr-screenshots <owner/repo> <pr-number> <png-file>...`, or ask Claude to put
screenshots on a pull request.

It runs on Claude Haiku: the scripts do the work, the model only runs them and relays the block to approve.
In Claude Code, the `model` field of `SKILL.md` selects it; a tool that ignores that field runs
the skill on its current model.

## Before the first use

Claude runs the sign-in script: a window opens on GitHub's sign-in page, you sign in once (two-factor
step included), and the window closes. The session is kept until GitHub ends it, usually after a
few weeks; Claude asks you to sign in again then.

## Your account, your OK

- The description is changed **under your name**. Claude shows you the screenshots block and the
  PNG files, and writes it only after you say yes. If someone edits the description in between,
  nothing is written and Claude prepares the block again.
- The browser profile holds your GitHub session. It lives in the plugin's data folder
  (`~/.claude/plugins/data/github-pr-screenshots-ovski4/`), outside any repo. Whoever copies that
  folder can act as you: keep it on your machine. Delete it to sign out for good.

## What it needs

| Needed                 | Why                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Node 20 or later       | To run the scripts.                                                                   |
| npm and network access | The first run installs Playwright and its Chromium (about 150 MB) in the data folder. |
| A GitHub account       | Signed in once in the window the plugin opens.                                        |
| The `gh` command       | Signed in to the same account, to read and write the description.                     |

## Settings

Optional. A repo whose pull request template leaves a placeholder for screenshots names it in
`.claude/github-pr-screenshots.json`, at the root of the repo; the screenshots replace it. The
text must match the description exactly, line breaks and indentation included:

```json
{
  "screenshotsPlaceholder": "- <!-- SCREENSHOT PLACEHOLDER -->\n  ![screenshot](<!-- url -->)"
}
```

The scripts read the settings of the repo they are run from.
