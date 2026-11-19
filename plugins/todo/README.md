# todo

Makes Claude work top-down: big picture first, then tasks and sub-tasks until each step is small enough to review (300 lines at most), agreed with you before any code is written. Claude keeps the remaining work as a numbered tree in a file per session, and `/todo` shows that tree in a panel, instantly, without going through the model.

- The rules Claude follows: [`rules/working-method.md`](rules/working-method.md). They are added to every conversation's context, once (again after a compaction). In Team and Enterprise organizations, where Claude Code's built-in `cc-plugin-sec-default` keeps a plugin out of that context, they are attached beside the first prompt of the session instead.
- The trees: `~/.claude/todo/<session-id>.md` (or `$CLAUDE_CONFIG_DIR/todo/` when that variable is set).
- Claude's replies end with a `Next:` line instead of the whole tree; type `/todo` to see it.
- Done items are struck through and stay in the tree. Claude offers to prune them once they reach 40 % of the items; you can also ask for it at any time ("prune the tree"), or press « Prune done items » in the `/todo` panel, which moves their titles to the « Done: » line without asking Claude.

## Install

```
/plugin marketplace add ovski4/claude-plugins
/plugin install todo@ovski4
```

Then start a new session: the plugin loads when a session starts.
