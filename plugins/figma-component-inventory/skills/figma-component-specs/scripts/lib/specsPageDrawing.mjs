// @ts-check
// Everything specs.html draws, worked out from the approved inventory and specs.json: per
// component, the part of each capture it is drawn on and the outline of each zone there.
// The page's script only places what this module gives it.
import { buildFigmaNodeUrl } from "../../../figma-component-inventory/scripts/lib/figma.mjs"
import { listScreenNumbers } from "../../../figma-component-inventory/scripts/lib/mergeScreens.mjs"
import { VERDICTS } from "../../../figma-component-inventory/scripts/lib/verdicts.mjs"
import {
  listBoxesOfZonePart,
  listComponentsToSpecify,
  listEveryInstance,
  listTextsOfScreen,
  PROP_CHANGE_LABELS,
  ZONE_KIND_KEYS,
  ZONE_KINDS,
  ZONE_KINDS_WITHOUT_PROPS,
} from "./componentSpecs.mjs"
import {
  nameScreenTabs,
  tellMockupAndCommit,
  titleInventory,
} from "../../../figma-component-inventory/scripts/lib/inventoryWording.mjs"
import {
  growBox,
  isBoxInside,
  isBoxStrictlyInside,
  surroundBoxes,
} from "../../../figma-component-inventory/scripts/lib/box.mjs"
import { hashWhatIsReviewed } from "../../../figma-component-inventory/scripts/lib/approval.mjs"
import { hashComponents, readStandingApprovalDate } from "./specsApproval.mjs"

/** @typedef {import("./componentSpecs.mjs").ApprovedInventory} ApprovedInventory */
/** @typedef {import("./componentSpecs.mjs").SpecsFile} SpecsFile */
/** @typedef {import("./componentSpecs.mjs").PropSpec} PropSpec */
/** @typedef {import("./componentSpecs.mjs").ZoneSpec} ZoneSpec */
/** @typedef {import("./componentSpecs.mjs").Box} Box */
/** @typedef {import("./componentSpecs.mjs").ZoneKindKey} ZoneKindKey */

// The colour of a component's mark in the tree. A mark is 10 px wide: at that size the
// inventory's blue of « À adapter » is hard to tell from the purple of « À créer », so a
// component to adapt takes the inventory's green, which this page uses for nothing else.
/** @type {Record<string, string>} */
const COLOURS_IN_THE_TREE = {
  "to-create": VERDICTS["to-create"].color,
  "to-adapt": VERDICTS.reused.color,
}
/** @typedef {import("./componentSpecs.mjs").ComponentToSpecify} ComponentToSpecify */
/**
 * One screen a component is drawn on, cut around the outermost component to specify that
 * holds it (an editor for the Select inside its settings), or around the component itself
 * when none does. Every box is in pixels at scale 1 from the top-left corner of the cut.
 * @typedef {object} ComponentOnAScreen
 * @property {number} screenNumber the inventory's number of the screen
 * @property {string} screenName the Figma frame's name
 * @property {string} tabName as on the inventory's page: "2 · Continuous · Default", the screen's number and what its name does not share with the other screens'
 * @property {string} figmaUrl the screen in Figma
 * @property {number[]} sameOnScreenNumbers the other screens whose specs say the same (same zones, same content in the zones props drive), left out of the page
 * @property {Box} componentFrame where the component is in the cut, with its own size: the page fades what is outside
 * @property {{ width: number, height: number }} cut the size of the part of the capture shown
 * @property {Box & { file: string }} capture where the screen's whole image sits behind the cut
 * @property {(Box & { zoneLetter: string })[]} outlines one per box a zone names on this screen
 * @property {string} reviewHash changes when the developer has to check the component on this screen again: a zone drawn there, or where it is drawn, changed
 */
/**
 * A zone as the page shows it.
 * @typedef {Omit<ZoneSpec, "parts"> & { opensComponent: string | null }} DrawnZone
 * `opensComponent`: the component with specs of its own that the zone outlines, a header
 * inside an editor. The zone's item links to that component, where it is described
 * once; null for a zone that outlines no such component.
 */
