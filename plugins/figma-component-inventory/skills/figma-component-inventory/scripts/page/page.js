// @ts-check
// The script of inventory.html: draws what lib/pageDrawing.mjs worked out, answers the tabs,
// the switches and the clicks, and turns the developer's corrections into text for the chat.
// render.mjs pastes it into the page, so it imports nothing: it calls as globals the
// functions of pageReview.mjs and of lib/feedbackText.mjs, pasted before it.

/** @typedef {import("../lib/pageDrawing.mjs").PageDrawing} PageDrawing */
/** @typedef {import("../lib/pageDrawing.mjs").DrawnScreen} DrawnScreen */
/** @typedef {import("../lib/pageDrawing.mjs").DrawnCandidatePart} DrawnCandidatePart */
/** @typedef {import("../lib/pageDrawing.mjs").DrawingBox} DrawingBox */
/** @typedef {import("../lib/figma.mjs").Box} Box */
/** @typedef {import("../lib/pageDrawing.mjs").CorrectableTarget} CorrectableTarget */
/** @typedef {import("../lib/feedbackText.mjs").PageCorrection} PageCorrection */
/**
 * What render.mjs writes into the page.
 * @typedef {PageDrawing & {
 *   approvalDate: string | null,
 *   verdicts: { key: string, label: string, color: string, isDrawnOnThePage: boolean }[],
 *   correctionVerdicts: { key: string, label: string }[],
 *   verdictsHash: string,
 * }} Inventory
 */

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"
const LEADER_END_RADIUS = 2.5
const BADGE_TEXT_PADDING_X = 4
const BADGE_TEXT_RISE = 3
const ALL_SCREENS = "all"

/** @param {string} id */
function getElement(id) {
  const element = document.getElementById(id)
  if (!element) throw new Error(`The page has no element "${id}"`)
  return element
}

const inventoryElement = getElement("inventory")
/** @type {Inventory} */
const inventory = JSON.parse(inventoryElement.textContent ?? "")
// Its text holds the captures a second time; the parsed copy is all the page needs.
inventoryElement.remove()

/**
 * @param {string} name
 * @param {Record<string, string | number>} attributes
 * @param {string} [text]
 */
function createSvgElement(name, attributes, text) {
  const element = document.createElementNS(SVG_NAMESPACE, name)
  for (const [attribute, value] of Object.entries(attributes))
    element.setAttribute(attribute, String(value))
  if (text !== undefined) element.textContent = text
  return element
}

/**
 * @param {string} name
 * @param {string} [text]
 */
function createElement(name, text) {
  const element = document.createElement(name)
  if (text !== undefined) element.textContent = text
  return element
}

/**
 * The verdict gives the colour; the second class lets the "differences only" switch fade it.
 * @param {DrawnCandidatePart} part
 */
function classOfPart({ verdict, isSameOnEveryScreen }) {
  return isSameOnEveryScreen ? `${verdict} same-on-every-screen` : verdict
}

/**
 * @param {Box} box
 * @param {string} badgeText
 * @param {number} badgeWidth
 * @param {"above" | "beside"} badgePlace above the box's top-left corner, or right of the box
 */
function createBadge(box, badgeText, badgeWidth, badgePlace) {
  const x = badgePlace === "above" ? box.x - 1 : box.x + box.width
  const y = badgePlace === "above" ? box.y - inventory.badgeHeight : box.y
  return [
    createSvgElement("rect", {
      class: "badge",
      x,
      y,
      width: badgeWidth,
      height: inventory.badgeHeight,
    }),
    createSvgElement(
      "text",
      {
        class: "badge-text",
        x: x + BADGE_TEXT_PADDING_X,
        y: y + inventory.badgeHeight - BADGE_TEXT_RISE,
      },
      badgeText,
    ),
  ]
}

