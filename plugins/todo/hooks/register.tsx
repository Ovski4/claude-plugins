import type { EngineInterface, Register } from 'claude-code'

const TREE_PANE = 'todo-tree'

// What the person typed in the panel's search field. Module-level, so a plugin
// reload empties it, which is fine for a search.
let treeSearchQuery = ''

/**
 * Keeps the tree's list items whose text contains `query` (any case), with the
 * parent items above each one so it stays readable; the prose around the list
 * is dropped. An empty query returns the tree unchanged.
 */
export function filterTreeLines(tree: string, query: string): string {
  const needle = query.trim().toLowerCase()
  if (!needle) return tree

  const keptLines: string[] = []
  // The item lines above the current one, one per indentation level.
  const parentItems: { indent: number; line: string; isKept: boolean }[] = []
  for (const line of tree.split('\n')) {
    const listItem = /^(\s*)[-*] /.exec(line)
    if (!listItem) continue
    const indent = listItem[1].length
    while (parentItems.length && parentItems.at(-1)!.indent >= indent)
      parentItems.pop()
    const isMatch = line.toLowerCase().includes(needle)
    if (isMatch) {
      for (const parent of parentItems.filter(parent => !parent.isKept)) {
        keptLines.push(parent.line)
        parent.isKept = true
      }
      keptLines.push(line)
    }
    parentItems.push({ indent, line, isKept: isMatch })
  }

  return keptLines.join('\n')
}

/**
 * Where Claude writes each session's remaining-work tree, one file per session
 * id: `todo/` in Claude Code's config folder, `~/.claude` unless
 * `CLAUDE_CONFIG_DIR` moves it.
 */
async function resolveTreesDir($: EngineInterface): Promise<string> {
  const configDir =
    (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${await $.env.get('HOME')}/.claude`
  return `${configDir}/todo`
}

async function resolveTreePath($: EngineInterface): Promise<string> {
  return `${await resolveTreesDir($)}/${await $.session.id()}.md`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'todo',
      description: "Show this session's remaining-work tree in a panel",
      // It only opens a panel, so it can run while Claude is mid-turn.
      immediate: true,
    })

    return next(e)
  })

  // Answered here, without `next`: the model never runs, and the tree is drawn
  // in a panel, which keeps it out of the conversation the model reads.
  on('command.run', { command: 'todo' }, async $ => {
    const opened = await $.ui.open({ id: TREE_PANE, title: 'Remaining work' })
    // The pane may already be open on an older tree.
    $.ui.invalidate('ui.render')

    return opened.isPlaced ? {} : { text: `todo: no panel here (${opened.reason})` }
  })

  // Claude rewrites the tree with a tool call: redraw after each one, and at
  // the end of each turn, so the panel follows without being reopened.
  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    $.ui.invalidate('ui.render')

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    $.ui.invalidate('ui.render')

    return result
  })

  // The working method the tree belongs to, added after the engine's own
  // sections with this session's tree path, so the model knows where to write.
  on('prompt.compose', async ($, e, next) => {
    const { sections } = await next(e)
    const workingMethod = await $.fs.read(
      `${$.plugin.root}/rules/working-method.md`,
    )
    const treeLocation = `This session's tree file: \`${await resolveTreePath($)}\`. Create it if it doesn't exist yet.`

    return {
      sections: [
        ...sections,
        {
          id: 'todo:working-method',
          text: `${workingMethod}\n${treeLocation}`,
          scope: 'session',
        },
      ],
    }
  })

  on('ui.render', { component: 'Pane', requestId: TREE_PANE }, async ($, e) => {
    const { Box, Button, Input, Markdown, Text } = $.ui.resolve(e)
    const treePath = await resolveTreePath($)
    const refreshButton = (
      <Button key="refresh" onPress={() => $.ui.invalidate('ui.render')}>
        Refresh
      </Button>
    )
    if (!(await $.fs.exists(treePath)))
      return (
        <Box flexDirection="column">
          {refreshButton}
          <Text dimColor>No remaining-work tree for this session yet.</Text>
        </Box>
      )

    const filteredTree = filterTreeLines(
      await $.fs.read(treePath),
      treeSearchQuery,
    )

    return (
      <Box flexDirection="column">
        <Input
          key="search"
          placeholder="Filter items…"
          value={treeSearchQuery}
          onInput={query => {
            treeSearchQuery = query
            $.ui.invalidate('ui.render')
          }}
          onSubmit={() => {}}
        />
        {refreshButton}
        {filteredTree ? (
          <Markdown text={filteredTree} />
        ) : (
          <Text dimColor>No item matches "{treeSearchQuery}".</Text>
        )}
      </Box>
    )
  })
}
