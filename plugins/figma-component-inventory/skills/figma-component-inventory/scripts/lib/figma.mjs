// @ts-check
// Everything that knows how Figma is addressed and what its REST API answers: links to a
// node, authenticated calls, the node tree and the capture of a screen, both kept on disk so
// that a second run calls nothing.
import fs from "node:fs"
import path from "node:path"

/** @typedef {{ x: number, y: number, width: number, height: number }} Box */
/** @typedef {{ widthPx: number, heightPx: number }} PixelSize */
/**
 * Where the capture file sits in the screen's coordinates (pixels at scale 1 from the
 * screen's top-left corner): it starts above and left of the screen when the screen has a shadow.
 * @typedef {Box & { file: string }} CaptureLocation
 */
/**
 * The part of a Figma node this folder reads.
 * @typedef {object} FigmaNode
 * @property {string} id
 * @property {string} name
 * @property {string} type "INSTANCE", "FRAME", "TEXT"…
 * @property {boolean} [visible] false when the designer hid the layer; absent otherwise
 * @property {boolean} [clipsContent] true when the node hides what overflows its box
 * @property {Box | null} [absoluteBoundingBox] the node's box, in the page's coordinates
 * @property {Box | null} [absoluteRenderBounds] what the node paints, shadow included
 * @property {string} [componentId] for an INSTANCE, the component it is an instance of
 * @property {string} [characters] for a TEXT, what it says
 * @property {FigmaNode[]} [children] from back to front
 */
/** @typedef {{ name: string, componentSetId?: string }} FigmaComponent */
/**
 * @typedef {object} FigmaScreen
 * @property {FigmaNode} screenNode
 * @property {Record<string, FigmaComponent>} componentsById
 * @property {Record<string, { name: string }>} componentSetsById
 * @property {string} version changes each time the Figma file is saved
 * @property {string} lastModified ISO date
 */
/**
 * @typedef {object} FigmaAccess
 * @property {string | undefined} token a Figma personal access token that can read the file
 * @property {string} cacheDir where the answers are kept
 * @property {boolean} mustAskFigmaAgain true to ignore what is kept in cacheDir
 */

const FIGMA_API = "https://api.figma.com/v1"
const FIGMA_SITE = "https://www.figma.com"
const HTTP_STATUS_FORBIDDEN = 403
// How many levels of the file are read to find the frames beside a screen: a page, the
// sections nested in it, then the screens.
const FILE_DEPTHS_TRIED_TO_FIND_A_SCREEN = [3, 5]
// What a designer draws a screen with.
const SCREEN_NODE_TYPES = ["FRAME", "INSTANCE", "COMPONENT"]
// Pixels of the capture per pixel of the screen: 2 keeps small texts readable when zooming.
const CAPTURE_SCALE = 2
// A PNG file stores its width and height as two 4-byte integers at these positions.
const PNG_WIDTH_BYTE_OFFSET = 16
const PNG_HEIGHT_BYTE_OFFSET = 20

/**
 * @param {string} url a link copied from Figma, e.g. https://www.figma.com/design/<key>/<name>?node-id=87-91461
 * @returns {{ fileKey: string, nodeId: string }} nodeId in the API's form, "87:91461"
 */
export function parseFigmaUrl(url) {
  const { pathname, searchParams } = new URL(url)
  const fileKey = pathname.match(/\/(?:design|file)\/([^/]+)/)?.[1]
  const nodeId = searchParams.get("node-id")?.replace(/-/g, ":")
  if (!fileKey || !nodeId) throw new Error(`No file key or node-id in ${url}`)
  return { fileKey, nodeId }
}

/**
 * @param {string} fileKey
 * @param {string} nodeId in the API's form, "87:91461"
 */
export function buildFigmaNodeUrl(fileKey, nodeId) {
  return `${FIGMA_SITE}/design/${fileKey}/?node-id=${encodeURIComponent(nodeId.replace(/:/g, "-"))}`
}

/**
 * A node id as it can be written in a file name: "87:91461" → "87-91461".
 * @param {string} nodeId
 */
