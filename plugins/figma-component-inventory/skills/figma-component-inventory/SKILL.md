---
name: figma-component-inventory
description: From a Figma screen URL, say which of its components the React code already has (reused, to adapt, to create, out of scope, to decide) and draw the annotated capture the developer approves. Use before writing the tickets or the code of a screen.
model: sonnet
argument-hint: <figma-url>
---

# Component inventory of a Figma screen

You receive one or several Figma URLs: `$ARGUMENTS`. Several URLs are the screens of one
design (its states, its sizes), judged together. You fill **one file**,
`<out-dir>/verdicts.json`, then run `render.mjs`. The scripts do all the drawing: you never
read or write a coordinate.

Everything you need is in this file and in the brief the first command prints. Each step of
your work re-reads all you have read so far: group your file reads in one command, and open
a file only when a verdict depends on it.

## Steps — first cut

1. Prepare the context, unless `<out-dir>/context.md` exists:
   - `<out-dir>` is `.claude/local/figma-component-inventory/out/<screen name>`, lower case with dashes
     (`checkout-desktop`).
   - Write `<out-dir>/context.md`: the Figma URL, then what the developer said in the
     conversation about the work (the feature, what exists, what to leave out, the name
     prefix of the new components). When they said nothing, the file holds the Figma URL
     and the whole screen is to build. Ask nothing.
2. With a single URL, look for the other screens of the same design: run
   `node ${CLAUDE_SKILL_DIR}/scripts/screens.mjs <figma-url>`. It lists the frames drawn
   beside the screen, the variants of the same Figma component first. When it lists
   comparable screens, ask the developer which ones to judge together, in one question with
   2 to 4 sets to choose from, the smallest useful one first (one screen per state at one
   size, plus one screen at another size: sizes rarely change the components). When it
   lists none, go on with the single screen. Skip this step when several URLs were given.
3. Run `node ${CLAUDE_SKILL_DIR}/scripts/candidates.mjs <out-dir> <figma-url>...` from the
   repo's root, one URL per screen, each between quotes, then look at the captures it names. The command reads
   the screens from Figma with `FIGMA_TOKEN` and keeps the answers in `<out-dir>`. It
   prints the **brief**: for each candidate to judge, its variants, its size in the mock-up,
   what the Figma-to-code map says, the props of the component the map gives, or the component files with a close
   name. `verdicts.json` already holds one entry per candidate, verdict empty. When the
   command says `.claude/figma-component-inventory.json` is missing, ask the developer for the paths it
   lists and write the file: it is the one file you may write outside `<out-dir>`.
4. Open, in one command, the component files and stylesheets the verdicts depend on (see
   "Read the code").
5. Write every entry of `verdicts.json` in one edit, with the rules below.
6. Run `node ${CLAUDE_SKILL_DIR}/scripts/render.mjs <out-dir>` from the repo's root. Fix every
   problem it lists and run it again until it writes `cut.html`.
7. Report: the path of `<out-dir>/cut.html`, then one line per candidate (number, React component, verdict, and the file that
   decided it).

## `verdicts.json`

```json
{
  "figmaVersion": "2423993102449653660",
  "verdicts": [
    {
      "number": 3,
      "figmaName": "Button — icon",
      "codeComponent": "Button",
      "codePath": "src/components/ui/button.tsx",
      "verdict": "reused",
      "except": [
        { "instances": ["a", "b"], "verdict": "out-of-scope", "note": "…" }
      ]
    },
    {
      "number": 5,
      "figmaName": "Selector — view mode",
      "codeComponent": "SegmentedTabs",
      "codePath": "src/components/ui/segmentedTabs.tsx",
      "verdict": "to-adapt",
      "note": "…"
    },
    {
      "number": 6,
      "figmaName": "Segment",
      "outlined": false,
      "note": "Segments dessinés par SegmentedTabs : voir le n° 5."
    },
    {
      "number": 8,
      "figmaName": "Tag — status",
      "codeComponent": "OrderStatusTag",
      "verdict": "to-create",
      "note": "…"
    }
  ]
}
```

