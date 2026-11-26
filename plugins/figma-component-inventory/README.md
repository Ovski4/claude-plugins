# figma-component-inventory — which components of a Figma screen the code already has

For one Figma screen, or several screens of one design, the inventory of the components:
each one is judged reused as it is, to adapt, to create, or out of scope. The result is a
page showing each capture with a numbered outline around each component. The outline's
colour gives the verdict, so the developer approves the inventory by looking at it.

With several screens (the states of a dialog, its desktop and mobile sizes), a component
keeps one number everywhere, and the areas whose content changes from one screen to the
next are pointed out: for each, the model proposes one component with a prop or several
components, and the developer decides.

- **The scripts** read Figma, compute every position, prepare what the repo already says
  about each component, and draw.
- **The model** says, for each component, which React component it is and its verdict. Its
  instructions are in `skills/figma-component-inventory/SKILL.md`, which is all it reads.

Call it with `/figma-component-inventory <figma-url>`, or with one URL per screen. With a
single URL, it lists the screens drawn beside it in Figma and asks which ones to judge
together.

It is written for Claude Sonnet: in Claude Code, the `model` field of `SKILL.md` selects it.
A tool that ignores that field runs the skill on its current model.

The plugin holds a second skill, `/figma-component-specs <inventory-out-dir>`, the step after
an approved inventory: for each component to create or to adapt, its props and what each one
drives on the captures. It is described in
[its own section](#figma-component-specs--the-props-of-the-components-to-create-or-to-adapt);
everything before that section is about the inventory.

## What it needs

The scripts judge the code of the repo they are run from.

| Needed                                                              | Why                                                                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A Figma file, and `FIGMA_TOKEN` in the environment (read access)    | The script reads the screen and its capture from Figma's API, the first time it runs on a screen.     |
| A screen drawn with Figma components                                | The script lists the components the screen uses. A screen made of plain frames gives little to judge. |
| React components written in TypeScript, in one folder of a Git repo | The script lists the files Git tracks there and gives the model their `…Props` declarations.          |
| Node 20 or later                                                    | To run the scripts.                                                                                   |
| The settings file below                                             | It says where the components are.                                                                     |

Worth having, not required:

- a design system in the code: without one, no component has priority over another;
- a Figma-to-code map (described below): without one, no name is pre-filled.

Other frameworks (Vue, Svelte) have not been tried: the instructions speak of React
components, and only TypeScript props declarations are read.

The page and the notes are written in French.

## Settings

The repo declares its paths in
`.claude/figma-component-inventory.json`:

```json
{
  "componentsFolder": "src/components",
  "componentFileExtensions": [".tsx"],
  "designSystemFolder": "src/components/ui",
  "figmaToCodeMap": "docs/design/figma-react-map.md"
}
```

| Setting                   | What it is                                                                                                                                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `componentsFolder`        | The folder that holds every UI component. Required.                                                                                                                                                                                                                                 |
| `componentFileExtensions` | The extensions of a component file. Test and Storybook files (`button.test.tsx`, `button.stories.tsx`) are left out. Required.                                                                                                                                                      |
| `designSystemFolder`      | The folder of the shared components: its files are proposed to the model before a feature's own. `null` or absent: no file gets priority.                                                                                                                                           |
| `figmaToCodeMap`          | The table that gives the component of each Figma component. `null` or absent: no name is pre-filled, the model finds every component in the code. At approval, the Figma components that existing code draws and the table does not name yet are added to its "Components" section. |

All paths start at the repo's root. The output of each screen goes to
`.claude/local/figma-component-inventory/out/<screen name>` of that repo.

### The Figma-to-code map

Optional, and worth writing: with it the script pre-fills the names, and the model's
verdicts cost less and change less from one run to the next. It is a Markdown file with a
section titled `Components` holding a table of three columns:

```
## Components

| Figma                             | Code                                     | Figma → props                   |
| --------------------------------- | ---------------------------------------- | ------------------------------- |
| Button · 251:958 · Design Tokens  | `src/components/ui/button.tsx` · `Button` | Style Primary → default variant |
| Divider · 8:56 · Design Tokens    | `src/components/ui/separator.tsx`         | —                               |
```

- First column: the Figma component's name, then its node id and its Figma file, separated
  by `·`.
- Second column: the component's file in backticks, then its name when the file exports
  several.
- Third column: how the Figma variants become props, or `—`.

- A second column can name another Figma component between « » ("`Select` (with « Input —
  field », Icon Caret)"): that line is then shown to the model for both components.

A name is pre-filled only when every line of that Figma name gives the same file and no
other line mentions the name.

## Flow

The model runs the two commands of `skills/figma-component-inventory/scripts`:

```
node scripts/screens.mjs <figma-url>                # 0. script: lists the screens drawn beside one screen
node scripts/candidates.mjs <out-dir> <figma-url>…  # 1. script: reads Figma, writes the files below
#                                                     2. model: fills verdicts.json
node scripts/render.mjs <out-dir>                   # 3. script: checks verdicts.json, writes inventory.html
#                                                     4. developer: corrections made on the page, pasted in the chat; the model applies them
node scripts/render.mjs <out-dir> --approve         # 5. model, once the developer says in the chat that he approves: stamp + inventory.md + map lines
```

Both commands run from the repo whose code is judged, since code paths are checked against
it.

| File in `<out-dir>`      | Written by | Content                                                                                                                                 |
| ------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `figma-node-<node>.json` | script     | Figma's answer for one screen, kept so that a second run calls nothing                                                                  |
| `screen-<node>.png`      | script     | capture of one screen, scale 2                                                                                                          |
| `candidates.json`        | script     | every component of the screen with its boxes; never edited                                                                              |
| `brief.md`               | script     | what the model reads: per candidate, the map's lines, the props of the component found, the files with a close name, the texts it holds |
| `verdicts.json`          | model      | one entry per component; the only file the model writes                                                                                 |
| `inventory.html`         | script     | the deliverable: capture, outlines, legend, reasons, and a form that writes the corrections to paste in the chat                        |
| `inventory.md`           | script     | written at approval: the list of components the next steps read                                                                         |

## Code

The inventory's code is in `skills/figma-component-inventory`:

```
SKILL.md                  what the model follows
scripts/
  screens.mjs             command: lists the frames drawn beside a screen in Figma
  candidates.mjs          command: reads Figma, writes candidates.json, brief.md and the verdicts.json to fill
  render.mjs              command: checks verdicts.json, writes inventory.html, approves
  page/                   the parts of inventory.html, which render.mjs pastes into one file with lib/feedbackText.mjs
    page.html               its structure
    pageBase.css            what inventory.html and specs.html look alike by: colours, header, legend, tabs, cards, corrections bar
    pageReview.mjs          what both pages do alike: the header's texts, the boxes the developer ticks, their count, the invitation to approve
    page.css                the inventory page's own styles
    page.js                 draws what pageDrawing.mjs worked out; answers tabs, switches, clicks and the correction form
    feedbackTextFunctions.d.ts tells the type check that page.js finds the functions of feedbackText.mjs in the page
  lib/                    one module per job, used by the two commands
    figma.mjs               Figma links, API calls, answers kept on disk, where the capture sits
    collectCandidates.mjs   Figma tree of one screen → candidates; reads no file
    mergeScreens.mjs        candidates of several screens → one list, and the areas that differ
    projectSettings.mjs     the repo's settings file: its folders, its Figma-to-code map
    figmaToCodeMap.mjs      what the repo's Figma-to-code map says of a Figma component
    brief.mjs               the content of brief.md
    verdicts.mjs            the five verdicts (label, colour, required fields), the checks, the approval
    inventoryIndex.mjs      writes out/index.md: one line per inventory, with where it and its specs stand
    approvedInventory.mjs   an approved inventory as the steps after it read it; refuses any other
    inventorySummary.mjs    the content of inventory.md
    inventoryWording.mjs    the French names that inventory.html and inventory.md share: outlines, screens, title
    pageDrawing.mjs         everything inventory.html draws: outlines, labels, loose texts, what is the same on every screen
    labelPlacement.mjs      where the labels go beside a capture, and the line to their component
    feedbackText.mjs        the developer's corrections on the page: what differs from the inventory, the text to paste; pasted whole into the page
    gitRepo.mjs             the repo's root, current commit and tracked files
    box.mjs                 comparisons between boxes
tests/                    one test file per module of scripts/lib
```

A verdict is declared once, in `VERDICTS` of `scripts/lib/verdicts.mjs`: the page takes its
labels and colours from there.

```
node --test                 # from skills/figma-component-inventory: the tests of tests/
tsc -p jsconfig.json        # type check (JSDoc types); needs @types/node within reach
```

## `candidates.json`

A **candidate** is a Figma component used in the screen. All its uses (its _instances_)
share one number: the 4 segments of the mode selector are candidate 6, instances `6a` to
`6d`, lettered in reading order. Numbers follow the Figma tree, top to bottom: the
components first, then the plain frames. The exact shape of each object is the `Candidate`
and `Instance` types of `scripts/lib/collectCandidates.mjs`.

- `screens`: one item per screen, numbered from 1 in the order given.
- `screens[].texts`: every text the screen shows, with its box.
- `screens[].backdrop`: the name of the veil drawn behind a dialog (a top-level "Scrim",
  "Backdrop" or "Overlay" layer covering the screen), or `null`. With a backdrop, only the
  layers in front of it give candidates: the page behind is in the capture, never judged.
  Whatever a scrolling area cuts off is left out too.
- `instances[].screen`: the number of the screen the use is drawn on. Letters run across
  the screens: `6a` to `6d` on screen 1, `6e` to `6h` on screen 2.
- `contentsThatDiffer`: for a candidate that does not hold the same candidates on every
  screen, what it holds on which screens. Such a candidate must be judged.
- `kind`: `instance` for a Figma component, `frame` for a named frame that is not one.
  Frames with the same name, or siblings built the same way ("Day — Mon" … "Day — Sun"),
  are one candidate.
- `componentKey`: for an `instance`, the id of its Figma component set (of the component
  when it has no variants); null for a `frame`. Two Figma components with one name are two
  candidates.
- `mustBeJudged`: true for every `instance`, and for a `frame` used several times outside
  a nested component: a component the designer did not declare. Other frames are outlined
  only when the model gives them a verdict.
- `level`, per instance: 1 for the screen's root component, +1 at each component nested
  inside another. `parent` is the number of the candidate the instance sits in.
- `box`: pixels at scale 1, from the top-left corner of the screen. `screens[].capture` uses
  the same coordinates: it starts above and left of the screen when the screen has a shadow.
- `icons`: icon components (`ic/…`) found directly inside: listed, never outlined. Each instance has its own
  `icons` too: what tells apart three icon buttons of one variant.
- `fingerprint`: the Figma version and the commit the file was built on. `render.mjs`
  refuses verdicts filled for another Figma version.

## `verdicts.json`

The format and the rule of each verdict are in `SKILL.md`; the types are in
`scripts/lib/verdicts.mjs`, and `render.mjs` lists every broken rule instead of drawing.
What the model does not write:

- `decidedBy: "developer"` and `developerDecision`: the entry is a correction the developer
  gave. `developerDecision` is one short French sentence saying what he decided, written so
  that it reads alone in `inventory.md`. No model changes the entry afterwards.
- `approval` (written by `render.mjs --approve`, which the model runs once the developer
  says in the chat that he approves; refused while a verdict is `to-decide`): the date the
  developer approved and a hash of the verdicts. A page without a valid approval is shown
  as « Brouillon »; any later change to a verdict cancels it.

## Finding an inventory

One folder holds one inventory and everything made from it: `candidates.json`,
`verdicts.json`, `inventory.html`, `inventory.md`, then the specs (`specs.json`,
`specs.html`, `specs.md`). Beside the folders, `index.md` lists them: one line per
inventory, with the Figma screens it covers, whether the inventory and its specs are a
draft or approved, and the commit it was built on. The `render.mjs` of both skills write it
again at each run, from what the folders hold, so it is never edited by hand. A session
reads it before building an inventory, to find the one that already covers a screen.

## What the next step reads

A step that builds on the inventory (the props of the components to create, the tickets)
reads it through `loadApprovedInventory(outDir)` of `scripts/lib/approvedInventory.mjs`,
never the JSON files directly. The function throws `InventoryNotUsable`, with every reason
on its own line, unless all of this holds:

- `candidates.json` and `verdicts.json` are in the folder;
- `candidates.json` has every field of the table below;
- `verdicts.json` passes the checks `render.mjs` runs before drawing, except that code
  paths are not looked up again: a file moved since the approval makes the inventory out
  of date, which the fingerprint tells;
- the developer approved, and no verdict changed since.

It returns the fingerprint, the day of the approval, the screens, and every candidate with
the verdict of each of its instances (`ApprovedInventory`, in the same file).

These fields of `candidates.json` are the format a later step can count on. Removing or
renaming one breaks the steps that read the inventory:

| Field                                        | Promised                                                |
| -------------------------------------------- | ------------------------------------------------------- |
| `fingerprint.figma.fileKey`, `.version`      | non-empty texts                                         |
| `fingerprint.gitCommit`                      | a non-empty text                                        |
| `screens`                                    | at least one screen                                     |
| `screens[].number`, `.nodeId`, `.name`       | a whole number, two non-empty texts                     |
| `screens[].capture`                          | `file`, the PNG's name in the folder, and its box       |
| `screens[].texts[]`                          | `nodeId`, `characters` (may be empty) and `box`         |
| `candidates[].number`, `.figmaName`, `.kind` | a whole number, a non-empty text, `instance` or `frame` |
| `candidates[].instances[]`                   | `letter`, `nodeId`, `variant` (may be empty), `box`     |
| `candidates[].instances[].screen`            | the `number` of one of `screens`                        |

A box is `x`, `y`, `width` and `height`, all numbers. The other fields described above
(`level`, `parent`, `icons`, `contentsThatDiffer`, `backdrop`) are written by the script
but not checked: a step that needs one adds its check to `listInventoryFormatProblems`
and its row to this table.

A step that reads the inventory copies its fingerprint into its own deliverable. A
different Figma version or commit later on tells that the deliverable may be out of date.

## The page

With several screens, the page has two aids to compare them:

- tabs show one screen at a time, all drawn at the same place: switching tab (or the left
  and right arrow keys) shows what changes from one screen to the next. The last tab shows
  every screen at once;
- a switch, « Différences seulement », fades every component that is the same on all
  screens: drawn on each of them, holding the same components, with the same verdict and
  React component. What stays in colour is what the screens do not share.

A switch, « Textes hors sous-composant », tints every text that no sub-component holds:
the smallest outlined component around it is the screen's outermost one (the dialog, the
page), or there is none. It shows the texts no component holds: a label or a help text that
may deserve a component, or be a prop of the component beside it.

