// @ts-check
// The script of specs.html: draws what lib/specsPageDrawing.mjs worked out, and answers the
// component tabs, the screen tabs and the clicks on a zone, and turns the developer's
// corrections into text for the chat. render.mjs pastes it into the page, so it imports
// nothing: the functions of the inventory skill's pageReview.mjs and of
// lib/specsFeedbackText.mjs are pasted before it.

/** @typedef {import("../lib/specsPageDrawing.mjs").SpecsPageDrawing} SpecsPageDrawing */
/** @typedef {import("../lib/specsPageDrawing.mjs").DrawnComponent} DrawnComponent */
/** @typedef {import("../lib/componentSpecs.mjs").PropSpec} PropSpec */
/** @typedef {import("../lib/componentSpecs.mjs").ZoneKindKey} ZoneKindKey */
/** @typedef {import("../lib/specsFeedbackText.mjs").SpecCorrection} SpecCorrection */
/**
 * What render.mjs writes into the page.
 * @typedef {SpecsPageDrawing & {
 *   captureDataUrlsByFile: Record<string, string>,
 *   stillToDecideCount: number,
 * }} Specs
 */

/** @param {string} id */
function getElement(id) {
  const element = document.getElementById(id)
  if (!element) throw new Error(`The page has no element "${id}"`)
  return element
}

/**
 * @param {string} tagName
 * @param {{ className?: string, text?: string }} [content]
 * @param {(HTMLElement | string)[]} [children]
 */
function createElement(tagName, { className, text } = {}, children = []) {
  const element = document.createElement(tagName)
  if (className) element.className = className
  if (text !== undefined) element.textContent = text
  element.append(...children)
  return element
}

const specsElement = getElement("specs")
/** @type {Specs} */
const specs = JSON.parse(specsElement.textContent ?? "")
// Its text holds the captures a second time; the parsed copy is all the page needs.
specsElement.remove()

const componentsHeldByAnother = new Set(
  specs.components.flatMap((component) => component.holdsDirectly),
)
// The tree's roots: the components no other component to specify is drawn around.
const outermostComponents = specs.components.filter(
  (component) => !componentsHeldByAnother.has(component.codeComponent),
)
/** @param {DrawnComponent} component the components drawn directly inside it, in the page's order */
const listHeldComponents = (component) =>
  specs.components.filter((other) =>
    component.holdsDirectly.includes(other.codeComponent),
  )
/**
 * The components as the tree lists them from top to bottom, each once: a component, then
 * what it holds. The button to the next box follows that order.
 * @param {DrawnComponent[]} components the components of one level of the tree
 * @returns {DrawnComponent[]}
 */
const listInTreeOrder = (components) => [
  ...new Set(
    components.flatMap((component) => [
      component,
      ...listInTreeOrder(listHeldComponents(component)),
    ]),
  ),
]
const componentsInTreeOrder = listInTreeOrder(outermostComponents)
// The page opens on the top of the tree: the whole first, then what it holds.
let shownComponent = outermostComponents[0]
let shownScreenNumber = shownComponent.screens[0].screenNumber
/** The letter of the zone whose props the panel shows; "" for the whole component. */
let selectedZoneLetter = ""

/**
 * @param {string} letter
 * @param {ZoneKindKey} kind
 */
function createBadge(letter, kind) {
  const badge = createElement("span", { className: "item-badge", text: letter })
  badge.style.setProperty("--item-color", specs.zoneKinds[kind].color)
  return badge
}

/** @param {string} title */
const createPanelHeading = (title) => createElement("h3", { text: title })

/** The screen whose tab is picked; the component's first one when it is not drawn on that screen. */
const findShownScreen = () =>
  shownComponent.screens.find(
    (each) => each.screenNumber === shownScreenNumber,
  ) ?? shownComponent.screens[0]

/**
 * Places an element of the cut. One pixel of the mock-up is one pixel of the page, as in
 * the inventory's page: a component looks the same size in both.
 * @param {HTMLElement} element
 * @param {{ x: number, y: number, width: number, height?: number }} box in pixels of the mock-up; without a height the element keeps its own
 */
function placeInCut(element, { x, y, width, height }) {
  element.style.left = `${x}px`
  element.style.top = `${y}px`
  element.style.width = `${width}px`
  if (height !== undefined) element.style.height = `${height}px`
}

/** The zone the developer clicked; undefined while none is. */
const findSelectedZone = () =>
  shownComponent.zones.find((zone) => zone.letter === selectedZoneLetter)