`number` and `figmaName` stay as written. The uses of a candidate are lettered `a`, `b`… in
reading order (top to bottom, then left to right).

| `verdict`      | When                                                            | Required with it                                                                                                                |
| -------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `reused`       | an existing component whose props cover what the capture shows  | `codeComponent`, `codePath` (an existing file); no `note`                                                                       |
| `to-adapt`     | an existing component that has to change                        | the same, plus `note`: the prop, type or style that blocks, and what the mock-up needs                                          |
| `to-create`    | no component does this job                                      | `codeComponent`: the proposed name; `note`: where you searched, the closest existing code, what the new component takes from it |
| `out-of-scope` | `context.md` says this work leaves it out                       | `note`: why                                                                                                                     |
| `to-decide`    | neither the code nor the context can answer, only the developer | `note`, `question`, 2 to 4 `options`, in French                                                                                 |

- `except`: the uses whose judgement differs from the candidate's, named by letter
  (`"instances": ["a", "b"]`) or by screen (`"screens": [1, 4]`). An exception can change
  the verdict, name another component (`codeComponent`, `codePath`) and give its own `note`.
- `"outlined": false` with a `note`: a Figma component that is not a React component of its
  own (one option of a tab group, a dot drawn by its parent). No verdict.
- A plain frame of the brief's last list gets an entry only when it is a React component of
  its own; the entry then follows the same rules.

## Rules

**Read the code before any verdict.** A verdict given from a name, from the context or from
the pre-filled value is a guess. The brief has already read the map and the props for you;
do not open the map's file. When the brief says the repo has no map, every name comes from
the code: open the files with a close name.

- A pre-filled name comes from a map keyed by Figma name only: check it against the variant
  and the capture (an "Input — field" with a caret is a dropdown list, not a text input).
