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
