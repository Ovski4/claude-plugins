import { expect, test } from 'claude-code/testing'
import { filterTreeLines } from './register'

const TREE = `# Title

Goal: some prose.

- 2 Decoder
  - 2.1 Check codec values
  - 2.2 Test names
- 3 Error codes
  - 3.1 Skeleton
    - 3.1.1 Union type for codec
- 4 Offline`

test('keeps matching items with their parents, drops prose', async () => {
  expect(filterTreeLines(TREE, 'CODEC')).toBe(
    `- 2 Decoder
  - 2.1 Check codec values
- 3 Error codes
  - 3.1 Skeleton
    - 3.1.1 Union type for codec`,
  )
  expect(filterTreeLines(TREE, 'nothing')).toBe('')
  expect(filterTreeLines(TREE, '  ')).toBe(TREE)
})

const SUBMISSION = { wait: false, origin: { kind: 'composer' } } as const

test('attaches the working method beside the first prompt when its context hook never ran', async ($, on) => {
  on('fs.read', () => ({ value: 'RULES' }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/home/me' : undefined }))
  on('session.id', () => ({ value: 's1' }))
  on('prompt.submit', (_, e) => ({ text: e.text, context: e.context }))

  const first = await $.prompt.submit({ ...SUBMISSION, text: 'hello' })
  expect(first.context).toHaveLength(1)
  expect(first.context?.[0]).toContain('RULES')
  expect(first.context?.[0]).toContain('/home/me/.claude/todo/s1.md')

  const second = await $.prompt.submit({ ...SUBMISSION, text: 'again' })
  expect(second.context ?? []).toEqual([])
})

test('adds the working method to the context blocks, then not beside prompts', async ($, on) => {
  on('fs.read', () => ({ value: 'RULES' }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/home/me' : undefined }))
  on('session.id', () => ({ value: 's2' }))
  on('prompt.context', () => ({ blocks: [{ name: 'currentDate', text: 'today' }] }))
  on('prompt.submit', (_, e) => ({ text: e.text, context: e.context }))

  const { blocks } = await $.prompt.context({ blocks: [] })
  expect(blocks.map(block => block.name)).toEqual(['currentDate', 'todoWorkingMethod'])
  const workingMethod = blocks.find(block => block.name === 'todoWorkingMethod')
  expect(workingMethod?.text).toContain('RULES')
  expect(workingMethod?.text).toContain('/home/me/.claude/todo/s2.md')

  const submitted = await $.prompt.submit({ ...SUBMISSION, text: 'hello' })
  expect(submitted.context ?? []).toEqual([])
})