/**
 * @typedef {object} DrawnComponent
 * @property {string} codeComponent
 * @property {string | null} codePath
 * @property {{ label: string, color: string }} verdict the inventory's: "À créer" or "À adapter"
 * @property {boolean} isToAdapt true when `props` holds only the props to add or to modify
 * @property {string[]} holdsDirectly the components to specify drawn inside it with no other one between the two: its children in the page's tree of components
 * @property {import("./componentSpecs.mjs").ChangeSpec[]} changes what changes without a prop; empty for a component to create
 * @property {string[]} developerDecisions what the developer settled about the component
 * @property {PropSpec[]} props
 * @property {DrawnZone[]} zones
 * @property {ComponentOnAScreen[]} screens
 * @property {string} reviewHash changes when the developer has to check the component again: its props, what changes without a prop, or what he decided changed
 */
/**
 * @typedef {object} SpecsPageDrawing
 * @property {string} fingerprintLine what the page is built on: the day the inventory was approved, the mock-up and the commit
 * @property {string} title the inventory's: its screen's name, or what several screens' names share, "Editor — regulation (6 écrans)"
 * @property {string} specsHash changes with the specs: the corrections typed on the page are kept for these specs only
 * @property {string | null} approvalDate the day the developer approved these specs; null for a draft
 * @property {typeof ZONE_KINDS} zoneKinds the label and the colour of each kind of zone
 * @property {ZoneKindKey[]} zoneKindsInTheLegend the kinds some zone of the page has, in the legend's order
 * @property {typeof PROP_CHANGE_LABELS} propChangeLabels what the page writes beside a prop of a component to adapt, by the prop's `change`
 * @property {DrawnComponent[]} components one node each in the page's tree of components, from the innermost to the outermost; the page opens on the first one that no other holds
 * @property {string} reviewKey names the mock-up's screens: the same from one build of the page to the next, so that the browser finds back what the developer already checked
 */

// Shown around the component so that its edges and the zones touching them stay readable.
const MARGIN_AROUND_COMPONENT = 14
// An outline is drawn just outside what it names, not over its border.
const MARGIN_AROUND_ZONE = 2

/**
 * True when some use of `held` lies within a use of `holder` on the same screen, the two
 * boxes being different.
 * @param {ComponentToSpecify} held
 * @param {ComponentToSpecify} holder
 */
const isDrawnInside = (held, holder) =>
  held !== holder &&
  held.instances.some((heldInstance) =>
    holder.instances.some(
      (holderInstance) =>
        holderInstance.screen === heldInstance.screen &&
        isBoxStrictlyInside(heldInstance.box, holderInstance.box),
    ),
  )

/**
 * The components drawn inside `component` with no other component between the two: a
 * Select inside settings inside an editor is held directly by the settings only.
 * @param {ComponentToSpecify} component
 * @param {ComponentToSpecify[]} components
 */
function listComponentsHeldDirectly(component, components) {
  const held = components.filter((other) => isDrawnInside(other, component))
  return held.filter(
    (each) => !held.some((between) => isDrawnInside(each, between)),
  )
}

/**
 * A component comes after every component drawn inside it, so that a parent is read once
 * its children are known (Select, then OrderDeliverySettings, then
 * OrderEditor). Components with as many levels inside them keep the inventory's
 * order.
 * @param {ComponentToSpecify[]} components
 * @returns {ComponentToSpecify[]}
 */
function sortFromInnermostToOutermost(components) {
  /** @type {Map<ComponentToSpecify, number>} */
  const levelsInsideByComponent = new Map()
  /**
   * 0 for a component that holds none of the others, 1 for one that holds only such
   * components, and so on.
   * @param {ComponentToSpecify} component
   * @returns {number}
   */
  const countLevelsInside = (component) => {
    const known = levelsInsideByComponent.get(component)
    if (known !== undefined) return known
    const levels = Math.max(
      0,
      ...components
        .filter((other) => isDrawnInside(other, component))
        .map((held) => countLevelsInside(held) + 1),
    )
    levelsInsideByComponent.set(component, levels)
    return levels
  }
  return components.toSorted(
    (a, b) => countLevelsInside(a) - countLevelsInside(b),
  )
}