- `reused` means the same props **and the same look**. Open the component's file and its
  stylesheet, and compare with the brief: the size in the mock-up, the size of the icons (the
  number ending an icon's name, `ic/power/16` is 16 px), the format of the text shown. A
  height, an icon size or a text format that differs is `to-adapt`, not `reused`.
- `to-adapt` needs the file open: name the prop, the type or the style that blocks.
- With no component from the map, open the files with a close name before concluding
  "to create", and search the design-system folder the brief names by role and by what the
  component draws, not only by name: the same drawing may be written inline in another
  component.
- `to-decide` is never for a doubt that opening a file would lift.

**Two existing components can do the job: the design system's one wins.** Prefer the
component of the design-system folder, the one the map gives for this Figma name and variant (it has
the mock-up's look) over an older component that the current screens use for the same
data. Example: a list of values drawn as "Input — field" with a caret is `Select`, even
though the current editor shows its values with `DropdownField`. The brief lists the map's lines
that name a Figma component inside another line ("Form field" names `Select` for the caret
variant).

**Several screens: one component with a prop, or several components.** With several
screens, the brief marks the candidates whose content differs from one screen to the next
and says what each screen holds. For each one, choose and say why in the `note`:

- **one component with a prop** when the screens share their structure and differ by a
  value, a label or an optional part: one `codeComponent`, and the `note` names the prop
  and its values ("prop `mode` : Arrêt, Continu, Période") or the optional part;
- **several components** when the contents have nothing in common, or when one prop would
  switch between unrelated blocks: the entry names the component of some screens, and an
  `except` with `"screens"` names the component of the others. The `note` of each says what
  it shows.

Two sizes of the same state (desktop and mobile) are one component: a width is not a prop.
A candidate drawn on some screens only is judged as usual, and a `note` is not needed to
say where it appears.

**A dialog over a page: only the dialog is cut.** When the screen has a backdrop (a
"Scrim", "Backdrop" or "Overlay" layer covering it), what lies behind is the page the dialog
was opened from: it already exists and is not part of the work. The brief lists only
the layers in front and names the backdrop in its first lines. Do not judge, search or mention
anything of the background, even if you recognise it in the capture. The same goes for
what a scrolling area cuts off: it is not listed, do not add it.

**A frame used several times is a component.** The brief marks "frame used several
times" the plain frames that repeat (the seven day rows of a week): the designer did not declare them as a
component, but the code will need one. They are in `verdicts.json` and need a verdict like
any other. The other frames stay optional: add an entry for one only when it is clearly a
component of its own (it has its own state or action).

**Judge what the outline covers, nothing more.** A candidate is the box Figma gives it: a
title above it or a sentence under it belongs to another candidate or to a frame, not to
this one. Do not invent a wrapper component to hold them.

**One React component, one outline.** When a Figma component and the Figma components
nested in it are drawn by a single React component (a selector and its segments are one
`SegmentedTabs`), give the verdict to the outer one, with every reason in its `note`, and set
the nested ones to `"outlined": false` with a note naming the outer candidate's number.
The same React component may appear under two numbers only when it is used twice as
separate elements (a `Button` in the header and a `Button` in the footer).

**Name a component to create the way the feature already names its own.** PascalCase, a
name that says the role without reading anything else. Take the prefix `context.md`
gives; without one, the prefix of the closest existing components of the same feature. Never
a generic name (`Header`, `Tag`).

**Keep every `note` to two or three lines** (330 characters at most, `render.mjs` refuses
more): the reason, not the story of your search. One fact per sentence, no list of every
file you opened.

**Write every `note` in French, for a developer who has neither the conversation nor the
code open.** A component name comes with what it does or lacks. State only facts you checked.

**Nothing is left "to verify".** The page is what the developer approves: a verdict with
an open doubt is not ready to draw. Before running `render.mjs`, go through your notes and
your own doubts: for each one, open the file, read the prop, the style or the helper, and
settle it. A verdict that rests on a component you did not open is not finished. Only two
outcomes exist for a doubt: you checked and the note states the fact, or the code and the
context cannot answer and it is `to-decide` with its question. `render.mjs` refuses a note
that says "non vérifié" or "à vérifier", and your report has no "not verified" list.

**Stay in your lane.** Edit `<out-dir>/verdicts.json` directly: no helper script, no file
elsewhere. Write only `<out-dir>/context.md` and `<out-dir>/verdicts.json`. Do not edit `candidates.json`,
the scripts, or any file of the repo. Do not read another `out/` folder: it may hold
someone else's answers for the same screen.

## Steps — apply the developer's corrections

The developer looked at the page and answered by outline number ("7: Select", "27: to
create, OrderDayRow", "8 and 11 are one component"). His answer is a decision, not
an opinion to weigh.

1. For each correction, change the entry (or the `except` of the instances he named) to what
   he said, and add `"decidedBy": "developer"` and `"developerDecision"`: one short French
   sentence saying what he decided, readable by someone who never saw the chat ("Le
   composant s'appelle OrderProfileRow."). Tidy his wording freely: fix
   typos, drop the outline number and any name he gave up. Keep everything he asked for,
   and add nothing he did not say. Do not re-judge his decision, soften it or "improve"
   it, even if the code seems to say otherwise; if it cannot be applied (a file that does
   not exist, two corrections that contradict each other), stop and ask him with a quiz.
2. Keep the entry valid: a `note` in French when the verdict needs one, written from his
   words and from the code you open for the facts (the prop that changes, the file reused).
3. An answer to a `to-decide` is a correction like the others: the entry takes the chosen
   verdict, and `question` / `options` are removed.
4. Never touch an entry that already has `"decidedBy": "developer"` unless he corrects it
   again. `candidates.mjs --reset-verdicts` keeps those entries too.
5. Run `render.mjs` and report what changed: one line per corrected number, before → after.
6. When the developer says the cut is right, and only then, run
   `node ${CLAUDE_SKILL_DIR}/scripts/render.mjs <out-dir> --approve`. It refuses while a `to-decide`
   remains. It stamps `verdicts.json`, turns the page from « Brouillon » to « Validé », and
   writes `<out-dir>/cut.md`, the file the next steps read. Never run `--approve` on your
   own: the stamp says the developer approved.