const toFileNamePart = (nodeId) => nodeId.replace(/[^0-9a-z]+/gi, "-")
/** @param {string} nodeId */
const buildNodeCacheFileName = (nodeId) =>
  `figma-node-${toFileNamePart(nodeId)}.json`
/**
 * The name of a screen's capture in the output folder: "screen-87-91461.png".
 * @param {string} nodeId
 */
const buildCaptureFileName = (nodeId) => `screen-${toFileNamePart(nodeId)}.png`

/**
 * @param {string} pathAndQuery what follows "/v1" in the API's address
 * @param {string | undefined} token
 * @returns {Promise<any>}
 */
async function fetchFromFigma(pathAndQuery, token) {
  if (!token)
    throw new Error(
      "FIGMA_TOKEN is missing: a Figma personal access token that can read the file",
    )
  const response = await fetch(`${FIGMA_API}${pathAndQuery}`, {
    headers: { "X-Figma-Token": token },
  })
  if (response.status === HTTP_STATUS_FORBIDDEN) {
    throw new Error(
      `FIGMA_TOKEN was refused on ${pathAndQuery}: it has expired or cannot read this file`,
    )
  }
  if (!response.ok)
    throw new Error(
      `Figma ${response.status} on ${pathAndQuery}: ${await response.text()}`,
    )
  return response.json()
}

/**
 * @param {string} fileKey
 * @param {string} nodeId
 * @param {FigmaAccess} access
 * @returns {Promise<FigmaScreen>}
 */