A click on a component, on its label or on its reason isolates it: everything else fades
and the capture is veiled except where that component is drawn, on every screen. A second
click, a click beside the images or the Escape key shows everything back.

Labels are in French, since its images go into Jira tickets. Every outline is dotted; only
the colour tells the verdict. A component thinner than 4 px (a 1 px divider) keeps its
number and its label but gets no outline, which would hide it.

## figma-component-specs — the props of the components to create or to adapt

`/figma-component-specs <inventory-out-dir>` takes the folder of an approved inventory and
describes each component whose verdict is "to create" or "to adapt": its props (name,
TypeScript type, required or not, where the parent gets the value) and its **zones**, the
parts of its drawing with the props that drive each one. A reused component gets nothing:
its props are in the code.

A component to adapt shows what changes only, as before → after: the props to add or to modify, and a table of what changes without a prop (a height from 32 px to 36 px, an icon size). Its props that exist and stay as they are are not listed.

The result is `specs.html`: a tree of the components, each under the one it is drawn in, then one tab per screen the shown component
is drawn on. Each zone is outlined on the capture, cut around the component at the size the
inventory shows it; a click on a zone opens a panel with its props and its rules. A zone that is itself a component of the tree (a header inside an editor) shows what the parent gives it, and links to that component: each component is described once. A screen whose specs say the same as an earlier one's gets no tab, and the earlier screen names it: same zones, and same content in the zones that props drive. The component's width and what a zone without props shows are not compared. The
outline's colour gives the zone's kind:

| Kind        | Meaning                                                                                |
| ----------- | -------------------------------------------------------------------------------------- |
| `prop`      | one or several props decide what the zone shows, or receive its actions                |
| `fixed`     | in a component to create, the same whatever the props: a label, a divider              |
| `change`    | in a component to adapt, where a change without a prop shows (« Changement de style ») |
| `not-drawn` | drawn by the mock-up, left out by the component for a reason already written           |
| `to-decide` | neither the mock-up nor the code says the rule: a question with 2 to 4 answers         |

It reads the inventory through `loadApprovedInventory`, so it refuses a folder whose
inventory is not approved or changed since its approval. It needs no Figma access: the
captures and every position come from the inventory's folder.

- **The scripts** list the components to specify, prepare what the inventory and the code
  say of each, turn each zone into boxes, and draw.
- **The model** reads the code, then writes the props and the zones. A zone names what it
  outlines with the inventory's numbers and texts, never with coordinates. Its instructions
  are in `skills/figma-component-specs/SKILL.md`, which is all it reads.

```
node scripts/prepare.mjs <inventory-out-dir>   # 1. script: checks the inventory, writes the files below
#                                                2. model: reads the code, fills specs.json
node scripts/render.mjs <inventory-out-dir>    # 3. script: checks specs.json, writes specs.html
# 4. developer: corrections made on the page, pasted in the chat; the model applies them
node scripts/render.mjs <inventory-out-dir> --approve   # 5. model, once the developer says in the chat that he approves: stamp + specs.md
```

