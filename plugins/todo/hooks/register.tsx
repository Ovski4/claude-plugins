import type { EngineInterface, Register } from "claude-code"

const TREE_PANE = "todo-tree"
// Longer than any panel: the Text holding it cuts it to the panel's width.
const SECTION_LINE = "─".repeat(400)

// What the person typed in the panel's search field. Module-level, so a plugin
// reload empties it, which is fine for a search.
let treeSearchQuery = ""
// Whether the panel unfolds the done items. Module-level like the search: a
// reload folds them again.
let isDoneListShown = false

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
  for (const line of tree.split("\n")) {
    if (!/^\s*[-*] /.test(line)) continue
    const indent = line.length - line.trimStart().length
    while (parentItems.length && parentItems.at(-1)!.indent >= indent)
      parentItems.pop()
    const isMatch = line.toLowerCase().includes(needle)
    if (isMatch) {
      for (const parent of parentItems.filter((parent) => !parent.isKept)) {
        keptLines.push(parent.line)
        parent.isKept = true
      }
      keptLines.push(line)
    }
    parentItems.push({ indent, line, isKept: isMatch })
  }

  return keptLines.join("\n")
}

/** One part of the tree the panel draws apart, with a line between parts. */
export type TreeSection = {
  /** `title`: the `#` line; `prose`: one paragraph (the goal, what's out of scope, a note); `list`: the items */
  kind: "title" | "prose" | "list"
  text: string
}

/**
 * Cuts the tree into its title, each prose paragraph (empty lines end one), and
 * each run of list items, which empty lines between items don't end.
 */
export function splitTreeSections(tree: string): TreeSection[] {
  const sections: TreeSection[] = []
  let current: { kind: TreeSection["kind"]; lines: string[] } | undefined
  // Empty lines inside a run of items, kept only if another item follows.
  let pendingEmptyLines = 0
  const closeCurrent = () => {
    if (current)
      sections.push({ kind: current.kind, text: current.lines.join("\n") })
    current = undefined
    pendingEmptyLines = 0
  }
  for (const line of tree.split("\n")) {
    if (line.trim() === "") {
      if (current?.kind === "list") pendingEmptyLines++
      else closeCurrent()
      continue
    }
    if (line.startsWith("# ")) {
      closeCurrent()
      sections.push({ kind: "title", text: line })
      continue
    }
    // An indented line under an item belongs to that item.
    const isListLine =
      /^\s*[-*] /.test(line) || (current?.kind === "list" && /^\s/.test(line))
    const kind = isListLine ? "list" : "prose"
    if (current?.kind !== kind) closeCurrent()
    if (!current) current = { kind, lines: [] }
    current.lines.push(...Array<string>(pendingEmptyLines).fill(""), line)
    pendingEmptyLines = 0
  }
  closeCurrent()

  return sections
}

const STRUCK_ITEM = /^\s*[-*] ~~(?<title>.+?)~~(?<outcome>.*)$/
const DONE_HEADER = /^Done:(?<inlineItems>.*)$/
const DONE_ITEM = /^[-*] (?<item>.+)$/
// Separators of a one-line "Done: a · b" header: " · ", or ", " before an item
// number ("Done: 1 Skeleton, 2.1 Types"), so a comma inside an item stays.
const INLINE_DONE_SEPARATOR = / · |, (?=\d+(?:\.\d+)* )/

// "2.1 Skeleton — committed 5522348": the struck title, then its outcome.
function describeStruckItem(title: string, outcome: string): string {
  const trimmedOutcome = outcome.trim()
  return trimmedOutcome ? `${title.trim()} — ${trimmedOutcome}` : title.trim()
}

/**
 * Splits the tree into what's left and what's done. Done items come from the
 * "Done:" header (its bullets on the lines below it, or the items of an older
 * one-line "Done: a · b") and from the struck-through list items, which leave
 * the remaining tree with everything nested under them.
 */
