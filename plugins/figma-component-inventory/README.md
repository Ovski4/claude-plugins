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

| Setting                   | What it is                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `componentsFolder`        | The folder that holds every UI component. Required.                                                                                               |
| `componentFileExtensions` | The extensions of a component file. Test and Storybook files (`button.test.tsx`, `button.stories.tsx`) are left out. Required.                    |
| `designSystemFolder`      | The folder of the shared components: its files are proposed to the model before a feature's own. `null` or absent: no file gets priority.         |
| `figmaToCodeMap`          | The table that gives the component of each Figma component. `null` or absent: no name is pre-filled, the model finds every component in the code. |

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
node scripts/render.mjs <out-dir>                   # 3. script: checks verdicts.json, writes cut.html
#                                                     4. developer: corrections by outline number; the model applies them
node scripts/render.mjs <out-dir> --approve         # 5. once the developer agrees: stamp + cut.md
```

Both commands run from the repo whose code is judged, since code paths are checked against
it.

| File in `<out-dir>`      | Written by | Content                                                                                                             |
| ------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| `figma-node-<node>.json` | script     | Figma's answer for one screen, kept so that a second run calls nothing                                              |
| `screen-<node>.png`      | script     | capture of one screen, scale 2                                                                                      |
| `candidates.json`        | script     | every component of the screen with its boxes; never edited                                                          |
| `brief.md`               | script     | what the model reads: per candidate, the map's lines, the props of the component found, the files with a close name |
| `verdicts.json`          | model      | one entry per component; the only file the model writes                                                             |
| `cut.html`               | script     | the deliverable: capture, outlines, legend, reasons                                                                 |
| `cut.md`                 | script     | written at approval: the list of components the next steps read                                                     |

## Code

Everything is in `skills/figma-component-inventory`:

```
SKILL.md                  what the model follows
scripts/
  screens.mjs             command: lists the frames drawn beside a screen in Figma
  candidates.mjs          command: reads Figma, writes candidates.json, brief.md and the verdicts.json to fill
  render.mjs              command: checks verdicts.json, writes cut.html, approves
  page/                   the three parts of cut.html, which render.mjs pastes into one file
    page.html               its structure
    page.css                its styles
    page.js                 draws what pageDrawing.mjs worked out; answers tabs, switches and clicks
  lib/                    one module per job, used by the two commands
    figma.mjs               Figma links, API calls, answers kept on disk, where the capture sits
    collectCandidates.mjs   Figma tree of one screen → candidates; reads no file
    mergeScreens.mjs        candidates of several screens → one list, and the areas that differ
    projectSettings.mjs     the repo's settings file: its folders, its Figma-to-code map
    figmaToCodeMap.mjs      what the repo's Figma-to-code map says of a Figma component
    brief.mjs               the content of brief.md
    verdicts.mjs            the five verdicts (label, colour, required fields), the checks, the approval
    cutSummary.mjs          the content of cut.md
    pageDrawing.mjs         everything cut.html draws: outlines, labels, loose texts, what is the same on every screen
    labelPlacement.mjs      where the labels go beside a capture, and the line to their component
    gitRepo.mjs             the repo's root, current commit and tracked files
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
  layers in front of it give candidates: the page behind is in the capture, never cut.
  Whatever a scrolling area cuts off is left out too.
- `instances[].screen`: the number of the screen the use is drawn on. Letters run across
  the screens: `6a` to `6d` on screen 1, `6e` to `6h` on screen 2.
- `contentsThatDiffer`: for a candidate that does not hold the same candidates on every
  screen, what it holds on which screens. Such a candidate must be judged.
- `kind`: `instance` for a Figma component, `frame` for a named frame that is not one.
  Frames with the same name, or siblings built the same way ("Day — Mon" … "Day — Sun"),
  are one candidate.
- `mustBeJudged`: true for every `instance`, and for a `frame` used several times outside
  a nested component: a component the designer did not declare. Other frames are outlined
  only when the model gives them a verdict.
- `level`, per instance: 1 for the screen's root component, +1 at each component nested
  inside another. `parent` is the number of the candidate the instance sits in.
- `box`: pixels at scale 1, from the top-left corner of the screen. `screens[].capture` uses
  the same coordinates: it starts above and left of the screen when the screen has a shadow.
- `mapLines`: the lines of the Figma-to-code map that name this Figma component.
  The name is pre-filled in `verdicts.json` only when they agree on one file.
- `icons`: icon components (`ic/…`) found directly inside: listed, never outlined.
- `fingerprint`: the Figma version and the commit the file was built on. `render.mjs`
  refuses verdicts filled for another Figma version.

## `verdicts.json`

The format and the rule of each verdict are in `SKILL.md`; the types are in
`scripts/lib/verdicts.mjs`, and `render.mjs` lists every broken rule instead of drawing.
What the model does not write:

- `decidedBy: "developer"` and `developerDecision`: the entry is a correction the developer
  gave. `developerDecision` is one short French sentence saying what he decided, written so
  that it reads alone in `cut.md`. No model changes the entry afterwards.
- `approval` (written by `render.mjs --approve`): the date the developer approved and a hash
  of the verdicts. A page without a valid approval is shown as « Brouillon »; any later
  change to a verdict cancels it.

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
page), or there is none. It shows what the cut leaves loose: a label or a help text that
may deserve a component, or be a prop of the component beside it.

A click on a component, on its label or on its reason isolates it: everything else fades
and the capture is veiled except where that component is drawn, on every screen. A second
click, a click beside the images or the Escape key shows everything back.

Labels are in French, since its images go into Jira tickets. Every outline is dotted; only
the colour tells the verdict. A component thinner than 4 px (a 1 px divider) keeps its
number and its label but gets no outline, which would hide it.