/**
 * A prop with what it says, and the zones it drives. While a zone is selected, the props it
 * names stand out and the others fade: the list stays the same, so that it reads as the
 * component's props seen from that zone.
 * @param {PropSpec} prop
 */
function createPropCard(prop) {
  const zonesUsingProp = shownComponent.zones.filter((zone) =>
    zone.props?.includes(prop.name),
  )
  const selectedZone = findSelectedZone()
  const rows = [
    createElement("dt", { text: translate("prop.type") }),
    createElement(
      "dd",
      {},
      prop.typeBefore
        ? [
            createElement("code", { text: prop.typeBefore }),
            " → ",
            createElement("code", { text: prop.type }),
          ]
        : [createElement("code", { text: prop.type })],
    ),
    createElement("dt", { text: translate("prop.source") }),
    createElement("dd", { text: prop.source }),
  ]
  if (prop.note) {
    rows.push(
      createElement("dt", { text: translate("prop.rule") }),
      createElement("dd", { text: prop.note }),
    )
  }
  rows.push(
    createElement("dt", { text: translate("prop.zones") }),
    createElement(
      "dd",
      { className: "prop-zones" },
      zonesUsingProp.map((zone) => createBadge(zone.letter, zone.kind)),
    ),
  )
  const tags = [
    createElement("span", {
      className: "prop-tag",
      text: translate(prop.required ? "prop.required" : "prop.optional"),
    }),
  ]
  if (prop.change) {
    tags.unshift(
      createElement("span", {
        className: "prop-tag prop-change",
        text: inPageLanguage(specs.propChangeLabels[prop.change]),
      }),
    )
  }
  const card = createElement("div", { className: "prop" }, [
    createElement("code", { className: "prop-name", text: prop.name }),
    ...tags,
    createElement("dl", {}, rows),
  ])
  if (selectedZone) {
    const isDrivingSelectedZone = zonesUsingProp.includes(selectedZone)
    card.classList.add(
      isDrivingSelectedZone ? "drives-selected-zone" : "outside-selected-zone",
    )
    card.style.setProperty("--kind", specs.zoneKinds[selectedZone.kind].color)
  }
  return card
}

/**
 * A titled list of props, or nothing when there is none: the panel shows what there is to
 * read, never that a list is empty.
 * @param {string} title
 * @param {PropSpec[]} props
 */
const createPropsSection = (title, props) =>
  props.length ? [createPanelHeading(title), ...props.map(createPropCard)] : []

/**
 * What the panel says of the whole component, whether or not a zone is selected. A
 * component to adapt shows what changes only: its props that exist and stay as they are
 * have nothing to tell.
 */
function createComponentSummary() {
  const decisions = shownComponent.developerDecisions.map((decision) =>
    createElement("p", {
      className: "developer-words",
      text: translate("panel.developerDecision", { decision }),
    }),
  )
  if (!shownComponent.isToAdapt) {
    const propsHeading = shownComponent.props.length
      ? [createElement("h2", { text: translate("panel.allProps") })]
      : []
    return [
      ...propsHeading,
      ...shownComponent.props.map(createPropCard),
      ...decisions,
    ]
  }
  const summary = [
    createElement("h2", { text: translate("panel.whatChanges") }),
  ]
  if (shownComponent.changes.length) {
    summary.push(
      createElement("table", { className: "changes" }, [
        createElement("thead", {}, [
          createElement(
            "tr",
            {},
            ["", translate("panel.before"), translate("panel.after")].map(
              (title) => createElement("th", { text: title }),
            ),
          ),
        ]),
        createElement(
          "tbody",
          {},
          shownComponent.changes.map(({ what, before, after }) =>
            createElement("tr", {}, [
              createElement("th", { text: what }),
              createElement("td", { className: "change-before", text: before }),
              createElement("td", { className: "change-after", text: after }),
            ]),
          ),
        ),
      ]),
    )
  }
  summary.push(
    ...createPropsSection(
      translate("panel.changedProps"),
      shownComponent.props,
    ),
    ...decisions,
  )
  return summary
}

// The boxes the developer ticks: one for what the panel says of a component, and one for
// the component's zones on each of its screens.

/**
 * The box of what the panel says of a component. A component that carries a correction is
 * not right as it is.
 * @param {DrawnComponent} component
 * @returns {ReviewCheck}
 */
