# todo

Makes Claude work top-down: big picture first, then tasks and sub-tasks until each step is small enough to review (300 lines at most), agreed with you before any code is written. Claude keeps the remaining work as a numbered tree in a file per session, and `/todo` shows that tree in a panel, instantly, without going through the model.

- The rules Claude follows: [`rules/working-method.md`](rules/working-method.md). They are added to Claude's system prompt in every session.
- The trees: `~/.claude/todo/<session-id>.md` (or `$CLAUDE_CONFIG_DIR/todo/` when that variable is set).
- Claude's replies end with a `Next:` line instead of the whole tree; type `/todo` to see it.

## Install

```
/plugin install todo --marketplace ovski4/claude-plugins
```

Then start a new session: the plugin loads when a session starts.