Both commands run from the repo the inventory judged. `prepare.mjs` keeps a `specs.json`
that is already filled; `--reset-specs` empties it. Both exit with 2 when the inventory is
not usable, and `render.mjs` with 3 when `specs.json` breaks a rule, each listing every
reason.

| File in `<inventory-out-dir>` | Written by | Content                                                                                                                                                        |
| ----------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `specs-brief.md`              | script     | what the model reads: per component, its inventory entry, the developer's decision, the props its file declares, what it holds per screen                      |
| `specs.json`                  | model      | one entry per component, keyed by its React name; the only file the model writes                                                                               |
| `specs.html`                  | script     | the deliverable: the tree of components, screen tabs, captures, zone outlines, the panel of props, and a form that writes the corrections to paste in the chat |
| `specs.md`                    | script     | written at approval: per component, the developer's decisions, what changes, the props and the zones; what the next steps read                                 |

The format of `specs.json` and the rule of each field are in `SKILL.md`; the types are in
`scripts/lib/componentSpecs.mjs`. `render.mjs` refuses, among others, a prop that no zone
names, a zone part drawn nowhere inside the component, and a `to-decide` zone without its
question and answers.

What the model does not decide, in `specs.json`:

- `developerDecisions`, per component: one French sentence per thing the developer settled.
  No model changes what a sentence says afterwards.