const describeComponentCheck = (component) => ({
  reviewHash: component.reviewHash,
  label: translate("review.component"),
  subject: "component",
  whyNotYet: corrections.has(nameCorrectionTarget(component.codeComponent))
    ? WHY_NOT_YET.corrected
    : null,
})

/**
 * The box of a component's zones on one screen. It waits while a zone drawn there asks a
 * question or carries a correction.
 * @param {DrawnComponent} component
 * @param {DrawnComponent["screens"][number]} screen
 * @returns {ReviewCheck}
 */
function describeScreenCheck(component, screen) {
  const zonesDrawn = component.zones.filter((zone) =>
    screen.outlines.some((outline) => outline.zoneLetter === zone.letter),
  )
  const isAZoneCorrected = zonesDrawn.some((zone) =>
    corrections.has(nameCorrectionTarget(component.codeComponent, zone.letter)),
  )
  const whyNotWhileUndecided = zonesDrawn.some(
    (zone) => zone.kind === "to-decide",
  )
    ? WHY_NOT_YET.undecided
    : null
  return {
    reviewHash: screen.reviewHash,
    label: translate("review.screen", {
      component: component.codeComponent,
    }),
    subject: "screen",
    whyNotYet: isAZoneCorrected ? WHY_NOT_YET.corrected : whyNotWhileUndecided,
  }
}

/** @param {DrawnComponent} component its own box, then one per screen */
const listChecksOfComponent = (component) => [
  describeComponentCheck(component),
  ...component.screens.map((screen) => describeScreenCheck(component, screen)),
]

/**
 * One zone, written like a reason of the inventory's page: its letter and its name in the
 * colour of its kind, then the props it names, its rules and the question it asks.
 * @param {DrawnComponent["zones"][number]} zone
 */
function createZoneItem(zone) {
  const kind = specs.zoneKinds[zone.kind]
  const title = createElement("button", { className: "item-title" }, [
    createBadge(zone.letter, zone.kind),
    `${zone.label} — ${inPageLanguage(kind.labels)}`,
  ])
  title.setAttribute("type", "button")
  title.setAttribute("aria-pressed", String(zone.letter === selectedZoneLetter))
  const lines = []
  if (zone.props?.length) {
    const propNamesWithCommas = zone.props.flatMap((name, index) => [
      ...(index ? [", "] : []),
      createElement("code", { text: name }),
    ])
    lines.push(
      createElement("p", {}, [translate("zone.props"), ...propNamesWithCommas]),
    )
  }
  lines.push(
    ...(zone.notes ?? []).map((note) => createElement("p", { text: note })),
  )
  if (zone.question) {
    lines.push(
      createElement("p", { text: zone.question }),
      createElement(
        "ol",
        {},
        (zone.options ?? []).map((option) =>
          createElement("li", { text: option }),
        ),
      ),
    )
  }
  const componentToOpen = specs.components.find(
    (component) => component.codeComponent === zone.opensComponent,
  )
  if (componentToOpen) {
    // The zone says what the parent gives that component; its own specs are one click away.
    const link = createElement("button", {
      className: "open-component",
      text: translate("zone.openComponent", {
        component: componentToOpen.codeComponent,
      }),
    })
    link.setAttribute("type", "button")
    link.addEventListener("click", (event) => {
      event.stopPropagation()
      shownComponent = componentToOpen
      selectedZoneLetter = ""
      draw()
    })
    lines.push(link)
  }
  const item = createElement("li", {}, [title, ...lines])
  item.classList.toggle("picked", zone.letter === selectedZoneLetter)
  item.style.setProperty("--item-color", kind.color)
  item.addEventListener("click", () => selectZone(zone.letter))
  return item
}

/**
 * The zones the shown screen draws, each with its rules. A zone that outlines a component
 * with specs of its own is listed too: the props and the rules it names are the parent's.
 * @param {Set<string>} lettersOnShownScreen
 */
function createZoneItems(lettersOnShownScreen) {
  const zonesToReview = shownComponent.zones.filter((zone) =>
    lettersOnShownScreen.has(zone.letter),
  )
  if (!zonesToReview.length) return []
  const list = createElement(
    "ul",
    { className: "panel-items" },
    zonesToReview.map(createZoneItem),
  )
  list.classList.toggle("has-picked", selectedZoneLetter !== "")
  return [createPanelHeading(translate("panel.zones")), list]
}