export async function readFigmaScreen(
  fileKey,
  nodeId,
  { token, cacheDir, mustAskFigmaAgain },
) {
  const cacheFile = path.join(cacheDir, buildNodeCacheFileName(nodeId))
  const isKept = !mustAskFigmaAgain && fs.existsSync(cacheFile)
  const answer = isKept
    ? JSON.parse(fs.readFileSync(cacheFile, "utf8"))
    : await fetchFromFigma(
        `/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
        token,
      )
  if (!isKept) fs.writeFileSync(cacheFile, JSON.stringify(answer))
  const node = answer.nodes[nodeId]
  if (!node) throw new Error(`Figma file ${fileKey} has no node ${nodeId}`)
  return {
    screenNode: node.document,
    componentsById: node.components ?? {},
    componentSetsById: node.componentSets ?? {},
    version: answer.version,
    lastModified: answer.lastModified,
  }
}

/**
 * A frame that sits beside the reference screen, in the same section or page.
 * @typedef {object} NeighbourScreen
 * @property {string} nodeId
 * @property {string} name
 * @property {number} width
 * @property {number} height
 * @property {boolean} isVariantOfTheReference true when both are instances of the same
 *   Figma component set: the same design in another state or at another size
 */

/**
 * Looks for a node among the descendants of another.
 * @param {FigmaNode} ancestor
 * @param {string} nodeId
 * @returns {FigmaNode | null} the node's parent
 */
function findParentOfNode(ancestor, nodeId) {
  for (const child of ancestor.children ?? []) {
    if (child.id === nodeId) return ancestor
    const parent = findParentOfNode(child, nodeId)
    if (parent) return parent
  }
  return null
}

/**
 * The frames and components drawn beside a screen: the designer keeps the states and sizes
 * of one design side by side.
 * @param {string} fileKey
 * @param {string} referenceNodeId
 * @param {string | undefined} token
 * @returns {Promise<{ containerName: string, reference: NeighbourScreen, neighbours: NeighbourScreen[] }>}
 */
export async function listNeighbourScreens(fileKey, referenceNodeId, token) {
  for (const depth of FILE_DEPTHS_TRIED_TO_FIND_A_SCREEN) {
    const file = await fetchFromFigma(`/files/${fileKey}?depth=${depth}`, token)
    const container = findParentOfNode(file.document, referenceNodeId)
    if (!container) continue
    /** @param {FigmaNode} node */
    const readComponentSetId = (node) =>
      (node.componentId &&
        file.components?.[node.componentId]?.componentSetId) ||
      null
    const referenceNode = /** @type {FigmaNode} */ (
      container.children?.find((child) => child.id === referenceNodeId)
    )
    const referenceComponentSetId = readComponentSetId(referenceNode)
    /**
     * @param {FigmaNode} node
     * @returns {NeighbourScreen}
     */
    const describe = (node) => ({
      nodeId: node.id,
      name: node.name,
      width: Math.round(node.absoluteBoundingBox?.width ?? 0),
      height: Math.round(node.absoluteBoundingBox?.height ?? 0),
      isVariantOfTheReference:
        referenceComponentSetId !== null &&
        readComponentSetId(node) === referenceComponentSetId,
    })
    return {
      containerName: container.name,
      reference: describe(referenceNode),
      neighbours: (container.children ?? [])
        .filter((child) => child.id !== referenceNodeId)
        .filter((child) => SCREEN_NODE_TYPES.includes(child.type))
        .map(describe),
    }
  }
  throw new Error(
    `Node ${referenceNodeId} was not found in the first levels of Figma file ${fileKey}: give one link per screen instead`,
  )
}

/**
 * @param {Buffer} png
 * @returns {PixelSize}
 */
function readPngSize(png) {
  return {
    widthPx: png.readUInt32BE(PNG_WIDTH_BYTE_OFFSET),
    heightPx: png.readUInt32BE(PNG_HEIGHT_BYTE_OFFSET),
  }
}

/**
 * Writes the capture of a node in cacheDir, unless it is already there.
 * @param {string} fileKey
 * @param {string} nodeId
 * @param {FigmaAccess} access
 * @returns {Promise<PixelSize>} the size of the capture file
 */
export async function downloadCapture(
  fileKey,
  nodeId,
  { token, cacheDir, mustAskFigmaAgain },
) {
  const captureFile = path.join(cacheDir, buildCaptureFileName(nodeId))
  if (!mustAskFigmaAgain && fs.existsSync(captureFile))
    return readPngSize(fs.readFileSync(captureFile))
  const query = `ids=${encodeURIComponent(nodeId)}&scale=${CAPTURE_SCALE}&format=png`
  const { images } = await fetchFromFigma(`/images/${fileKey}?${query}`, token)
  if (!images[nodeId]) throw new Error(`Figma drew no image for node ${nodeId}`)
  const response = await fetch(images[nodeId])
  const png = Buffer.from(await response.arrayBuffer())
  fs.writeFileSync(captureFile, png)
  return readPngSize(png)
}

/**
 * Figma exports what the node paints, shadow included, which can be larger than the node's
 * own box. Tells which of the two the capture shows, from its size.
 * @param {FigmaNode} screenNode
 * @param {PixelSize} captureSize
 * @returns {CaptureLocation}
 */
export function locateCapture(screenNode, captureSize) {
  const nodeBox = screenNode.absoluteBoundingBox
  if (!nodeBox)
    throw new Error(
      `Node ${screenNode.id} has no box: it is not drawn on the page`,
    )
  const paintedBox = screenNode.absoluteRenderBounds ?? nodeBox
  const captureBox = [paintedBox, nodeBox].find(
    (box) =>
      Math.abs(box.width * CAPTURE_SCALE - captureSize.widthPx) <=
        CAPTURE_SCALE &&
      Math.abs(box.height * CAPTURE_SCALE - captureSize.heightPx) <=
        CAPTURE_SCALE,
  )
  if (!captureBox) {
    throw new Error(
      `${buildCaptureFileName(screenNode.id)} is ${captureSize.widthPx}×${captureSize.heightPx} px, which matches neither the node's box nor what it paints`,
    )
  }
  return {
    file: buildCaptureFileName(screenNode.id),
    x: Math.round(captureBox.x - nodeBox.x),
    y: Math.round(captureBox.y - nodeBox.y),
    width: captureSize.widthPx / CAPTURE_SCALE,
    height: captureSize.heightPx / CAPTURE_SCALE,
  }
}
