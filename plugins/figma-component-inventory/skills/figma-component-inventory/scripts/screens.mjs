// @ts-check
// Usage: node scripts/screens.mjs <figma-url>
// Lists the frames drawn beside one screen in its Figma section, so that the screens of the
// same design (other states, other sizes) can be judged together. Prints each with its size
// and its link; the ones that are variants of the same Figma component as the given screen
// come first. Needs FIGMA_TOKEN; writes nothing.
import {
  buildFigmaNodeUrl,
  listNeighbourScreens,
  parseFigmaUrl,
} from "./lib/figma.mjs"

const EXIT_CODE_FAILED = 1
const USAGE = "Usage: node scripts/screens.mjs <figma-url>"

async function main() {
  const [figmaUrl] = process.argv.slice(2)
  if (!figmaUrl) throw new Error(USAGE)
  const { fileKey, nodeId } = parseFigmaUrl(figmaUrl)
  const { containerName, reference, neighbours } = await listNeighbourScreens(
    fileKey,
    nodeId,
    process.env.FIGMA_TOKEN,
  )
  /** @param {import("./lib/figma.mjs").NeighbourScreen} screen */
  const describe = (screen) =>
    `- ${screen.name} — ${screen.width} × ${screen.height} px — ${buildFigmaNodeUrl(fileKey, screen.nodeId)}`
  const variants = neighbours.filter((each) => each.isVariantOfTheReference)
  const others = neighbours.filter((each) => !each.isVariantOfTheReference)
  console.log(
    [
      `# Beside the screen, in "${containerName}"`,
      "",
      "## The screen given",
      "",
      describe(reference),
      "",
      "## Same Figma component, other variants: the same design in another state or size",
      "",
      ...(variants.length ? variants.map(describe) : ["none"]),
      "",
      "## Other frames of the section: comparable only if their name and size say so",
      "",
      ...(others.length ? others.map(describe) : ["none"]),
    ].join("\n"),
  )
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(EXIT_CODE_FAILED)
}