/** @param {DrawnScreen["outlines"][number]} outline */
function createOutline(outline) {
  const group = createSvgElement("g", {
    class: classOfPart(outline),
    "data-candidate": outline.candidateNumber,
  })
  if (outline.isThickEnoughToOutline) {
    group.append(
      createSvgElement("rect", { class: "outline-halo", ...outline.box }),
      createSvgElement("rect", { class: "outline", ...outline.box }),
    )
  }
  group.append(
    ...createBadge(outline.box, outline.id, outline.badgeWidth, "above"),
  )
  return group
}

/** @param {DrawnScreen["labels"][number]} label */
function createLabel(label) {
  const leaderEnd = label.leaderPoints[label.leaderPoints.length - 1]
  const group = createSvgElement("g", {
    class: classOfPart(label),
    "data-candidate": label.candidateNumber,
    "data-label": "",
  })
  const text = { x: label.textX, "text-anchor": label.textAnchor }
  group.append(
    createSvgElement("polyline", {
      class: "leader",
      fill: "none",
      points: label.leaderPoints.map(({ x, y }) => `${x},${y}`).join(" "),
    }),
    createSvgElement("circle", {
      class: "leader-end",
      cx: leaderEnd.x,
      cy: leaderEnd.y,
      r: LEADER_END_RADIUS,
    }),
    createSvgElement(
      "text",
      { class: "label-title", y: label.titleY, ...text },
      label.title,
    ),
    createSvgElement(
      "text",
      { class: "label-detail", y: label.detailY, ...text },
      label.detail,
    ),
  )
  return group
}

/** @param {DrawnScreen["looseTexts"][number]} looseText shown by its own switch */
function createLooseText(looseText) {
  const group = createSvgElement("g", { class: "loose-text" })
  group.append(
    createSvgElement("title", {}, looseText.characters),
    createSvgElement("rect", looseText.box),
    ...createBadge(looseText.box, looseText.tag, looseText.tagWidth, "beside"),
  )
  return group
}

/**
 * The veil the "differences only" switch lays over the capture: it covers the components
 * that are the same on every screen, and leaves clear a component that differs, even
 * inside one that is the same. The outlines go from outer to inner, so that the innermost
 * component decides for the place it covers.
 * @param {DrawnScreen} screen
 */
function createVeilOverSameComponents(screen) {
  const maskId = `same-components-of-screen-${screen.number}`
  const mask = createSvgElement("mask", {
    id: maskId,
    maskUnits: "userSpaceOnUse",
    ...screen.capture,
  })
  for (const outline of screen.outlines) {
    const fill = outline.isSameOnEveryScreen ? "white" : "black"
    mask.append(
      createSvgElement("rect", {
        fill,
        stroke: "none",
        ...outline.box,
      }),
    )
  }
  const veil = createSvgElement("rect", {
    class: "veil-over-same-components",
    mask: `url(#${maskId})`,
    ...screen.capture,
  })
  return [mask, veil]
}

/**
 * @param {Element} svg
 * @param {DrawingBox} box
 */
function showBox(svg, { left, top, width, height }) {
  svg.setAttribute("viewBox", `${left} ${top} ${width} ${height}`)
  svg.setAttribute("width", String(width))
}

/**
 * The candidate whose outline is the smallest one around the point clicked, or null.
 * @param {SVGSVGElement} svg
 * @param {DrawnScreen} screen
 * @param {MouseEvent} event
 */
function findCandidateAt(svg, screen, event) {
  const screenToSvg = svg.getScreenCTM()?.inverse()
  const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(
    screenToSvg,
  )
  const [smallest] = screen.outlines
    .filter(
      ({ box }) =>
        x >= box.x &&
        x <= box.x + box.width &&
        y >= box.y &&
        y <= box.y + box.height,
    )
    .toSorted((a, b) => a.box.width * a.box.height - b.box.width * b.box.height)
  return smallest ? smallest.candidateNumber : null
}

