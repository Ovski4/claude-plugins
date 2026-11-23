// @ts-check
// The script of cut.html: draws what lib/pageDrawing.mjs worked out, and answers the tabs,
// the switches and the clicks. render.mjs pastes it into the page, so it imports nothing.

/** @typedef {import("../lib/pageDrawing.mjs").PageDrawing} PageDrawing */
/** @typedef {import("../lib/pageDrawing.mjs").DrawnScreen} DrawnScreen */
/** @typedef {import("../lib/pageDrawing.mjs").DrawnCandidatePart} DrawnCandidatePart */
/** @typedef {import("../lib/pageDrawing.mjs").DrawingBox} DrawingBox */
/** @typedef {import("../lib/figma.mjs").Box} Box */
/**
 * What render.mjs writes into the page.
 * @typedef {PageDrawing & {
 *   approvalDate: string | null,
 *   fingerprint: import("../lib/cutSummary.mjs").Fingerprint,
 *   verdicts: { key: string, label: string, color: string }[],
 * }} Cut
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

/** @type {Cut} */
const cut = JSON.parse(getElement("cut").textContent ?? "")

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

/** @param {Box} box */
function pickBox({ x, y, width, height }) {
  return { x, y, width, height }
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
  const y = badgePlace === "above" ? box.y - cut.badgeHeight : box.y
  return [
    createSvgElement("rect", {
      class: "badge",
      x,
      y,
      width: badgeWidth,
      height: cut.badgeHeight,
    }),
    createSvgElement(
      "text",
      {
        class: "badge-text",
        x: x + BADGE_TEXT_PADDING_X,
        y: y + cut.badgeHeight - BADGE_TEXT_RISE,
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
    const box = pickBox(outline.box)
    group.append(
      createSvgElement("rect", { class: "outline-halo", ...box }),
      createSvgElement("rect", { class: "outline", ...box }),
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
    createSvgElement("rect", pickBox(looseText.box)),
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
    ...pickBox(screen.capture),
  })
  for (const outline of screen.outlines) {
    const fill = outline.isSameOnEveryScreen ? "white" : "black"
    mask.append(
      createSvgElement("rect", {
        fill,
        stroke: "none",
        ...pickBox(outline.box),
      }),
    )
  }
  const veil = createSvgElement("rect", {
    class: "veil-over-same-components",
    mask: `url(#${maskId})`,
    ...pickBox(screen.capture),
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
 * Isolates one candidate on every screen: its outlines, labels and reason keep their
 * colour, everything else fades, and the capture is veiled except where the candidate is
 * drawn. Called with the same number again, or with null, shows everything back.
 * @param {number | null} candidateNumber
 */
function isolate(candidateNumber) {
  isolatedNumber = candidateNumber === isolatedNumber ? null : candidateNumber
  document.body.classList.toggle("isolating", isolatedNumber !== null)
  for (const element of document.querySelectorAll("[data-candidate]")) {
    const number = Number(element.getAttribute("data-candidate"))
    element.classList.toggle("isolated", number === isolatedNumber)
  }
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
}

/** @param {DrawnScreen} screen */
function drawScreen(screen) {
  const svg = /** @type {SVGSVGElement} */ (createSvgElement("svg", {}))
  const isolationMask = createSvgElement("path", { class: "isolation-mask" })
  showBox(svg, screen.ownBox)
  svg.append(
    createSvgElement("image", {
      href: screen.captureDataUrl,
      ...pickBox(screen.capture),
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
  section.append(title, svg)
  getElement("screens").append(section)
  return { screen, section, svg }
}

/**
 * Tabs show one screen at a time, all at the same place and size: switching tab shows
 * what changes from one screen to the next. The last tab shows them all, one under the other.
 * @param {ReturnType<typeof drawScreen>[]} drawnScreens
 */
function drawTabs(drawnScreens) {
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
      showBox(svg, shown === ALL_SCREENS ? screen.ownBox : cut.commonBox)
    }
  }
  const buttons = choices.map(({ shown, text }) => {
    const button = createElement("button", text)
    button.setAttribute("type", "button")
    button.setAttribute("role", "tab")
    button.addEventListener("click", () => show(shown))
    return button
  })
  const hint = createElement("span", "← → pour passer d'un écran à l'autre")
  hint.className = "tabs-hint"
  getElement("tabs").append(...buttons, hint)

  document.addEventListener("keydown", (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!step) return
    const index = choices.findIndex((choice) => choice.shown === shownNow)
    show(choices[(index + step + choices.length) % choices.length].shown)
  })
  show(choices[0].shown)
}

/**
 * @param {string} switchId
 * @param {string} classOnBody what the page's styles react to while the switch is on
 */
function wireSwitch(switchId, classOnBody) {
  getElement(switchId).addEventListener("change", (event) => {
    const isOn = /** @type {HTMLInputElement} */ (event.target).checked
    document.body.classList.toggle(classOnBody, isOn)
  })
}

function drawHeader() {
  const { fingerprint } = cut
  document.title = `Découpage — ${cut.title}`
  getElement("screen-name").textContent = cut.title
  const approval = getElement("approval")
  approval.textContent = cut.approvalDate
    ? `Validé par le développeur le ${cut.approvalDate}`
    : "Brouillon — pas encore validé par le développeur"
  approval.classList.toggle("approved", Boolean(cut.approvalDate))
  getElement("fingerprint").textContent =
    `Construit le ${fingerprint.createdAt} · maquette modifiée le ${fingerprint.figma.lastModified.slice(0, 10)} · commit ${fingerprint.gitCommit}`

  // Each verdict's colour comes with the data: "--reused" for the page's own rules, and
  // "--verdict" on any element that carries the verdict as a class.
  const verdictColours = createElement(
    "style",
    cut.verdicts
      .map(
        ({ key, color }) =>
          `:root { --${key}: ${color}; } .${key} { --verdict: var(--${key}); }`,
      )
      .join("\n"),
  )
  document.head.append(verdictColours)
  for (const { key, label } of cut.verdicts) {
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
  if (cut.notOutlined.length) {
    getElement("not-outlined").textContent =
      `Non entourés : ${cut.notOutlined.join(" ; ")}`
  }
}

/**
 * Under the images: why a component is not simply reused (what has to change, why it is
 * left out, what the developer has to decide).
 */
function drawExplanations() {
  for (const explanation of cut.explanations) {
    const item = createElement("li")
    item.className = classOfPart(explanation)
    item.setAttribute("data-candidate", String(explanation.candidateNumber))
    item.addEventListener("click", () => isolate(explanation.candidateNumber))
    item.append(createElement("strong", explanation.title))
    if (explanation.reason) item.append(createElement("br"), explanation.reason)
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
    getElement("explanations").append(item)
  }
}

drawHeader()
const drawnScreens = cut.screens.map(drawScreen)
wireSwitch("texts-outside-leaves", "texts-outside-leaves")
if (drawnScreens.length > 1) {
  drawTabs(drawnScreens)
  getElement("differences-switch").hidden = false
  wireSwitch("differences-only", "differences-only")
}
drawExplanations()

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isolatedNumber !== null) isolate(null)
})
// A click beside the images and the reasons shows everything back; the page's own
// controls (tabs, switches, links) leave the isolation as it is.
document.addEventListener("click", (event) => {
  const isOnTheDrawingOrAControl =
    event.target instanceof Element &&
    event.target.closest(".screens svg, [data-candidate], button, label, a")
  if (!isOnTheDrawingOrAControl) isolate(null)
})
