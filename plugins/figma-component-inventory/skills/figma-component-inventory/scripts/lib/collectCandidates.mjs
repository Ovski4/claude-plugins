// @ts-check
// Turns the Figma tree of one screen into the list of candidates: the components the screen
// uses, each with the boxes of its uses. Reads no file and calls nothing.

/** @typedef {import("./figma.mjs").Box} Box */
/** @typedef {import("./figma.mjs").FigmaNode} FigmaNode */
/** @typedef {import("./figma.mjs").FigmaComponent} FigmaComponent */
/**
 * One use of a candidate in the screen.
 * @typedef {object} Instance
 * @property {string} letter "a", "b"… in reading order; with the candidate's number it names the outline ("6b")
 * @property {string} nodeId
 * @property {string} variant the Figma variant ("State=Active") or, for a grouped frame, its own name; "" when there is none
 * @property {number} level 1 for the screen's root component, +1 at each component nested inside another
 * @property {Box} box the visible part, in pixels at scale 1 from the screen's top-left corner
 * @property {number | null} parent the number of the candidate this instance sits in
 * @property {string[]} [icons] the icon components directly inside this use, in the tree's
 *   order: what tells apart three icon buttons of one variant. Not every candidates.json
 *   has it: a missing list reads as an empty one.
 */
/**
 * @typedef {object} Candidate
 * @property {number} number
 * @property {"instance" | "frame"} kind "instance" for a Figma component, "frame" for a named frame that is not one
 * @property {boolean} mustBeJudged true when verdicts.json must hold an entry for it
 * @property {string} figmaName
 * @property {string | null} componentKey what tells two Figma components with one name apart:
 *   the id of the component set, or of the component when it has no variants; null for a frame
 * @property {Instance[]} instances
 * @property {string[]} icons the icon components found directly inside: listed, never outlined
 */
/**
 * A text drawn on the screen. Icons' and hidden layers' texts are left out.
 * @typedef {object} ScreenText
 * @property {string} nodeId
 * @property {string} characters what it says
 * @property {Box} box the visible part, in pixels at scale 1 from the screen's top-left corner
 */
/**
 * A candidate while the tree is being walked: no number yet, and each use points to the
 * group it sits in instead of that group's number.
 * @typedef {object} CandidateGroup
 * @property {"instance" | "frame"} kind
 * @property {string} figmaName
 * @property {string | null} componentKey
 * @property {(Omit<Instance, "letter" | "parent"> & { enclosingGroup: CandidateGroup | null })[]} uses
 * @property {Set<string>} icons
 */
/**
 * What a node inherits from its ancestors.
 * @typedef {object} Surroundings
 * @property {FigmaNode | null} parent
 * @property {CandidateGroup | null} enclosingGroup the closest Figma component around the node
 * @property {{ icons: string[] } | null} enclosingUse the use of that component the node sits in
 * @property {number} enclosingLevel the level of that component; 0 outside any
 * @property {Box} clip what the clipping ancestors let through
 */

const ICON_NAME_PREFIX = "ic/"
// In Figma, a layer's name often reads "Role — detail": "Group — setpoint", "Day · hover".
const NAME_PART_SEPARATOR_PATTERN = /\s[—–·:-]\s/
// A top-level layer with one of these names that covers the whole screen is the veil drawn
// behind a dialog: only the layers above it give candidates.
const BACKDROP_NAME_PATTERN = /^(scrim|backdrop|overlay)\b/i
const MIN_REPEATS_OF_A_COMPONENT = 2
const MIN_COMMON_NAME_LENGTH = 3
// Level 2 = directly inside the screen's root component.
const DEEPEST_LEVEL_OF_REQUIRED_FRAMES = 2
const LETTERS_IN_ALPHABET = 26
const CHAR_CODE_OF_LOWERCASE_A = 97

/**
 * 0 → "a", 25 → "z", 26 → "a1", 27 → "b1".
 * @param {number} index
 */
export function toInstanceLetter(index) {
  const letter = String.fromCharCode(
    CHAR_CODE_OF_LOWERCASE_A + (index % LETTERS_IN_ALPHABET),
  )
  return index < LETTERS_IN_ALPHABET
    ? letter
    : `${letter}${Math.floor(index / LETTERS_IN_ALPHABET)}`
}

/**
 * "Group — setpoint" → "Group"; the whole name when it has one part.
 * @param {string} layerName
 */
export function readFirstPartOfName(layerName) {
  return layerName.split(NAME_PART_SEPARATOR_PATTERN)[0]
}

/**
 * What tells two rows of a list alike: the first part of their name ("Day — Mon" and
 * "Day — Wed · hover" are both "Day") and the kind of their direct children. Names or texts
 * further down do not count: a row with no slot still is a row.
 * @param {FigmaNode} node
 */