export function splitDoneItems(tree: string): {
  remainingTree: string
  doneItems: string[]
} {
  const remainingLines: string[] = []
  const doneItems: string[] = []
  // Indentation of the struck item being skipped: deeper lines go with it.
  let struckItemIndent: number | undefined
  let isInDoneSection = false
  for (const line of tree.split("\n")) {
    if (isInDoneSection) {
      const doneItem = DONE_ITEM.exec(line)?.groups?.item
      if (doneItem) {
        doneItems.push(doneItem.trim())
        continue
      }
      isInDoneSection = false
    }
    const doneHeader = DONE_HEADER.exec(line)
    if (doneHeader) {
      const inlineItems = doneHeader.groups?.inlineItems?.trim()
      if (inlineItems)
        doneItems.push(...inlineItems.split(INLINE_DONE_SEPARATOR))
      else isInDoneSection = true
      continue
    }

    const indent = line.length - line.trimStart().length
    const isNestedInStruckItem =
      struckItemIndent !== undefined &&
      line.trim() !== "" &&
      indent > struckItemIndent
    if (isNestedInStruckItem) continue
    struckItemIndent = undefined

    const struckItem = STRUCK_ITEM.exec(line)?.groups
    if (struckItem?.title) {
      doneItems.push(
        describeStruckItem(struckItem.title, struckItem.outcome ?? ""),
      )
      struckItemIndent = indent
      continue
    }
    remainingLines.push(line)
  }

  return { remainingTree: remainingLines.join("\n"), doneItems }
}

/**
 * Deletes the struck-through list items (`- ~~2.1 Skeleton~~ committed 5522348`),
 * with everything nested under them, and lists them under the "Done:" header,
 * one bullet each ("- 2.1 Skeleton — committed 5522348"), after the items it
 * already had. The header goes under the tree's `#` title (or on the first
 * line). A tree without struck items comes back unchanged.
 */
export function pruneStruckItems(tree: string): string {
  if (!tree.split("\n").some((line) => STRUCK_ITEM.test(line))) return tree

  const { remainingTree, doneItems } = splitDoneItems(tree)
  const remainingLines = remainingTree.split("\n")
  const titleIndex = remainingLines.findIndex((line) => line.startsWith("# "))
  // The empty lines around the old header: one is put back after the section.
  while (remainingLines[titleIndex + 1] === "")
    remainingLines.splice(titleIndex + 1, 1)
  const doneSection = ["Done:", ...doneItems.map((item) => `- ${item}`), ""]
  remainingLines.splice(
    titleIndex + 1,
    0,
    ...(titleIndex === -1 ? doneSection : ["", ...doneSection]),
  )

  return remainingLines.join("\n")
}

/**
 * Where Claude writes each session's remaining-work tree, one file per session
 * id: `todo/` in Claude Code's config folder, `~/.claude` unless
 * `CLAUDE_CONFIG_DIR` moves it.
 */