/** The count of what is checked, and the invitation to approve once nothing blocks it. */
function showReview() {
  showReviewProgress(componentsInTreeOrder.flatMap(listChecksOfComponent), {
    isApproved: specs.approvalDate !== null,
    stillToDecideCount: specs.stillToDecideCount,
    correctionCount: corrections.size,
    showCheck: showReviewBoxOf,
  })
}

/**
 * The two boxes on the page: the shown component's, and the one of its shown screen.
 * @type {{ ofComponent: HTMLElement, ofScreen: HTMLElement } | null}
 */
let shownReviewBoxes = null

/** Shows again whether the two boxes on the page can be ticked, without redrawing the page. */
function refreshShownReviewBoxes() {
  if (!shownReviewBoxes) return
  fillReviewBox(
    shownReviewBoxes.ofScreen,
    describeScreenCheck(shownComponent, findShownScreen()),
  )
  fillReviewBox(
    shownReviewBoxes.ofComponent,
    describeComponentCheck(shownComponent),
  )
}

/**
 * Brings a box into view: its component, and for a screen's box that screen.
 * @param {ReviewCheck} check
 */
function showReviewBoxOf(check) {
  for (const component of specs.components) {
    const screen = component.screens.find(
      (each) => each.reviewHash === check.reviewHash,
    )
    if (!screen && component.reviewHash !== check.reviewHash) continue
    shownComponent = component
    selectedZoneLetter = ""
    if (screen) shownScreenNumber = screen.screenNumber
    draw()
    if (shownReviewBoxes) {
      pointAtReviewBox(
        screen ? shownReviewBoxes.ofScreen : shownReviewBoxes.ofComponent,
      )
    }
    return
  }
}

/**
 * The screens the shown component is drawn on, one tab each.
 * @param {{ title: string, isSelected: boolean, isReviewed: boolean, select: () => void }[]} tabs
 */
function drawScreenTabs(tabs) {
  getElement("screen-tabs").replaceChildren(
    ...tabs.map(({ title, isSelected, isReviewed, select }) => {
      const tab = createElement("button", { text: title })
      tab.setAttribute("type", "button")
      tab.setAttribute("role", "tab")
      tab.setAttribute("aria-selected", String(isSelected))
      tab.classList.toggle("reviewed", isReviewed)
      tab.addEventListener("click", select)
      return tab
    }),
  )
}

/**
 * The components as a tree: under each one, the components drawn directly inside it. A
 * click on a component shows its specs. A component drawn inside two others is listed
 * under both. A square tells each component's verdict; the legend under the tree names
 * the colours.
 * @param {DrawnComponent[]} components the components of one level of the tree
 * @returns {HTMLElement}
 */
function createComponentTree(components) {
  return createElement(
    "ul",
    {},
    components.map((component) => {
      const isComponentReviewed =
        listChecksOfComponent(component).every(isReviewed)
      const button = createElement("button", {}, [
        createElement("span", { text: component.codeComponent }),
        createElement("i", { className: "verdict-mark" }),
      ])
      button.setAttribute("type", "button")
      // The mark's colour is said in words to who does not see it.
      button.setAttribute(
        "aria-label",
        translate(
          isComponentReviewed ? "tree.componentReviewed" : "tree.component",
          {
            component: component.codeComponent,
            verdict: inPageLanguage(component.verdict.labels),
          },
        ),
      )
      if (component === shownComponent)
        button.setAttribute("aria-current", "true")
      button.style.setProperty("--verdict", component.verdict.color)
      button.classList.toggle("reviewed", isComponentReviewed)
      button.addEventListener("click", () => {
        shownComponent = component
        selectedZoneLetter = ""
        draw()
      })
      const heldComponents = listHeldComponents(component)
      return createElement("li", {}, [
        button,
        ...(heldComponents.length ? [createComponentTree(heldComponents)] : []),
      ])
    }),
  )
}

/** @type {Map<string, HTMLImageElement>} */
const captureImagesByFile = new Map()

/**
 * The image of a capture, built once: a capture weighs up to a few megabytes, and every
 * click redraws the screen.
 * @param {string} file
 */
function getCaptureImage(file) {
  let image = captureImagesByFile.get(file)
  if (!image) {
    image = document.createElement("img")
    image.src = specs.captureDataUrlsByFile[file]
    image.alt = ""
    captureImagesByFile.set(file, image)
  }
  return image
}

