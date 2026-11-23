// @ts-check
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildFigmaNodeUrl,
  locateCapture,
  parseFigmaUrl,
} from "../scripts/lib/figma.mjs"

test("a Figma link gives the file key and the node id, and a node id gives its link back", () => {
  const link =
    "https://www.figma.com/design/AbCdEfGhIjKlMnOpQrStUv/Shop?node-id=87-91461&m=dev"

  assert.deepEqual(parseFigmaUrl(link), {
    fileKey: "AbCdEfGhIjKlMnOpQrStUv",
    nodeId: "87:91461",
  })
  assert.equal(
    buildFigmaNodeUrl("AbCdEfGhIjKlMnOpQrStUv", "I87:91461;585:20047"),
    "https://www.figma.com/design/AbCdEfGhIjKlMnOpQrStUv/?node-id=I87-91461%3B585-20047",
  )
  assert.throws(
    () =>
      parseFigmaUrl("https://www.figma.com/design/AbCdEfGhIjKlMnOpQrStUv/Shop"),
    /No file key or node-id/,
  )
})

test("the capture is located from its size: larger than the screen when the screen has a shadow", () => {
  const screenNode = {
    id: "87:91461",
    name: "Editor",
    type: "FRAME",
    absoluteBoundingBox: { x: 1000, y: 500, width: 480, height: 420 },
    absoluteRenderBounds: { x: 976, y: 484, width: 528, height: 468 },
  }

  assert.deepEqual(
    locateCapture(screenNode, { widthPx: 1056, heightPx: 936 }),
    {
      file: "screen.png",
      x: -24,
      y: -16,
      width: 528,
      height: 468,
    },
  )
  assert.deepEqual(locateCapture(screenNode, { widthPx: 960, heightPx: 840 }), {
    file: "screen.png",
    x: 0,
    y: 0,
    width: 480,
    height: 420,
  })
  assert.throws(
    () => locateCapture(screenNode, { widthPx: 300, heightPx: 300 }),
    /matches neither/,
  )
})