/**
 * What the specs of a component say of one screen, as a text two screens share when they
 * tell the developer the same thing: the zones outlined, and what the zones that props
 * drive show (their texts, the variants of what they hold). The rest is left out:
 * - the component's size: it follows its parent's width, so the desktop and the mobile
 *   screens of one state are the same;
 * - what a zone without props shows: a field to make taller is the same change whatever
 *   value it displays.
 * @param {number} screenNumber
 * @param {{ zoneLetter: string, kind: ZoneKindKey, box: Box }[]} zoneBoxes the boxes the zones name on that screen
 * @param {ApprovedInventory} inventory
 */
function describeSpecsOnScreen(screenNumber, zoneBoxes, inventory) {
  const boxesDrivenByProps = zoneBoxes
    .filter((zone) => !ZONE_KINDS_WITHOUT_PROPS.includes(zone.kind))
    .map((zone) => zone.box)
  /** @param {Box} box */
  const isDrivenByProps = (box) =>
    boxesDrivenByProps.some((zoneBox) => isBoxInside(box, zoneBox))
  const instancesShown = inventory.judgedCandidates.flatMap((candidate) =>
    listEveryInstance(candidate)
      .filter(
        (instance) =>
          instance.screen === screenNumber && isDrivenByProps(instance.box),
      )
      .map(({ box, variant }) => ({
        box,
        shown: `${candidate.number} ${variant}`,
      })),
  )
  const textsShown = listTextsOfScreen(inventory, screenNumber)
    .filter((text) => isDrivenByProps(text.box))
    .map(({ box, characters }) => ({ box, shown: characters }))
  // In reading order, so that the same four segments with another one selected differ.
  const shownInReadingOrder = [...instancesShown, ...textsShown]
    .toSorted((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
    .map((held) => held.shown)
  return JSON.stringify([
    [...new Set(zoneBoxes.map((zone) => zone.zoneLetter))].toSorted(),
    shownInReadingOrder,
  ])
}

/**
 * @param {object} input
 * @param {ApprovedInventory} input.inventory
 * @param {SpecsFile} input.specsFile one that `listSpecProblems` finds no problem in
 * @returns {SpecsPageDrawing}
 */
export function buildSpecsPageDrawing({ inventory, specsFile }) {
  const componentsToSpecify = sortFromInnermostToOutermost(
    listComponentsToSpecify(inventory),
  )
  const outermostComponents = componentsToSpecify.filter(
    (component) =>
      !componentsToSpecify.some((holder) => isDrawnInside(component, holder)),
  )
  const tabNames = nameScreenTabs(inventory.screens)
  const components = componentsToSpecify.map((component) => {
    const spec = specsFile.components.find(
      (each) => each.codeComponent === component.codeComponent,
    )
    if (!spec)
      throw new Error(`specs.json has no entry for ${component.codeComponent}`)
    const { zones } = spec
    const boxesOfZones = zones.flatMap((zone) =>
      zone.parts.flatMap((part) =>
        listBoxesOfZonePart(part, component, inventory).map((drawn) => ({
          ...drawn,
          zoneLetter: zone.letter,
          kind: zone.kind,
        })),
      ),
    )
    const everyScreen = listScreenNumbers(component.instances).map(
      (screenNumber) => {
        const screenIndex = inventory.screens.findIndex(
          (each) => each.number === screenNumber,
        )
        const screen = inventory.screens[screenIndex]
        if (!screen)
          throw new Error(`The inventory has no screen ${screenNumber}`)
        /** @param {ComponentToSpecify} drawn */
        const listBoxesOnScreen = (drawn) =>
          drawn.instances
            .filter((instance) => instance.screen === screenNumber)
            .map((instance) => instance.box)
        // A component used several times on a screen (two date fields) gets one frame.
        const componentBox = surroundBoxes(listBoxesOnScreen(component))
        // The image is the same for every component of one container: the editor's, with
        // the settings or the Select framed inside it.
        const cut = growBox(
          surroundBoxes([
            componentBox,
            ...outermostComponents
              .filter((outermost) => isDrawnInside(component, outermost))
              .flatMap(listBoxesOnScreen),
          ]),
          MARGIN_AROUND_COMPONENT,
        )
        return {
          screenNumber,
          screenName: screen.name,
          tabName: tabNames[screenIndex],
          figmaUrl: buildFigmaNodeUrl(
            inventory.fingerprint.figma.fileKey,
            screen.nodeId,
          ),
          componentFrame: {
            ...componentBox,
            x: componentBox.x - cut.x,
            y: componentBox.y - cut.y,
          },
          cut: { width: cut.width, height: cut.height },
          capture: {
            file: screen.capture.file,
            x: screen.capture.x - cut.x,
            y: screen.capture.y - cut.y,
            width: screen.capture.width,
            height: screen.capture.height,
          },
          outlines: boxesOfZones
            .filter((drawn) => drawn.screen === screenNumber)
            .map(({ zoneLetter, box }) => {
              const outline = growBox(box, MARGIN_AROUND_ZONE)
              return {
                zoneLetter,
                ...outline,
                x: outline.x - cut.x,
                y: outline.y - cut.y,
              }
            }),
        }
      },
    )
    // A screen whose specs say the same as an earlier one's is not shown again: the
    // developer would open it to find nothing new. The earlier one names it.
    const screens = [
      ...Map.groupBy(everyScreen, (screen) =>
        describeSpecsOnScreen(
          screen.screenNumber,
          boxesOfZones.filter((drawn) => drawn.screen === screen.screenNumber),
          inventory,
        ),
      ).values(),
    ].map(([firstScreen, ...sameScreens]) => {
      const sameOnScreenNumbers = sameScreens.map(
        (screen) => screen.screenNumber,
      )
      const lettersDrawn = new Set(
        firstScreen.outlines.map((outline) => outline.zoneLetter),
      )
      return {
        ...firstScreen,
        sameOnScreenNumbers,
        // The zones as specs.json writes them, with what each one names: where the page
        // draws them is left out, as it moves with the cut.
        reviewHash: hashWhatIsReviewed({
          codeComponent: component.codeComponent,
          screenNumber: firstScreen.screenNumber,
          sameOnScreenNumbers,
          zones: zones.filter((zone) => lettersDrawn.has(zone.letter)),
        }),
      }
    })
    const whatThePanelSaysOfTheComponent = {
      codeComponent: component.codeComponent,
      codePath: component.codePath,
      changes: spec.changes ?? [],
      developerDecisions: spec.developerDecisions ?? [],
      props: spec.props,
    }
    return {
      ...whatThePanelSaysOfTheComponent,
      reviewHash: hashWhatIsReviewed({
        ...whatThePanelSaysOfTheComponent,
        verdict: component.verdict,
      }),
      verdict: {
        label: VERDICTS[component.verdict].label,
        color: COLOURS_IN_THE_TREE[component.verdict],
      },
      isToAdapt: component.isToAdapt,
      holdsDirectly: listComponentsHeldDirectly(
        component,
        componentsToSpecify,
      ).map((held) => held.codeComponent),
      zones: zones.map(({ parts: _parts, ...zone }) => {
        const boxesOfZone = boxesOfZones.filter(
          (drawn) => drawn.zoneLetter === zone.letter,
        )
        // Only a zone that outlines that component and nothing else: a zone holding a
        // field and its label says something the field's own specs do not. A zone that
        // asks a question stays in place: its question is read and answered there.
        const componentOutlined = componentsToSpecify.find(
          (other) =>
            other !== component &&
            zone.kind !== "to-decide" &&
            boxesOfZone.length > 0 &&
            boxesOfZone.every((drawn) =>
              other.instances.some(
                (instance) => instance.id === drawn.instanceId,
              ),
            ),
        )
        return {
          ...zone,
          opensComponent: componentOutlined?.codeComponent ?? null,
        }
      }),
      screens,
    }
  })
  return {
    fingerprintLine: `Construit sur l'inventaire validé le ${inventory.approvedOn} · ${tellMockupAndCommit(inventory.fingerprint)}`,
    title: titleInventory(inventory.screens),
    specsHash: hashComponents(specsFile.components),
    reviewKey: hashWhatIsReviewed(
      inventory.screens.map((screen) => screen.nodeId),
    ),
    approvalDate: readStandingApprovalDate(specsFile),
    zoneKinds: ZONE_KINDS,
    zoneKindsInTheLegend: ZONE_KIND_KEYS.filter((kind) =>
      components.some((component) =>
        component.zones.some((zone) => zone.kind === kind),
      ),
    ),
    propChangeLabels: PROP_CHANGE_LABELS,
    components,
  }
}
