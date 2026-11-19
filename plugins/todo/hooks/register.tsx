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

const STRUCK_ITEM = /^\s*[-*] ~~(?<title>.+?)~~/
const DONE_HEADER = /^Done: /

/**
 * Deletes the struck-through list items (`- ~~2.1 Skeleton~~ committed 5522348`),
 * with everything nested under them, and adds their titles ("2.1 Skeleton") to
 * the one-line "Done: " header, created under the tree's `#` title (or on the
 * first line) when missing. A tree without struck items comes back unchanged.
 */
export function pruneStruckItems(tree: string): string {
  const keptLines: string[] = []
  const prunedTitles: string[] = []
  // Indentation of the struck item being deleted: deeper lines go with it.
  let prunedItemIndent: number | undefined
  for (const line of tree.split('\n')) {
    const indent = /^\s*/.exec(line)![0].length
    const isNestedInPrunedItem =
      prunedItemIndent !== undefined && line.trim() !== '' && indent > prunedItemIndent
    if (isNestedInPrunedItem) continue
    prunedItemIndent = undefined

    const struckTitle = STRUCK_ITEM.exec(line)?.groups?.title
    if (struckTitle) {
      prunedTitles.push(struckTitle.trim())
      prunedItemIndent = indent
      continue
    }
    keptLines.push(line)
  }
  if (!prunedTitles.length) return tree

  const prunedList = prunedTitles.join(', ')
  const doneHeaderIndex = keptLines.findIndex(line => DONE_HEADER.test(line))
  const doneHeader = keptLines[doneHeaderIndex]
  if (doneHeader !== undefined) {
    keptLines[doneHeaderIndex] = `${doneHeader.trimEnd()}, ${prunedList}`
  } else {
    const titleIndex = keptLines.findIndex(line => line.startsWith('# '))
    const doneHeaderLines =
      titleIndex === -1 ? [`Done: ${prunedList}`] : ['', `Done: ${prunedList}`]
    keptLines.splice(titleIndex + 1, 0, ...doneHeaderLines)
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

async function composeWorkingMethod($: EngineInterface): Promise<string> {
  const workingMethod = await $.fs.read(
    `${$.plugin.root}/rules/working-method.md`,
  )
  const treeLocation = `This session's tree file: \`${await resolveTreePath($)}\`. Create it if it doesn't exist yet.`

  return `${workingMethod}\n${treeLocation}`
}

const WORKING_METHOD_BLOCK = 'todoWorkingMethod'

// Whether the `prompt.context` hook ran, so the working method is in the
// conversation's context blocks. Module-level: a reload resets it, and
// `session.start` asks for the context again so it is set back.
let hasContextBlock = false
// The session whose conversation got the working method beside a prompt, the
// fallback for when the `prompt.context` hook never runs.
let attachedSessionId: string | undefined

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'todo',
      description: "Show this session's remaining-work tree in a panel",
      // It only opens a panel, so it can run while Claude is mid-turn.
      immediate: true,
    })
    // An unchanged block is not sent again, so this only tells this module
    // whether its `prompt.context` hook still runs.
    $.ui.invalidate('prompt.context')

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

  // The working method the tree belongs to, with this session's tree path so
  // the model knows where to write: one of the conversation's context blocks,
  // sent once and again after a compaction.
  on('prompt.context', async ($, e, next) => {
    const result = await next(e)
    hasContextBlock = true

    return {
      ...result,
      blocks: [
        ...result.blocks.filter(block => block.name !== WORKING_METHOD_BLOCK),
        { name: WORKING_METHOD_BLOCK, text: await composeWorkingMethod($) },
      ],
    }
  })

  // In Team and Enterprise organizations, cc-plugin-sec-default sits above
  // user plugins and continues past their `prompt.compose` hook, and it hooks
  // `prompt.context` too. It leaves `prompt.submit` alone, so when the hook
  // above never ran, the working method goes beside the first prompt of each
  // session instead, where the model reads it and the person doesn't see it.
  on('prompt.submit', async ($, e, next) => {
    const sessionId = await $.session.id()
    // A slash command may never reach the model: wait for a typed prompt.
    if (hasContextBlock || attachedSessionId === sessionId || e.command)
      return next(e)

    const workingMethod = await composeWorkingMethod($)
    const result = await next({
      ...e,
      context: [...(e.context ?? []), workingMethod],
    })
    if (result.context?.includes(workingMethod)) attachedSessionId = sessionId

    return result
  })

  // A compaction summarizes the prompt the working method was attached to, so
  // it is attached again to the next one.
  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    const isMainConversationCompacted =
      !result.skip && e.trigger !== 'precompute' && !e.agentId
    if (isMainConversationCompacted) attachedSessionId = undefined

    return result
  })

  on('ui.render', { component: 'Pane', requestId: TREE_PANE }, async ($, e) => {
    const { Box, Button, Input, Markdown, Text } = $.ui.resolve(e)
    const treePath = await resolveTreePath($)
    if (!(await $.fs.exists(treePath)))
      return <Text dimColor>No remaining-work tree for this session yet.</Text>

    const tree = await $.fs.read(treePath)
    const prunedTree = pruneStruckItems(tree)
    const filteredTree = filterTreeLines(tree, treeSearchQuery)

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
        {prunedTree !== tree && (
          <Button
            key="prune"
            onPress={async () => {
              await $.fs.write(treePath, prunedTree)
              $.ui.invalidate('ui.render')
            }}
          >
            Prune done items
          </Button>
        )}
        {filteredTree ? (
          <Markdown text={filteredTree} />
        ) : (
          <Text dimColor>No item matches "{treeSearchQuery}".</Text>
        )}
      </Box>
    )
  })
}