/** @type {number | null} */
let isolatedNumber = null
/** @type {{ screen: DrawnScreen, isolationMask: Element }[]} */
const isolationMasks = []
/**
 * Shows one screen's tab; null on a page of one screen, which has no tabs.
 * @type {((screenNumber: number) => void) | null}
 */
let showTabOfScreen = null

/**
 * Puts a class on everything drawn about the candidates it picks, and takes it off the others.
 * @param {string} className
 * @param {(candidateNumber: number) => boolean} isPicked
 */
function markCandidateElements(className, isPicked) {
  for (const element of document.querySelectorAll("[data-candidate]")) {
    const number = Number(element.getAttribute("data-candidate"))
    element.classList.toggle(className, isPicked(number))
  }
}

/**
 * Isolates one candidate on every screen: its outlines, labels and reason keep their
 * colour, everything else fades, and the capture is veiled except where the candidate is
 * drawn. Called with the same number again, or with null, shows everything back. The
 * correction form opens on it, on the whole candidate unless a target is given.
 * @param {number | null} candidateNumber
 * @param {string} [targetId] "7b" or "7 · écran 2"
 */
function isolate(candidateNumber, targetId) {
  isolatedNumber = candidateNumber === isolatedNumber ? null : candidateNumber
  document.body.classList.toggle("isolating", isolatedNumber !== null)
  markCandidateElements("isolated", (number) => number === isolatedNumber)
  /** @param {Box} box */
  const tracePath = ({ x, y, width, height }) =>
    `M${x},${y}h${width}v${height}h${-width}z`
  for (const { screen, isolationMask } of isolationMasks) {
    // The mask's fill rule turns each box drawn inside the capture's box into a hole.
    const holes = screen.outlines
      .filter((outline) => outline.candidateNumber === isolatedNumber)
      .map((outline) => tracePath(outline.box))
    isolationMask.setAttribute("d", tracePath(screen.capture) + holes.join(""))
  }
  showCorrectionForm(isolatedNumber, targetId)
}

/**
 * A tab of a tab strip; the strip marks the picked one with aria-selected.
 * @param {string} text
 * @param {() => void} onPick
 */
function createTabButton(text, onPick) {
  const button = createElement("button", text)
  button.setAttribute("type", "button")
  button.setAttribute("role", "tab")
  button.addEventListener("click", onPick)
  return button
}

/** @param {DrawnScreen} screen */
function drawScreen(screen) {
  const svg = /** @type {SVGSVGElement} */ (createSvgElement("svg", {}))
  const isolationMask = createSvgElement("path", { class: "isolation-mask" })
  showBox(svg, screen.ownBox)
  svg.append(
    createSvgElement("image", {
      href: screen.captureDataUrl,
      ...screen.capture,
    }),
    ...createVeilOverSameComponents(screen),
    isolationMask,
    ...screen.outlines.map(createOutline),
    ...screen.labels.map(createLabel),
    ...screen.looseTexts.map(createLooseText),
  )
  isolationMasks.push({ screen, isolationMask })
  svg.addEventListener("click", (event) => {
    const label =
      event.target instanceof Element
        ? event.target.closest("[data-label]")
        : null
    isolate(
      label
        ? Number(label.getAttribute("data-candidate"))
        : findCandidateAt(svg, screen, event),
    )
  })

  const figmaLink = createElement("a", screen.linkText)
  figmaLink.setAttribute("href", screen.figmaUrl)
  const title = createElement("h2")
  title.append(figmaLink)
  const section = createElement("section")
  section.className = "card"
  section.append(
    title,
    svg,
    createReviewCheck(
      {
        reviewHash: screen.reviewHash,
        label:
          "Écran vérifié : tout ce qui est entouré est juste, rien n'est oublié",
        subject: "screen",
        whyNotYet: null,
      },
      {
        candidateNumber: null,
        tabOfScreen: screen.number,
        drawnOnScreens: [screen.number],
      },
    ),
  )
  getElement("screens").append(section)
  return { screen, section, svg }
}