function draw() {
  const screen = findShownScreen()
  shownScreenNumber = screen.screenNumber
  const lettersOnShownScreen = new Set(
    screen.outlines.map((outline) => outline.zoneLetter),
  )
  // A zone the new screen does not draw (the heating period on "Continu") cannot stay selected.
  if (!lettersOnShownScreen.has(selectedZoneLetter)) selectedZoneLetter = ""

  getElement("component-tree").replaceChildren(
    createComponentTree(outermostComponents),
  )
  drawScreenTabs(
    shownComponent.screens.map((each) => ({
      title: each.tabName,
      isSelected: each === screen,
      isReviewed: isReviewed(describeScreenCheck(shownComponent, each)),
      select: () => {
        shownScreenNumber = each.screenNumber
        draw()
      },
    })),
  )
  const sameScreens = screen.sameOnScreenNumbers
  const sizeTextKey =
    sameScreens.length === 0
      ? "screen.size"
      : `screen.sizeSameSpecs.${sameScreens.length > 1 ? "several" : "one"}`
  const figmaLink = createElement("a", {
    text: translate("screen.link", {
      number: screen.screenNumber,
      name: screen.screenName,
    }),
  })
  figmaLink.setAttribute("href", screen.figmaUrl)
  getElement("screen-caption").replaceChildren(
    figmaLink,
    createElement("span", {
      text: translate(sizeTextKey, {
        component: shownComponent.codeComponent,
        width: screen.componentFrame.width,
        height: screen.componentFrame.height,
        screens: sameScreens.join(", "),
      }),
    }),
    createElement("span", {
      text: shownComponent.codePath ?? translate("screen.noFile"),
    }),
  )

  const image = getCaptureImage(screen.capture.file)
  placeInCut(image, screen.capture)
  const lettersWithABadge = new Set()
  const outlines = screen.outlines.map((outline) => {
    const zone = shownComponent.zones.find(
      (each) => each.letter === outline.zoneLetter,
    )
    const button = createElement("button", { className: "outline" })
    button.setAttribute("type", "button")
    button.setAttribute(
      "aria-label",
      translate("outline.zone", {
        letter: outline.zoneLetter,
        label: zone?.label ?? "",
      }),
    )
    button.classList.toggle(
      "selected",
      outline.zoneLetter === selectedZoneLetter,
    )
    if (zone)
      button.style.setProperty("--kind", specs.zoneKinds[zone.kind].color)
    placeInCut(button, outline)
    // A zone drawn in several boxes (two date fields) shows its letter once.
    if (zone && !lettersWithABadge.has(zone.letter)) {
      lettersWithABadge.add(zone.letter)
      button.append(createBadge(zone.letter, zone.kind))
    }
    button.addEventListener("click", () => selectZone(outline.zoneLetter))
    return button
  })
  const cut = getElement("cut")
  cut.style.width = `${screen.cut.width}px`
  cut.style.height = `${screen.cut.height}px`
  cut.classList.toggle("has-selection", selectedZoneLetter !== "")
  // The image shows the whole container; what is outside the shown component is faded.
  const componentFrame = createElement("div", { className: "component-frame" })
  placeInCut(componentFrame, screen.componentFrame)
  cut.replaceChildren(image, componentFrame, ...outlines)
  const screenReviewBox = createReviewBox(
    describeScreenCheck(shownComponent, screen),
    draw,
  )
  const componentReviewBox = createReviewBox(
    describeComponentCheck(shownComponent),
    draw,
  )
  shownReviewBoxes = {
    ofComponent: componentReviewBox,
    ofScreen: screenReviewBox,
  }
  getElement("screen-review").replaceChildren(screenReviewBox)
  getElement("panel").replaceChildren(
    ...createZoneItems(lettersOnShownScreen),
    ...createComponentSummary(),
    componentReviewBox,
  )
  fillCorrectionForm()
  showReview()
}

// The developer's corrections, by what they apply to: a component or one of its zones.
// They are kept in the browser for these specs only: once applied, the page is rebuilt
// from other specs and starts without them.
/** @type {Map<string, SpecCorrection>} */
const corrections = new Map()
const correctionsStorageKey = `specs-corrections ${specs.specsHash}`
/** What a correction can apply to, by its name: a component, or one of its zones. */
const correctableByTarget = new Map(
  specs.components.flatMap((component) => [
    [
      nameCorrectionTarget(component.codeComponent),
      { component, zoneLetter: "" },
    ],
    ...component.zones.map(
      /** @returns {[string, { component: DrawnComponent, zoneLetter: string }]} */
      (zone) => [
        nameCorrectionTarget(component.codeComponent, zone.letter),
        { component, zoneLetter: zone.letter },
      ],
    ),
  ]),
)
const targetsInPageOrder = [...correctableByTarget.keys()]