- `approval` (written by `render.mjs --approve`, which the model runs once the developer
  says in the chat that he approves; refused while a zone is `to-decide`): the date the
  developer approved and a hash of the components. A page without a standing approval is
  shown as « Brouillon »; any later change to the specs cancels it.

The code is in `skills/figma-component-specs`:

```
SKILL.md                  what the model follows
scripts/
  prepare.mjs             command: writes specs-brief.md and the specs.json to fill
  render.mjs              command: checks specs.json, writes specs.html, approves
  page/                   the parts of specs.html, which render.mjs pastes into one file
    page.html               its structure
    page.css                its own styles, after the inventory skill's pageBase.css
    page.js draws what specsPageDrawing.mjs worked out; answers tabs, clicks, keys and the correction form
    specsFeedbackTextFunctions.d.ts tells the type check that page.js finds the functions of specsFeedbackText.mjs in the page
  lib/
    componentSpecs.mjs      the components to specify, the kinds of zone, the checks of specs.json
    specsBrief.mjs          the content of specs-brief.md
    specsPageDrawing.mjs    everything specs.html draws: the cut of each capture, the outline of each zone
    specsApproval.mjs       the developer's approval: what still blocks it, its stamp, whether it stands
    specsSummary.mjs        the content of specs.md
    specsFeedbackText.mjs   the developer's corrections on the page: the text to paste; pasted whole into the page
    commandOutcome.mjs      what the two commands share: the name of specs.json, the exit codes
tests/                    one test file per module of scripts/lib, and the fixtures they share
```

A kind of zone is declared once, in `ZONE_KINDS` of `scripts/lib/componentSpecs.mjs`: the
page takes its labels and colours from there. The tests and the type check run as for the
inventory, from `skills/figma-component-specs`.
