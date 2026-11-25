# claude-plugins

Claude Code plugins by [@ovski4](https://github.com/ovski4).

| Plugin                                                         | What it does                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [todo](plugins/todo)                                           | Claude works top-down, in steps small enough to review, and keeps the remaining work in a tree you open with `/todo`.                                                                                                                                                                               |
| [figma-component-inventory](plugins/figma-component-inventory) | `/figma-component-inventory <figma-url>` draws the component cut of a Figma screen: one outline per component, coloured by its frontend verdict (reused, to adapt, to create), for the developer to approve. `/figma-component-specs` then gives the props of each component to create or to adapt. |
| [github-pr-screenshots](plugins/github-pr-screenshots)         | Claude puts its validation screenshots in a GitHub pull request description, uploaded from a browser signed in to your account, after you approve them.                                                                                                                                             |

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