/**
 * Shows what a correction applies to, with the form on it: the component, and for a zone
 * a screen that draws it.
 * @param {string} target "Select", or "Select · zone A"
 */
function openCorrection(target) {
  const correctable = correctableByTarget.get(target)
  if (!correctable) return
  shownComponent = correctable.component
  selectedZoneLetter = correctable.zoneLetter
  const drawsTheZone = (
    /** @type {DrawnComponent["screens"][number]} */ screen,
  ) =>
    screen.outlines.some(
      (outline) => outline.zoneLetter === correctable.zoneLetter,
    )
  if (correctable.zoneLetter && !drawsTheZone(findShownScreen())) {
    shownScreenNumber =
      shownComponent.screens.find(drawsTheZone)?.screenNumber ??
      shownScreenNumber
  }
  draw()
}
const correctionForm = /** @type {HTMLFormElement} */ (getElement("correction"))
const noteInput = /** @type {HTMLInputElement} */ (
  getElement("correction-note")
)
const feedbackTextArea = /** @type {HTMLTextAreaElement} */ (
  getElement("feedback-text")
)

const nameShownTarget = () =>
  nameCorrectionTarget(shownComponent.codeComponent, selectedZoneLetter)

/** Shows in the form what is selected, the zone or the whole component, and its correction. */
function fillCorrectionForm() {
  const target = nameShownTarget()
  const correction = corrections.get(target)
  const options = findSelectedZone()?.options ?? []
  getElement("correction-title").textContent = translate("correction.title", {
    target,
  })
  const answers = getElement("correction-answers")
  answers.hidden = !options.length
  answers.replaceChildren(
    createElement("legend", { text: translate("correction.answer") }),
    ...options.map((option) => {
      const radio = /** @type {HTMLInputElement} */ (createElement("input"))
      radio.type = "radio"
      radio.name = "correction-answer"
      radio.value = option
      radio.checked = option === correction?.answer
      return createElement("label", {}, [radio, option])
    }),
  )
  noteInput.value = correction?.note ?? ""
  getElement("correction-clear").hidden = !correction
}

const listSortedCorrections = () =>
  sortSpecCorrections([...corrections.values()], targetsInPageOrder)

/** Updates the count, the list of corrections and the copy the browser keeps. */
function showCorrections() {
  const sortedCorrections = listSortedCorrections()
  const count = sortedCorrections.length
  getElement("feedback-lines").replaceChildren(
    ...sortedCorrections.map((correction) => {
      const line = createElement("button", {
        text: `${correction.target} — ${listSpecCorrectionFields(correction, translate).join(" · ")}`,
      })
      line.setAttribute("type", "button")
      line.setAttribute("title", translate("correction.reopen"))
      line.addEventListener("click", () => openCorrection(correction.target))
      return createElement("li", {}, [line])
    }),
  )
  getElement("feedback-count").textContent = count
    ? translate(`corrections.count.${count > 1 ? "several" : "one"}`, { count })
    : translate("corrections.none")
  feedbackTextArea.hidden = true
  getElement("correction-clear").hidden = !corrections.has(nameShownTarget())
  for (const id of ["feedback-copy", "feedback-reset"])
    getElement(id).hidden = !count
  try {
    if (count) {
      localStorage.setItem(
        correctionsStorageKey,
        JSON.stringify(sortedCorrections),
      )
    } else localStorage.removeItem(correctionsStorageKey)
  } catch {
    // The browser keeps nothing for this page: the corrections last until it is closed.
  }
}

function saveCorrectionForm() {
  const target = nameShownTarget()
  const answer = new FormData(correctionForm).get("correction-answer")
  const correction = buildSpecCorrection(target, {
    answer: typeof answer === "string" ? answer : null,
    note: noteInput.value,
  })
  if (correction) corrections.set(target, correction)
  else corrections.delete(target)
  showCorrections()
  showWhatACorrectionBlocks()
}

/**
 * A correction decides which boxes can be ticked. Only the boxes are shown again: a whole
 * redraw would take the caret out of the field being typed in.
 */
function showWhatACorrectionBlocks() {
  refreshShownReviewBoxes()
  showReview()
}