/**
 * Tabs show one screen at a time, all at the same place and size: switching tab shows
 * what changes from one screen to the next. The last tab shows them all, one under the other.
 * Under the images, only the explanations of what the shown screen draws are listed.
 * @param {ReturnType<typeof drawScreen>[]} drawnScreens
 * @param {ReturnType<typeof drawExplanations>} drawnExplanations
 */
function drawTabs(drawnScreens, drawnExplanations) {
  const choices = [
    ...drawnScreens.map(({ screen }) => ({
      shown: /** @type {number | string} */ (screen.number),
      text: screen.tabName,
    })),
    { shown: ALL_SCREENS, text: "Tous les écrans" },
  ]
  /** @type {number | string | null} */
  let shownNow = null
  /** @param {number | string} shown */
  const show = (shown) => {
    shownNow = shown
    buttons.forEach((button, index) =>
      button.setAttribute(
        "aria-selected",
        String(choices[index].shown === shown),
      ),
    )
    for (const { screen, section, svg } of drawnScreens) {
      section.hidden = shown !== ALL_SCREENS && shown !== screen.number
      showBox(svg, shown === ALL_SCREENS ? screen.ownBox : inventory.commonBox)
    }
    for (const { explanation, item } of drawnExplanations) {
      item.hidden =
        shown !== ALL_SCREENS &&
        !explanation.screens.some((screenNumber) => screenNumber === shown)
    }
  }
  const buttons = choices.map(({ shown, text }) => {
    const button = createTabButton(text, () => show(shown))
    button.setAttribute("data-screen", String(shown))
    return button
  })
  getElement("tabs").append(...buttons)

  document.addEventListener("keydown", (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!step || isTypingInAField(event)) return
    const index = choices.findIndex((choice) => choice.shown === shownNow)
    show(choices[(index + step + choices.length) % choices.length].shown)
  })
  show(choices[0].shown)
  showTabOfScreen = show
}

/**
 * While the switch is on, the page's body carries a class named like the switch: the
 * page's styles react to it.
 * @param {string} switchId
 */
function wireSwitch(switchId) {
  getElement(switchId).addEventListener("change", (event) => {
    const isOn = /** @type {HTMLInputElement} */ (event.target).checked
    document.body.classList.toggle(switchId, isOn)
  })
}

function drawHeader() {
  document.title = `Inventaire — ${inventory.title}`
  showPageHeader({
    subject: inventory.title,
    approvalDate: inventory.approvalDate,
    fingerprintLine: inventory.fingerprintLine,
  })

  // Each verdict's colour comes with the data: "--reused" for the page's own rules, and
  // "--verdict" on any element that carries the verdict as a class.
  const verdictColours = createElement(
    "style",
    inventory.verdicts
      .map(
        ({ key, color }) =>
          `:root { --${key}: ${color}; } .${key} { --verdict: var(--${key}); }`,
      )
      .join("\n"),
  )
  document.head.append(verdictColours)
  const verdictsInTheLegend = inventory.verdicts.filter(
    (verdict) => verdict.isDrawnOnThePage,
  )
  for (const { key, label } of verdictsInTheLegend) {
    const swatch = createSvgElement("svg", { viewBox: "0 0 36 12" })
    swatch.append(
      createSvgElement("line", {
        class: `swatch ${key}`,
        x1: 0,
        y1: 6,
        x2: 36,
        y2: 6,
      }),
    )
    const item = createElement("li")
    item.className = key
    item.append(swatch, label)
    getElement("legend").append(item)
  }
}

/**
 * Under the explanations: the Figma components that are no React component of their own,
 * each with what draws it instead and a box, as nothing on the capture shows them.
 */