async function resolveTreesDir($: EngineInterface): Promise<string> {
  const configDir =
    (await $.env.get("CLAUDE_CONFIG_DIR")) ??
    `${await $.env.get("HOME")}/.claude`
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

const WORKING_METHOD_BLOCK = "todoWorkingMethod"

// Whether the `prompt.context` hook ran, so the working method is in the
// conversation's context blocks. Module-level: a reload resets it, and
// `session.start` asks for the context again so it is set back.
let hasContextBlock = false
// The session whose conversation got the working method beside a prompt, the
// fallback for when the `prompt.context` hook never runs.
let attachedSessionId: string | undefined

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "todo",
      description: "Show this session's remaining-work tree in a panel",
      // It only opens a panel, so it can run while Claude is mid-turn.
      immediate: true,
    })
    // An unchanged block is not sent again, so this only tells this module
    // whether its `prompt.context` hook still runs.
    $.ui.invalidate("prompt.context")

    return next(e)
  })

  // Answered here, without `next`: the model never runs, and the tree is drawn
  // in a panel, which keeps it out of the conversation the model reads.
  on("command.run", { command: "todo" }, async ($) => {
    const opened = await $.ui.open({ id: TREE_PANE, title: "Remaining work" })
    // The pane may already be open on an older tree.
    $.ui.invalidate("ui.render")

    return opened.isPlaced
      ? {}
      : { text: `todo: no panel here (${opened.reason})` }
  })

  // Claude rewrites the tree with a tool call: redraw after each one, and at
  // the end of each turn, so the panel follows without being reopened.
  on("tool.call", async ($, e, next) => {
    const result = await next(e)
    $.ui.invalidate("ui.render")

    return result
  })

  on("turn.complete", async ($, e, next) => {
    const result = await next(e)
    $.ui.invalidate("ui.render")

    return result
  })

  // The working method the tree belongs to, with this session's tree path so
  // the model knows where to write: one of the conversation's context blocks,
  // sent once and again after a compaction.
  on("prompt.context", async ($, e, next) => {
    const result = await next(e)
    hasContextBlock = true

    return {
      ...result,
      blocks: [
        ...result.blocks.filter((block) => block.name !== WORKING_METHOD_BLOCK),
        { name: WORKING_METHOD_BLOCK, text: await composeWorkingMethod($) },
      ],
    }
  })

  // In Team and Enterprise organizations, cc-plugin-sec-default sits above
  // user plugins and continues past their `prompt.compose` hook, and it hooks
  // `prompt.context` too. It leaves `prompt.submit` alone, so when the hook
  // above never ran, the working method goes beside the first prompt of each
  // session instead, where the model reads it and the person doesn't see it.
  on("prompt.submit", async ($, e, next) => {
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
  on("session.compact", async ($, e, next) => {
    const result = await next(e)
    const isMainConversationCompacted =
      !result.skip && e.trigger !== "precompute" && !e.agentId
    if (isMainConversationCompacted) attachedSessionId = undefined

    return result
  })

  on("ui.render", { component: "Pane", requestId: TREE_PANE }, async ($, e) => {
    const { Box, Button, Input, Markdown, Text } = $.ui.resolve(e)
    const treePath = await resolveTreePath($)
    if (!(await $.fs.exists(treePath)))
      return <Text dimColor>No remaining-work tree for this session yet.</Text>

    const tree = await $.fs.read(treePath)
    const prunedTree = pruneStruckItems(tree)
    // What's left comes first; the done items wait folded under it.
    const { remainingTree, doneItems } = splitDoneItems(tree)
    const filteredTree = filterTreeLines(remainingTree, treeSearchQuery)
    const searchedText = treeSearchQuery.trim().toLowerCase()
    const shownDoneItems = doneItems.filter((item) =>
      item.toLowerCase().includes(searchedText),
    )

    return (
      <Box flexDirection="column">
        <Input
          key="search"
          placeholder="Filter items…"
          value={treeSearchQuery}
          onInput={(query) => {
            treeSearchQuery = query
            $.ui.invalidate("ui.render")
          }}
          onSubmit={() => {}}
        />
        {prunedTree !== tree && (
          <Button
            key="prune"
            onPress={async () => {
              await $.fs.write(treePath, prunedTree)
              $.ui.invalidate("ui.render")
            }}
          >
            Prune done items
          </Button>
        )}
        {filteredTree ? (
          splitTreeSections(filteredTree).flatMap(
            (section, index, sections) => [
              // A thin line between parts; the title sits on the part below it.
              index > 0 && sections[index - 1]?.kind !== "title" && (
                <Text dimColor wrap="truncate">
                  {SECTION_LINE}
                </Text>
              ),
              section.kind === "list" &&
                sections.findIndex(({ kind }) => kind === "list") === index && (
                  <Text weight="semibold">Todo items:</Text>
                ),
              <Markdown key={`section-${index}`} text={section.text} />,
            ],
          )
        ) : (
          <Text dimColor>No item matches "{treeSearchQuery}".</Text>
        )}
        {shownDoneItems.length > 0 && (
          <Button
            key="done"
            onPress={() => {
              isDoneListShown = !isDoneListShown
              $.ui.invalidate("ui.render")
            }}
          >
            {`${isDoneListShown ? "▾" : "▸"} Done (${shownDoneItems.length})`}
          </Button>
        )}
        {isDoneListShown && shownDoneItems.length > 0 && (
          <Markdown
            text={shownDoneItems.map((item) => `- ${item}`).join("\n")}
          />
        )}
      </Box>
    )
  })
}