function describeStructure(node) {
  return `${readFirstPartOfName(node.name)}[${(node.children ?? []).map((child) => child.type).join(",")}]`
}

/**
 * "Day — Mon", "Day — Wed · hover" → "Day"; the first name when the names share no start.
 * @param {string[]} names
 */
export function findCommonName(names) {
  let commonStart = names[0]
  for (const name of names) {
    while (!name.startsWith(commonStart)) commonStart = commonStart.slice(0, -1)
  }
  const cleaned = commonStart.replace(/[\s—–·:-]+$/, "")
  return cleaned.length >= MIN_COMMON_NAME_LENGTH ? cleaned : names[0]
}

/**
 * The part of a box that a clipping ancestor lets through; null when nothing is left (a row
 * scrolled out of a list, a layer outside the screen).
 * @param {Box} box
 * @param {Box} clip
 * @returns {Box | null}
 */
function clipBox(box, clip) {
  const x = Math.max(box.x, clip.x)
  const y = Math.max(box.y, clip.y)
  const right = Math.min(box.x + box.width, clip.x + clip.width)
  const bottom = Math.min(box.y + box.height, clip.y + clip.height)
  return right > x && bottom > y
    ? { x, y, width: right - x, height: bottom - y }
    : null
}

/**
 * A frame used several times is a component the designer did not declare: it needs a verdict
 * like a Figma component. Not inside a nested component, whose inner frames are its own
 * layout (the header of each tile).
 * @param {CandidateGroup} group
 */
function isRepeatedOutsideNestedComponents(group) {
  return (
    group.uses.length >= MIN_REPEATS_OF_A_COMPONENT &&
    group.uses.every((use) => use.level <= DEEPEST_LEVEL_OF_REQUIRED_FRAMES)
  )
}

/**
 * @param {Map<string, CandidateGroup>} groupsByKey
 * @param {string} key
 * @param {"instance" | "frame"} kind
 * @param {() => string} nameGroup called only when the group does not exist yet
 */
function findOrCreateGroup(groupsByKey, key, kind, nameGroup) {
  let group = groupsByKey.get(key)
  if (!group) {
    group = {
      kind,
      figmaName: nameGroup(),
      componentKey: kind === "instance" ? key : null,
      uses: [],
      icons: new Set(),
    }
    groupsByKey.set(key, group)
  }
  return group
}

/**
 * @param {FigmaNode} screenNode the node the Figma link points to
 * @param {Record<string, FigmaComponent>} componentsById
 * @param {Record<string, { name: string }>} componentSetsById
 * @returns {{ candidates: Candidate[], backdrop: string | null, texts: ScreenText[] }}
 *   backdrop: the name of the veil drawn behind a dialog, when the screen has one; texts:
 *   every text the judged part of the screen shows
 */