function drawNotOutlined() {
  getElement("not-outlined-heading").hidden = !inventory.notOutlined.length
  for (const { name, reason, reviewHash } of inventory.notOutlined) {
    const title = createElement("strong", name)
    title.className = "item-title"
    const item = createElement("li")
    item.append(
      title,
      reason,
      createReviewCheck(
        {
          reviewHash,
          label: "Vérifié : pas un composant à part",
          subject: "component",
          whyNotYet: null,
        },
        { candidateNumber: null, tabOfScreen: null, drawnOnScreens: [] },
      ),
    )
    getElement("not-outlined").append(item)
  }
}

/**
 * Under the images: why a component is not simply reused (what has to change, why it is
 * left out, what the developer has to decide).
 */
function drawExplanations() {
  return inventory.explanations.map((explanation) => {
    const item = createElement("li")
    item.className = classOfPart(explanation)
    item.setAttribute("data-candidate", String(explanation.candidateNumber))
    item.addEventListener("click", () => isolate(explanation.candidateNumber))
    const badge = createElement("span", explanation.badgeText)
    badge.className = "item-badge"
    const title = createElement("strong")
    title.className = "item-title"
    title.append(badge, explanation.title)
    item.append(title)
    if (explanation.reason) item.append(explanation.reason)
    if (explanation.developerDecision !== null) {
      const decision = createElement(
        "span",
        `Décidé par le développeur${explanation.developerDecision ? ` : ${explanation.developerDecision}` : ""}`,
      )
      decision.className = "developer-words"
      item.append(createElement("br"), decision)
    }
    if (explanation.question)
      item.append(createElement("br"), explanation.question)
    item.append(
      createReviewCheck(
        {
          reviewHash: explanation.reviewHash,
          label: "Vérifié",
          subject: "component",
          whyNotYet:
            explanation.verdict === "to-decide" ? WHY_NOT_YET.undecided : null,
        },
        {
          candidateNumber: explanation.candidateNumber,
          tabOfScreen: null,
          drawnOnScreens: explanation.screens,
        },
      ),
    )
    getElement("explanations").append(item)
    return { explanation, item }
  })
}

// The boxes the developer ticks: one per explanation, one per screen.
/**
 * @typedef {object} DrawnReviewBox
 * @property {HTMLElement} reviewBox
 * @property {ReviewCheck} check as it stands while nothing is corrected
 * @property {number | null} candidateNumber the outlined component it is about; null for a screen and for what has no outline
 * @property {number | null} tabOfScreen the screen it is about; null for a component
 * @property {number[]} drawnOnScreens the screens whose tab shows the box; empty for a box every tab shows
 */
/** @type {DrawnReviewBox[]} */
const drawnReviewBoxes = []

/**
 * @param {ReviewCheck} check
 * @param {Pick<DrawnReviewBox, "candidateNumber" | "tabOfScreen" | "drawnOnScreens">} subject
 */
function createReviewCheck(check, subject) {
  const reviewBox = createReviewBox(check, showReview)
  drawnReviewBoxes.push({ reviewBox, check, ...subject })
  return reviewBox
}

/** The numbers of the candidates that carry a correction, on all or some of their uses. */
const listCorrectedNumbers = () =>
  new Set(
    [...corrections.keys()].map((id) => targetsById.get(id)?.candidateNumber),
  )

/**
 * Ticks what the developer has checked and counts it. A component that waits for his
 * decision, or that carries a correction, cannot be ticked: it is not right as it is.
 */
function showReview() {
  const correctedNumbers = listCorrectedNumbers()
  const checks = drawnReviewBoxes.map((drawn) => {
    const isCorrected = correctedNumbers.has(drawn.candidateNumber ?? undefined)
    const check = {
      ...drawn.check,
      whyNotYet:
        drawn.check.whyNotYet ?? (isCorrected ? WHY_NOT_YET.corrected : null),
    }
    fillReviewBox(drawn.reviewBox, check)
    if (drawn.tabOfScreen !== null)
      document
        .querySelector(`.tabs [data-screen="${drawn.tabOfScreen}"]`)
        ?.classList.toggle("reviewed", isReviewed(check))
    return check
  })
  showReviewProgress(checks, {
    isApproved: inventory.approvalDate !== null,
    correctionCount: corrections.size,
    showCheck: showReviewBoxOf,
  })
}

