import { expect, test } from "claude-code/testing"
import {
  filterTreeLines,
  pruneStruckItems,
  splitDoneItems,
  splitTreeSections,
} from "./register"

const TREE = `# Title

Goal: some prose.

- 2 Decoder
  - 2.1 Check codec values
  - 2.2 Test names
- 3 Error codes
  - 3.1 Skeleton
    - 3.1.1 Union type for codec
- 4 Offline`

test("keeps matching items with their parents, drops prose", async () => {
  expect(filterTreeLines(TREE, "CODEC")).toBe(
    `- 2 Decoder
  - 2.1 Check codec values
- 3 Error codes
  - 3.1 Skeleton
    - 3.1.1 Union type for codec`,
  )
  expect(filterTreeLines(TREE, "nothing")).toBe("")
  expect(filterTreeLines(TREE, "  ")).toBe(TREE)
})

test("cuts the tree into its title, prose paragraphs and runs of items", async () => {
  expect(
    splitTreeSections(`# Title

Goal: some prose
on two lines.

Out of scope: more prose.

- 1 Decoder
  - 1.1 Check codec values
    continued under 1.1

- 2 Errors

Notes: after the list.`),
  ).toEqual([
    { kind: "title", text: "# Title" },
    { kind: "prose", text: "Goal: some prose\non two lines." },
    { kind: "prose", text: "Out of scope: more prose." },
    {
      kind: "list",
      text: "- 1 Decoder\n  - 1.1 Check codec values\n    continued under 1.1\n\n- 2 Errors",
    },
    { kind: "prose", text: "Notes: after the list." },
  ])
})

test("splits the remaining tree from the done items, one-line header included", async () => {
  expect(
    splitDoneItems(`# Title

Done: 1 Skeleton, 2.1 Types · NC-12 guard (#80, merged)

- 2 Decoder
  - ~~2.2 Test names~~ committed 5522348
    - 2.2.1 Union type
  - 2.3 Errors`),
  ).toEqual({
    remainingTree: `# Title


- 2 Decoder
  - 2.3 Errors`,
    doneItems: [
      "1 Skeleton",
      "2.1 Types",
      "NC-12 guard (#80, merged)",
      "2.2 Test names — committed 5522348",
    ],
  })
  expect(splitDoneItems(TREE)).toEqual({ remainingTree: TREE, doneItems: [] })
})

test("prunes struck items with their children into the Done bullets", async () => {
  expect(
    pruneStruckItems(`# Title

- ~~1 Skeleton~~ committed 5522348
  - 1.1 Types
- 2 Decoder
  - ~~2.1 Check codec values~~ dropped
  - 2.2 Test names`),
  ).toBe(`# Title

Done:
- 1 Skeleton — committed 5522348
- 2.1 Check codec values — dropped

- 2 Decoder
  - 2.2 Test names`)
  expect(
    pruneStruckItems(
      "# Title\n\nDone:\n- 1 Skeleton\n\n- 2 Decoder\n- ~~3 Errors~~",
    ),
  ).toBe("# Title\n\nDone:\n- 1 Skeleton\n- 3 Errors\n\n- 2 Decoder")
  expect(pruneStruckItems(TREE)).toBe(TREE)
})

test("the panel draws what is left, lines between parts, and folds the done items", async ($, on) => {
  on("env.get", (_, e) => ({
    value: e.name === "HOME" ? "/home/me" : undefined,
  }))
  on("session.id", () => ({ value: "s3" }))
  on("fs.exists", () => ({ value: true }))
  on("fs.read", () => ({
    value: `# Title

Done:
- 1 Skeleton — committed 5522348

Goal: some prose.

Out of scope: more prose.

- 2 Decoder
  - ~~2.1 Types~~ dropped
  - 2.2 Test names`,
  }))

  const ui = await $.ui.mount({
    plugin: "todo",
    component: "Pane",
    requestId: "todo-tree",
    props: {
      title: "Remaining work",
      isFocused: false,
      bodyColumns: 40,
      placement: "dock",
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
    surface: "terminal",
  })
  expect((await ui.find({ type: "Text", text: /^Todo items:$/ }))?.text).toBe(
    "Todo items:",
  )
  expect(await ui.find({ type: "Text", text: /^─+$/ })).toBeDefined()
  expect(await ui.find({ type: "Button", text: /Done \(2\)/ })).toBeDefined()
  expect(await ui.find({ type: "Markdown", text: /Skeleton/ })).toBeUndefined()
  await ui.unmount()
})

const SUBMISSION = { wait: false, origin: { kind: "composer" } } as const

test("attaches the working method beside the first prompt when its context hook never ran", async ($, on) => {
  on("fs.read", () => ({ value: "RULES" }))
  on("env.get", (_, e) => ({
    value: e.name === "HOME" ? "/home/me" : undefined,
  }))
  on("session.id", () => ({ value: "s1" }))
  on("prompt.submit", (_, e) => ({ text: e.text, context: e.context }))

  const first = await $.prompt.submit({ ...SUBMISSION, text: "hello" })
  expect(first.context).toHaveLength(1)
  expect(first.context?.[0]).toContain("RULES")
  expect(first.context?.[0]).toContain("/home/me/.claude/todo/s1.md")

  const second = await $.prompt.submit({ ...SUBMISSION, text: "again" })
  expect(second.context ?? []).toEqual([])
})

test("adds the working method to the context blocks, then not beside prompts", async ($, on) => {
  on("fs.read", () => ({ value: "RULES" }))
  on("env.get", (_, e) => ({
    value: e.name === "HOME" ? "/home/me" : undefined,
  }))
  on("session.id", () => ({ value: "s2" }))
  on("prompt.context", () => ({
    blocks: [{ name: "currentDate", text: "today" }],
  }))
  on("prompt.submit", (_, e) => ({ text: e.text, context: e.context }))

  const { blocks } = await $.prompt.context({ blocks: [] })
  expect(blocks.map((block) => block.name)).toEqual([
    "currentDate",
    "todoWorkingMethod",
  ])
  const workingMethod = blocks.find(
    (block) => block.name === "todoWorkingMethod",
  )
  expect(workingMethod?.text).toContain("RULES")
  expect(workingMethod?.text).toContain("/home/me/.claude/todo/s2.md")

  const submitted = await $.prompt.submit({ ...SUBMISSION, text: "hello" })
  expect(submitted.context ?? []).toEqual([])
})