export function collectCandidates(
  screenNode,
  componentsById,
  componentSetsById,
) {
  const origin = screenNode.absoluteBoundingBox
  if (!origin)
    throw new Error(
      `Node ${screenNode.id} has no box: it is not drawn on the page`,
    )
  const screenBox = {
    x: 0,
    y: 0,
    width: Math.round(origin.width),
    height: Math.round(origin.height),
  }
  /** @type {Map<string, CandidateGroup>} */
  const componentGroupsByComponent = new Map()
  /** @type {Map<string, CandidateGroup>} */
  const frameGroupsByKey = new Map()
  /** @type {ScreenText[]} */
  const texts = []

  /** @param {Box} absoluteBox */
  const toScreenBox = (absoluteBox) => ({
    x: Math.round(absoluteBox.x - origin.x),
    y: Math.round(absoluteBox.y - origin.y),
    width: Math.round(absoluteBox.width),
    height: Math.round(absoluteBox.height),
  })

  /**
   * @param {FigmaNode} node an INSTANCE
   * @returns {{ figmaName: string, componentKey: string, variant: string }}
   */
  function describeComponentOf(node) {
    const componentId = node.componentId ?? node.id
    const component = componentsById[componentId]
    const componentSet = component?.componentSetId
      ? componentSetsById[component.componentSetId]
      : undefined
    return {
      figmaName: componentSet?.name ?? component?.name ?? node.name,
      // Every variant of a component set is one candidate.
      componentKey: component?.componentSetId ?? componentId,
      variant: componentSet && component ? component.name : "",
    }
  }

  /**
   * Frames are grouped like the instances of a component: by name, or, for siblings built
   * the same way under different names ("Day — Mon" … "Day — Sun"), by structure.
   * @param {FigmaNode} node a FRAME
   * @param {FigmaNode | null} parent
   * @returns {{ group: CandidateGroup, variant: string }}
   */
  function findFrameGroup(node, parent) {
    const structure = describeStructure(node)
    const lookAlikes = (parent?.children ?? []).filter(
      (sibling) =>
        sibling.type === "FRAME" && describeStructure(sibling) === structure,
    )
    if (!parent || lookAlikes.length < MIN_REPEATS_OF_A_COMPONENT) {
      return {
        group: findOrCreateGroup(
          frameGroupsByKey,
          node.name,
          "frame",
          () => node.name,
        ),
        variant: "",
      }
    }
    const nameGroup = () =>
      findCommonName(lookAlikes.map((lookAlike) => lookAlike.name))
    return {
      group: findOrCreateGroup(
        frameGroupsByKey,
        `${parent.id} ${structure}`,
        "frame",
        nameGroup,
      ),
      variant: node.name,
    }
  }

  /**
   * @param {FigmaNode} node
   * @param {Surroundings} surroundings
   */
  function visit(
    node,
    { parent, enclosingGroup, enclosingUse, enclosingLevel, clip },
  ) {
    if (node.visible === false || !node.absoluteBoundingBox) return
    const visibleBox =
      node === screenNode
        ? screenBox
        : clipBox(toScreenBox(node.absoluteBoundingBox), clip)
    if (!visibleBox) return
    if (node.type === "TEXT") {
      texts.push({
        nodeId: node.id,
        characters: node.characters ?? "",
        box: visibleBox,
      })
      return
    }
    const level = enclosingLevel + 1
    /** @type {string[]} */
    const iconsInside = []
    const use = {
      nodeId: node.id,
      level,
      enclosingGroup,
      box: visibleBox,
      icons: iconsInside,
    }
    let surroundingsOfChildren = {
      parent: node,
      enclosingGroup,
      enclosingUse,
      enclosingLevel,
      clip: node.clipsContent ? visibleBox : clip,
    }

    if (node.type === "INSTANCE") {
      const { figmaName, componentKey, variant } = describeComponentOf(node)
      if (figmaName.startsWith(ICON_NAME_PREFIX)) {
        enclosingGroup?.icons.add(figmaName)
        enclosingUse?.icons.push(figmaName)
        return
      }
      const group = findOrCreateGroup(
        componentGroupsByComponent,
        componentKey,
        "instance",
        () => figmaName,
      )
      group.uses.push({ ...use, variant })
      surroundingsOfChildren = {
        ...surroundingsOfChildren,
        enclosingGroup: group,
        enclosingUse: use,
        enclosingLevel: level,
      }
    } else if (node.type === "FRAME" && node !== screenNode) {
      const { group, variant } = findFrameGroup(node, parent)
      group.uses.push({ ...use, variant })
    }
    for (const child of node.children ?? [])
      visit(child, surroundingsOfChildren)
  }

  // Layers are listed from back to front. With a backdrop, what lies behind it is the page
  // the dialog was opened from: it is drawn in the capture but never judged.
  const layers = screenNode.children ?? []
  const backdropIndex = layers.findLastIndex((layer) => {
    if (!layer.absoluteBoundingBox || !BACKDROP_NAME_PATTERN.test(layer.name))
      return false
    const box = toScreenBox(layer.absoluteBoundingBox)
    return box.width >= screenBox.width && box.height >= screenBox.height
  })
  const backdrop = backdropIndex === -1 ? null : layers[backdropIndex].name
  /** @type {Omit<Surroundings, "parent">} */
  const outsideAnyComponent = {
    enclosingGroup: null,
    enclosingUse: null,
    enclosingLevel: 0,
    clip: screenBox,
  }
  if (backdrop) {
    for (const layer of layers.slice(backdropIndex + 1))
      visit(layer, { ...outsideAnyComponent, parent: screenNode })
  } else {
    visit(screenNode, { ...outsideAnyComponent, parent: null })
  }

  // Numbers follow the Figma tree, top to bottom: the components first, then the plain frames.
  const groups = [
    ...componentGroupsByComponent.values(),
    ...frameGroupsByKey.values(),
  ]
  const numbersByGroup = new Map(
    groups.map((group, index) => [group, index + 1]),
  )
  const candidates = groups.map((group, index) => ({
    number: index + 1,
    kind: group.kind,
    mustBeJudged:
      group.kind === "instance" || isRepeatedOutsideNestedComponents(group),
    figmaName: group.figmaName,
    componentKey: group.componentKey,
    instances: group.uses
      .toSorted((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
      .map(
        ({ enclosingGroup, nodeId, variant, level, box, icons }, useIndex) => ({
          letter: toInstanceLetter(useIndex),
          nodeId,
          variant,
          level,
          box,
          parent:
            (enclosingGroup && numbersByGroup.get(enclosingGroup)) ?? null,
          icons,
        }),
      ),
    icons: [...group.icons],
  }))
  return { candidates, backdrop, texts }
}