/**
 * Brings a box into view, on the tab of a screen that shows it when the picked tab does not.
 * @param {ReviewCheck} check
 */
function showReviewBoxOf(check) {
  const drawn = drawnReviewBoxes.find(
    (each) => each.check.reviewHash === check.reviewHash,
  )
  if (!drawn) return
  // The box is read at full strength: nothing stays faded around it.
  if (isolatedNumber !== null) isolate(null)
  const isOnThePickedTab = drawn.reviewBox.offsetParent !== null
  if (!isOnThePickedTab) showTabOfScreen?.(drawn.drawnOnScreens[0])
  pointAtReviewBox(drawn.reviewBox)
}

// The developer's corrections, by what they apply to: "7" for every use, "7b" or
// "7 · écran 2" for one outline.
// They are kept in the browser, so that reloading the page loses nothing; a page drawn from
// other verdicts starts empty, as the corrections may already be applied.
/** @type {Map<string, PageCorrection>} */
const corrections = new Map()
const correctionsStorageKey = `inventory-corrections ${inventory.verdictsHash}`
const candidatesByNumber = new Map(
  inventory.correctableCandidates.map((candidate) => [
    candidate.number,
    candidate,
  ]),
)
const targetsById = new Map(
  inventory.correctableCandidates.flatMap(({ targets }) =>
    targets.map((target) => [target.id, target]),
  ),
)
const verdictLabels = Object.fromEntries(
  inventory.correctionVerdicts.map(({ key, label }) => [key, label]),
)
const correctionForm = /** @type {HTMLFormElement} */ (getElement("correction"))
/**
 * What the form is correcting, picked with the tabs above the fields.
 * @type {CorrectableTarget | null}
 */
let pickedTarget = null
const componentInput = /** @type {HTMLInputElement} */ (
  getElement("correction-component")
)
const sameAsSelect = /** @type {HTMLSelectElement} */ (
  getElement("correction-same-as")
)
const noteInput = /** @type {HTMLInputElement} */ (
  getElement("correction-note")
)
const feedbackTextArea = /** @type {HTMLTextAreaElement} */ (
  getElement("feedback-text")
)

/**
 * A choice among others of the same group, drawn as a pill.
 * @param {"correction-verdict" | "correction-answer"} group
 * @param {string} value
 * @param {string} label
 */
function createChoice(group, value, label) {
  const choice = createElement("label")
  const radio = createElement("input")
  radio.setAttribute("type", "radio")
  radio.setAttribute("name", group)
  radio.setAttribute("value", value)
  choice.append(radio, label)
  return choice
}

function drawCorrectionForm() {
  for (const { key, label } of inventory.correctionVerdicts) {
    const choice = createChoice("correction-verdict", key, label)
    choice.className = key
    getElement("correction-verdicts").append(choice)
  }
  const componentsNamedInInventory = new Set(
    [...targetsById.values()].flatMap(
      ({ codeComponent }) => codeComponent ?? [],
    ),
  )
  getElement("components-named-in-inventory").append(
    ...[...componentsNamedInInventory]
      .toSorted()
      .map((componentName) => new Option(componentName)),
  )
  correctionForm.addEventListener("submit", (event) => event.preventDefault())
  correctionForm.addEventListener("input", saveCorrectionFields)
  getElement("correction-clear").addEventListener("click", () => {
    if (pickedTarget) corrections.delete(pickedTarget.id)
    fillCorrectionFields()
    showCorrections()
  })
  getElement("feedback-copy").addEventListener("click", copyFeedbackText)
  getElement("feedback-reset").addEventListener("click", () => {
    if (!window.confirm("Effacer toutes les corrections ?")) return
    corrections.clear()
    fillCorrectionFields()
    showCorrections()
  })
}

