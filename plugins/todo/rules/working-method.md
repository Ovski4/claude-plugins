# Working method: big picture, then smaller steps

Work the way people tackle things too big to do at once: start from the big picture, break it into tasks, break each task into smaller tasks, and so on, until each piece is small enough to do and review in one sitting. It also lets the user follow every change.

Apply it on every task (code, docs, investigations), unless the user says otherwise for a task.

## 1. Big picture first

Before any code, doc or investigation, state the goal in one or two sentences and the main parts it needs (for a feature: data, logic, UI, API, docs). Nothing is written yet at this level.

## 2. Break down, level by level

Split each part into tasks, then sub-tasks, until every leaf:

- has one clear purpose that can be said in a sentence;
- can be reviewed on its own, in under 300 lines;
- leaves the repo in a state the user can read, even if the code doesn't work yet.

Show the breakdown to the user and agree on it, and on which leaf comes first, before writing anything. Don't go deeper than needed: a leaf that is already small stays a leaf.

## 3. The 300-line stop

- A leaf is at most 300 added or edited lines. Moved lines and styles (CSS) don't count; code, tests and translations do.
- Estimate before writing. If a leaf is bigger, it isn't a leaf yet: stop and break it down further with the user.
- Re-check while working: if a step grows past 300, stop there. Code that doesn't work yet is fine at the end of a step.
- Count the branch's diff against the main branch (what the pull request would show), not each step: stop as soon as the branch's own changes reach 300. When other open pull requests are merged into the branch, count only its own work (diff against the main branch plus those branches, e.g. via `git merge-tree --write-tree`).

## 4. Top-down inside the code too

The code equivalent of the big picture comes first:

- a skeleton: files with signatures, types and unimplemented functions, to agree on the code design;
- types and contracts (props, request body, config fields) before implementation;
- test names only (`it.todo`) to agree on behavior before writing code or tests;
- then fill in one function or one sub-task at a time.

Other ways to cut a leaf: a pure move or refactor in its own step (a reviewer only checks it's a move); pure logic before the UI, the UI before the backend; a stub instead of the real call; a thin end-to-end slice, then widen; polish (second language, styles, edge cases) in its own step.

## 5. Remaining work as a tree, in a session file

The remaining work lives in this session's tree file (path below). The user reads it with `/todo`, which opens it in a panel without going through the model.

- A numbered list that mirrors the breakdown: the big goal on top, its parts numbered (1, 2, 3), sub-tasks nested (2.1, 2.2). Mark what's next. Mark with "(you)" what waits on the user.
- Remove what's done or dropped, and sum it up in a one-line « Done: » header instead. No strikethrough: struck lines make what's left hard to read.
- Add what's discovered. When a new need shows up mid-task, put it in the tree instead of doing it on the spot, unless it blocks the current leaf.
- Every sub-point on its own line, as a real nested markdown list item (`- 1.2 …`, indented under its parent). A bare `1.2 …` line under a list item is not a list item: markdown joins it to the line above.
- Keep item numbers stable: never renumber or reorder existing items, append new ones with the next free number. The user answers by number ("skip 3.6"), and a renumbered tree makes that answer point at other items.
- When offering options in a reply, label them with their tree numbers, never a fresh 1/2/3 list; a new option first gets its own number in the tree.
- **Update the file after every change** to the work (an item done, added, split, renamed or blocked), in the same turn, before replying. That includes anything proposed or left to the user's call: it goes in the tree as an item, never only in the reply.
- A new session starts a new file: copy the open items from the previous session's file when the work continues.
- Replies don't print the tree. They end with one line: `Next: <number + item> · waiting on you: <items marked (you)> · /todo for the rest`. Every item named there exists in the file.

## 6. Inside skills

- When a skill's flow says to go on in one go but this method says to stop (a leaf past 300 lines, a breakdown not agreed yet), don't pick a winner: ask the user which to follow.
- When a skill starts, its steps go into the tree. The tree is the bookmark: after a pause, an interruption or a context compaction, it shows which skill steps are done and which is next.
- A skill that runs in a subagent can't stop to ask mid-way. Before starting one that writes code, agree with the user on a scope small enough (≤ 300 lines).
- If a skill's step can't be cut without breaking it, ask the user instead of guessing.
- Read-only skills (review, explanation) write no code: the 300-line stop doesn't apply, the tree does.

## Why

The user reviews every change before it is committed. Large diffs can't be reviewed without fatigue: review research puts the limit around 200–400 lines, or an hour of reading, per sitting. Working from the big picture down keeps each step understandable and shows where it fits. A tree in a file survives context compaction and stays available on demand, and the `Next:` line keeps the file honest.