function copyFeedbackText() {
  const text = buildSpecsFeedbackText(
    subject,
    listSortedCorrections(),
    translate,
  )
  copyWithConfirmation(getElement("feedback-copy"), text, () => {
    feedbackTextArea.value = text
    feedbackTextArea.hidden = false
    feedbackTextArea.select()
  })
}

/** @param {Iterable<string>} targets the corrections to drop */
function dropCorrections(targets) {
  for (const target of [...targets]) corrections.delete(target)
  showCorrections()
  draw()
}

correctionForm.addEventListener("submit", (event) => event.preventDefault())
correctionForm.addEventListener("input", saveCorrectionForm)
getElement("correction-clear").addEventListener("click", () =>
  dropCorrections([nameShownTarget()]),
)
getElement("feedback-copy").addEventListener("click", copyFeedbackText)
getElement("feedback-reset").addEventListener("click", () => {
  if (window.confirm(translate("corrections.confirmReset")))
    dropCorrections(corrections.keys())
})
try {
  /** @type {SpecCorrection[]} */
  const savedCorrections = JSON.parse(
    localStorage.getItem(correctionsStorageKey) ?? "[]",
  )
  for (const correction of savedCorrections)
    corrections.set(correction.target, correction)
} catch {
  // Nothing kept, or unreadable: the page starts without corrections.
}
restoreReview(
  `specs-reviewed ${specs.reviewKey}`,
  specs.components.flatMap((component) => [
    component.reviewHash,
    ...component.screens.map((screen) => screen.reviewHash),
  ]),
)

/**
 * A click on a zone: its props stand out in the panel, and the whole component is back on
 * a second click.
 * @param {string} letter
 */
function selectZone(letter) {
  selectedZoneLetter = selectedZoneLetter === letter ? "" : letter
  draw()
}

const subject = inPageLanguage(specs.title)
document.title = translate("page.documentTitle", { subject })
showPageHeader({
  subject,
  approvalDate: specs.approvalDate,
  fingerprintLine: inPageLanguage(specs.fingerprintLine),
})
getElement("legend").replaceChildren(
  ...specs.zoneKindsInTheLegend.map((kindKey) => {
    const kind = specs.zoneKinds[kindKey]
    const item = createElement("li", { text: inPageLanguage(kind.labels) })
    item.style.setProperty("--kind", kind.color)
    return item
  }),
)
// Under the tree: what the colour of a component's mark means, for the verdicts it shows.
const coloursOfVerdictsInTheTree = new Map(
  specs.components.map(({ verdict }) => [
    inPageLanguage(verdict.labels),
    verdict.color,
  ]),
)
getElement("tree-legend").replaceChildren(
  ...[...coloursOfVerdictsInTheTree].map(([label, color]) => {
    const item = createElement("li", {}, [
      createElement("i", { className: "verdict-mark" }),
      label,
    ])
    item.style.setProperty("--verdict", color)
    return item
  }),
)
document.addEventListener("keydown", (event) => {
  if (isTypingInAField(event)) return
  const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key]
  if (event.key === "Escape") selectedZoneLetter = ""
  else if (step) {
    const { screens } = shownComponent
    const shownIndex = screens.indexOf(findShownScreen())
    shownScreenNumber =
      screens[(shownIndex + step + screens.length) % screens.length]
        .screenNumber
  } else return
  draw()
})
// A click beside the capture and the panel shows the whole component back; the page's own
// controls (the tree, the tabs, links, the correction form) leave the selection as it is.
document.addEventListener("click", (event) => {
  const isOnTheCaptureOrAControl =
    event.target instanceof Element &&
    event.target.closest(".cut, .side-panel, .feedback, button, label, a")
  if (isOnTheCaptureOrAControl || selectedZoneLetter === "") return
  selectedZoneLetter = ""
  draw()
})
draw()
showCorrections()

// The tree follows the scroll only while it is a column beside the capture: stuck above
// the capture, it would cover it.
const componentTreeColumn = /** @type {HTMLElement} */ (
  getElement("component-tree").parentElement
)
const captureCard = /** @type {HTMLElement} */ (getElement("cut").parentElement)
new ResizeObserver(() => {
  componentTreeColumn.classList.remove("beside-capture")
  componentTreeColumn.classList.toggle(
    "beside-capture",
    componentTreeColumn.offsetTop === captureCard.offsetTop,
  )
}).observe(document.body)