/**
 * Opens the form on a candidate, on the whole candidate unless a target is given; null closes it.
 * @param {number | null} candidateNumber
 * @param {string} [targetId] "7b" or "7 · écran 2"
 */
function showCorrectionForm(candidateNumber, targetId) {
  const candidate =
    candidateNumber === null
      ? undefined
      : candidatesByNumber.get(candidateNumber)
  correctionForm.hidden = !candidate
  if (!candidate) return
  getElement("correction-title").textContent =
    `${candidate.number} · ${candidate.figmaName} — ${candidate.judgement}`
  const targetTabs = getElement("correction-targets")
  targetTabs.hidden = candidate.targets.length === 1
  targetTabs.replaceChildren(
    ...candidate.targets.map((target) => {
      const tab = createTabButton(target.tabName, () => {
        pickedTarget = target
        fillCorrectionFields()
      })
      tab.setAttribute("data-target", target.id)
      return tab
    }),
  )
  pickedTarget =
    candidate.targets.find(({ id }) => id === targetId) ?? candidate.targets[0]
  sameAsSelect.replaceChildren(
    new Option("—", ""),
    ...inventory.correctableCandidates
      .filter(({ number }) => number !== candidate.number)
      .map(
        ({ number, figmaName }) =>
          new Option(`${number} · ${figmaName}`, String(number)),
      ),
  )
  fillCorrectionFields()
}

/**
 * Shows the picked target as the inventory judges it, with the developer's
 * correction over it. No verdict is picked for a whole candidate whose outlines differ.
 */
function fillCorrectionFields() {
  if (!pickedTarget) return
  const correction = corrections.get(pickedTarget.id)
  const verdictKey = correction?.verdict ?? pickedTarget.verdict
  for (const radio of correctionForm.querySelectorAll(
    "input[name=correction-verdict]",
  )) {
    const verdictRadio = /** @type {HTMLInputElement} */ (radio)
    verdictRadio.checked = verdictRadio.value === verdictKey
  }
  const answers = getElement("correction-answers")
  answers.hidden = !pickedTarget.question
  answers.replaceChildren(
    createElement("legend", `À trancher : ${pickedTarget.question}`),
    ...pickedTarget.options.map((option) => {
      const choice = createChoice("correction-answer", option, option)
      choice.className = "to-decide"
      const radio = /** @type {HTMLInputElement} */ (choice.firstChild)
      radio.checked = option === correction?.answer
      return choice
    }),
  )
  componentInput.value =
    correction?.codeComponent ?? pickedTarget.codeComponent ?? ""
  sameAsSelect.value = correction?.sameAs ?? ""
  noteInput.value = correction?.note ?? ""
  showWhichTargetsAreCorrected()
}

/** On the tabs: which target is picked, and a dot on those that have a correction. */
function showWhichTargetsAreCorrected() {
  for (const tab of getElement("correction-targets").children) {
    const targetId = tab.getAttribute("data-target") ?? ""
    tab.setAttribute("aria-selected", String(targetId === pickedTarget?.id))
    tab.classList.toggle("has-correction", corrections.has(targetId))
  }
  getElement("correction-clear").hidden = !corrections.has(
    pickedTarget?.id ?? "",
  )
}

function saveCorrectionFields() {
  if (!pickedTarget) return
  const pickedChoices = new FormData(correctionForm)
  /** @param {string} name */
  const readChoice = (name) => {
    const value = pickedChoices.get(name)
    return typeof value === "string" ? value : null
  }
  const correction = buildCorrection(pickedTarget.id, pickedTarget, {
    verdict: readChoice("correction-verdict"),
    codeComponent: componentInput.value,
    answer: readChoice("correction-answer"),
    sameAs: sameAsSelect.value,
    note: noteInput.value,
  })
  if (correction) corrections.set(pickedTarget.id, correction)
  else corrections.delete(pickedTarget.id)
  showWhichTargetsAreCorrected()
  showCorrections()
}

