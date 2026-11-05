# claude-plugins

Claude Code plugins by [@ovski4](https://github.com/ovski4).

| Plugin | What it does |
| ------ | ------------ |
| [todo](plugins/todo) | Claude works top-down, in steps small enough to review, and keeps the remaining work in a tree you open with `/todo`. |

## Install

In Claude Code, add this repository as a marketplace once, then install a plugin by its name:

```
/plugin marketplace add ovski4/claude-plugins
/plugin install <plugin>@ovski4
```

Later versions arrive with `/plugin marketplace update ovski4`.

Then start a new session: a plugin loads when a session starts.

## License

[MIT](LICENSE)