/**
 * Opens the form on a correction already made, on a screen that draws its outline.
 * @param {string} targetId "7", "7b" or "7 · écran 2"
 */
function openCorrection(targetId) {
  const target = targetsById.get(targetId)
  if (!target) return
  const isTargetOnAShownScreen = drawnScreens.some(
    ({ screen, section }) =>
      !section.hidden && target.screens.includes(screen.number),
  )
  if (!isTargetOnAShownScreen) showTabOfScreen?.(target.screens[0])
  if (isolatedNumber === target.candidateNumber)
    showCorrectionForm(target.candidateNumber, targetId)
  else isolate(target.candidateNumber, targetId)
}

/** Marks the corrected candidates, and updates the count, the list of corrections and the saved copy. */
function showCorrections() {
  const correctedNumbers = listCorrectedNumbers()
  markCandidateElements("corrected", (number) => correctedNumbers.has(number))
  const count = corrections.size
  getElement("feedback-lines").replaceChildren(
    ...sortCorrections([...corrections.values()]).map((correction) => {
      const line = createElement(
        "button",
        `${correction.target} — ${listCorrectionFields(correction, verdictLabels).join(" · ")}`,
      )
      line.setAttribute("type", "button")
      line.setAttribute("title", "Rouvrir cette correction")
      line.addEventListener("click", () => openCorrection(correction.target))
      const item = createElement("li")
      item.append(line)
      return item
    }),
  )
  getElement("feedback-count").textContent = count
    ? `${count} correction${count > 1 ? "s" : ""} à coller dans la conversation`
    : "Aucune correction : cliquer sur un composant pour le corriger"
  feedbackTextArea.hidden = true
  for (const id of ["feedback-copy", "feedback-reset"])
    getElement(id).hidden = !count
  showReview()
  try {
    if (count)
      localStorage.setItem(
        correctionsStorageKey,
        JSON.stringify([...corrections.values()]),
      )
    else localStorage.removeItem(correctionsStorageKey)
  } catch {
    // The browser keeps nothing for this page: the corrections last until it is closed.
  }
}

function restoreCorrections() {
  try {
    /** @type {PageCorrection[]} */
    const saved = JSON.parse(
      localStorage.getItem(correctionsStorageKey) ?? "[]",
    )
    for (const correction of saved)
      corrections.set(correction.target, correction)
  } catch {
    // Nothing kept, or unreadable: the page starts without corrections.
  }
}

function copyFeedbackText() {
  const text = buildFeedbackText(
    inventory.title,
    [...corrections.values()],
    verdictLabels,
  )
  copyWithConfirmation(getElement("feedback-copy"), text, () => {
    feedbackTextArea.value = text
    feedbackTextArea.hidden = false
    feedbackTextArea.select()
  })
}

drawHeader()
const drawnScreens = inventory.screens.map(drawScreen)
wireSwitch("texts-outside-leaves")
const drawnExplanations = drawExplanations()
drawNotOutlined()
if (drawnScreens.length > 1) {
  drawTabs(drawnScreens, drawnExplanations)
  getElement("differences-switch").hidden = false
  wireSwitch("differences-only")
}
drawCorrectionForm()
restoreCorrections()
restoreReview(
  `inventory-reviewed ${inventory.reviewKey}`,
  drawnReviewBoxes.map((drawn) => drawn.check.reviewHash),
)
showCorrections()

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || isTypingInAField(event)) return
  if (isolatedNumber !== null) isolate(null)
})
// A click beside the images and the reasons shows everything back; the page's own
// controls (tabs, switches, links, the correction form) leave the isolation as it is.
document.addEventListener("click", (event) => {
  const isOnTheDrawingOrAControl =
    event.target instanceof Element &&
    event.target.closest(
      ".screens svg, [data-candidate], .feedback, button, label, a",
    )
  if (!isOnTheDrawingOrAControl) isolate(null)
})
