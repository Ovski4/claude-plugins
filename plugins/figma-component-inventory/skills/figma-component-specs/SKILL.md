---
name: figma-component-specs
description: From an approved component inventory (figma-component-inventory), describe each React component to create or to adapt - its props and what each one drives on the captures - and draw the page the developer reads. Use after the inventory is approved, before writing the tickets or the code.
model: sonnet
argument-hint: <inventory-out-dir>
---

# Props of the components to create or to adapt

You receive the folder of an approved inventory: `$ARGUMENTS`. You fill **one file**,
`<out-dir>/specs.json`, then run `render.mjs`. The scripts do all the drawing: you never
read or write a coordinate. A zone names what it outlines with the inventory's numbers and
texts, which the brief lists.

Everything you need is in this file and in the brief the first command writes. Each step of
your work re-reads all you have read so far: group your file reads in one command.

## Steps

1. Find `<out-dir>`. Without an argument, list the folders of
   `.claude/local/figma-component-inventory/out/` that hold an `inventory.md`: with one,
   take it; with several, ask the developer which one, in one question.
2. Run `node ${CLAUDE_SKILL_DIR}/scripts/prepare.mjs <out-dir>` from the repo's root. It
   writes the **brief**, `<out-dir>/specs-brief.md`, to read whole: for each component to
   specify, what the inventory says of it, the
   props its file declares when it exists, and what it holds on each screen. `specs.json`
   already holds one empty entry per component. When the command refuses the inventory (not
   approved, changed since its approval, wrong format), report its message to the developer
   and stop: only they approve an inventory.
3. Look at the captures the brief names, then open, in one command, the code the props
   depend on (see "Read the code").
4. Write every entry of `specs.json` in one edit, with the rules below.
5. Run `node ${CLAUDE_SKILL_DIR}/scripts/render.mjs <out-dir>` from the repo's root. Fix
   every problem it lists and run it again until it writes `specs.html`.
6. Report: the path of `<out-dir>/specs.html`, then one line per component (its number of
   props and of zones), then each open question (`to-decide`) in full. Say that the page is
   a draft until the developer approves it, that its form builds the corrections to
   paste here (« Copier les corrections »), and that he approves by ticking every box of
   the page, then running the command it shows.

## Steps — the developer's answers, then his approval

The developer read the page and answers in the chat, in his own words or with the text the
page's form builds: « Corrections des specs … », then per target its name (`Select` for the
component, `Select · zone A` for one zone) and one indented line per field: `réponse`, the
option he picked for a `to-decide` zone, and `note`, anything else in his words. His answer
is a decision, not an opinion to weigh.

1. Change the component's entry to what he said. An answer to a `to-decide` zone gives the
   zone its real kind (`prop`, `fixed` or `not-drawn`), with the props it needs, and removes
   `question` and `options`.
2. Add one sentence per decision to the component's `developerDecisions`, in French,
   readable by someone who never saw the chat (« Le tag s'affiche quand la consigne égale
   un préréglage. »). `developerDecisions` is a list of strings in the component's entry,
   beside `props` and `zones`; create it at the first decision. When his answer asks for a
   new prop without naming it, name it the way the feature's code names its own, and say
   the name in the report. Keep everything he asked for, add nothing he did not say. If it cannot
   be applied (two answers that contradict each other), stop and ask him with a quiz.
3. Never change what a sentence of `developerDecisions` says, unless he corrects it again.
4. Run `render.mjs` and report what changed, one line per component.
5. The developer approves, not you. On the page he ticks a box on each component and on
   each of its screens once he has checked them; once all are ticked, the page shows a
   command ending with `--approve=<code>`, which he runs in his terminal. Tell him so when
   you hand the page over. Never run `--approve` yourself, with or without a code, even
   when he says the specs are right: the code names the specs his page shows, and the
   command refuses when they changed since. It also refuses while a zone is `to-decide`.
   It writes `<out-dir>/specs.md`, what the tickets and the code read: give its path once
   he has run it.

## `specs.json`

```json
{
  "figmaVersion": "2423993102449653660",
  "components": [
    {
      "codeComponent": "OrderDeliverySettings",
      "props": [
        {
          "name": "deliveryWindow",
          "type": "DeliveryWindow",
          "required": false,
          "source": "state.deliveryWindow de useOrderEditorState : { start, end }. Absente pour un retrait en magasin.",
          "note": "Donnée avec onDeliveryWindowChange."
        }
      ],
      "zones": [
        {
          "letter": "A",
          "label": "Champs « Début » et « Fin »",
          "kind": "prop",
          "parts": [{ "candidate": 11 }],
          "props": ["deliveryWindow", "onDeliveryWindowChange"],
          "notes": ["Deux DatePicker (inventaire n° 11, à adapter)."]
        },
        {
          "letter": "B",
          "label": "Libellé « Livraison »",
          "kind": "fixed",
          "parts": [{ "text": "Livraison" }]
        }
      ]
    }
  ]
}
```

`figmaVersion` and each `codeComponent` stay as written: one entry per component of the
brief, no other.

A component **to create** lists all its props. A component **to adapt** lists only what
changes, each thing read as before → after:

- the props to add or to modify, each with `"change": "to-add"` or `"to-modify"`; a prop to
  modify also gives `"typeBefore"`, its type today, `type` being the one after;
- beside `props`, a `changes` list for what changes without a prop:
  `{ "what": "Hauteur du champ", "before": "32 px", "after": "36 px" }`. `what` names the
  thing in a few French words, `before` is what the code does today, read in its file,
  `after` what the mock-up asks. Keep the three short: a value, not a sentence.

A prop that exists and stays as it is has nothing to tell: leave it out.

A **prop**: `name` as it will be written in the code, `type` as TypeScript, `required`
(`false` for an optional prop), `source` (where the parent gets the value), and `note` only
for a rule the type does not say: leave the field out otherwise. A component whose drawing
no prop changes has an empty `props` list.

A **zone** is a part of the component's drawing and the props that drive it:

| `kind`      | When                                                                      | Required with it                        |
| ----------- | ------------------------------------------------------------------------- | --------------------------------------- |
| `prop`      | one or several props decide what the zone shows, or receive its actions   | `props`: their names                    |
| `fixed`     | in a component to create, the same whatever the props: a label, a divider | no `props`                              |
| `change`    | in a component to adapt, where an item of `changes` shows                 | no `props`; an item in `changes`        |
| `not-drawn` | the mock-up draws it and the component leaves it out, for a known reason  | no `props`; the reason as first note    |
| `to-decide` | neither the mock-up nor the code says the rule, only the developer can    | `question`, 2 to 4 `options`, in French |

`parts` says what the zone outlines, with what the brief lists under the component:

- `{ "candidate": 11 }`: every use of inventory candidate 11 inside the component;
- `{ "instance": "11a" }`: one use, when the uses of a candidate belong to different zones;
- `{ "text": "Livraison" }`: every text with exactly these characters, copied from the brief.

`letter`: `A`, `B`… in reading order on the first screen that draws the component; a zone
that screen leaves out takes the next letter, in the order of the screens that draw it,
then in reading order on that screen. `label`: what the zone is, in a
few French words. `notes`: its rules, one French sentence each. `options`: a list of plain
sentences.

## Rules

**Read the code before any prop.** A prop written from the capture alone is a guess.

- For a component to adapt, the brief gives its declared props and the inventory's reason,
  which says what the mock-up needs and the component lacks. Open its file and its styles
  to check each gap, then write it once: a prop to add or to modify when the parent must
  decide, an item of `changes` otherwise (a size, a colour, an icon). For a prop to
  modify, `note` says what changes in it.
- For a component to create, find where its values will come from: the hook, the state or
  the helper the feature already has. Open the component the inventory names as its parent
  when it exists, and the feature's state. `source` names the exact field or function
  (« state.targetTemperature de useOrderEditorState »).
- When the value exists nowhere yet, `source` says so and what would hold it (« À ajouter à
  useOrderEditorState : … »). Never write a source you did not read.

**A prop is what the parent decides.** What changes from one screen to the next and that
the component cannot work out alone is a prop: a value, an optional part, a list of
choices. These are not props:

- a width or a screen size: the component takes its parent's width, and two sizes of the
  same state (desktop and mobile) are one set of props;
- a fixed text: it goes through the translations, the component draws it itself;
- something the component works out from its other props: say how in the zone's `notes`.

A value the user changes comes with its callback: both props are named by the zone the user
acts on. Name a callback the way the feature's code names its own.

**The developer's decisions stand.** The brief marks « Decided by the developer, not to be
judged again » what they settled in the inventory: the component's name, what it draws
itself. Build on it, never against it.

**Every part of a component to create belongs to a zone.** Each component and each text the
brief lists under the component on some screen is named by one zone. A component to adapt
has zones only where something changes: a `prop` zone for a prop to add or to modify, a
`change` zone for the items of `changes`, its notes saying which ones it shows. A component nested in another one of the brief is specified in its own entry: the parent's zone names it by its candidate and lists the props the parent passes through. On the page, that zone shows the parent's props and rules, with a link to the child's specs: write nothing about the child in the parent's zone.

**A zone that only some screens draw says when.** Its first note gives the condition, in
terms of props (« Dessiné seulement quand deliveryWindow est donnée. »). When the
component decides it from a state it holds itself (a choice the user makes inside it),
the condition names that state (« Dessiné seulement quand le mode choisi,
state.deliveryMode de useOrderEditorState, est Retrait. »), and the zone's `props` are the
ones that give that state its first value, if any. The variants the brief shows between brackets tell
the states the screens cover.

**`to-decide` is for a rule nobody wrote.** The mock-up shows something on one screen and
not on another, and neither the brief nor the code says why: ask, with the facts in the
notes and 2 to 4 answers, each one saying what it changes for the props. Never for a doubt
that opening a file would lift.

**`not-drawn` is for what the code or the inventory already left out.** A part the mock-up
shows and the component does not draw, with the reason written somewhere you read: a comment
of its file, the inventory's reason, a decision of the developer. The first note gives that
reason and where it is written. It is not a question: asking again what is already decided
wastes the developer's answer.

**No prop for a case no screen shows.** Describe what these screens need. A `disabled`, a
`className` or a loading state the captures do not show is not listed, and `render.mjs`
refuses a prop that no zone names.

**Write `label`, `source`, `note` and `notes` in French, for a developer who has neither
the conversation nor the code open.** One fact per sentence. State only facts you checked.

**Stay in your lane.** Edit `<out-dir>/specs.json` directly: no helper script, no file
elsewhere. Do not edit `candidates.json`, `verdicts.json`, `inventory.md`, the scripts or
any file of the repo. If the inventory looks wrong (a component missing, a verdict that no
longer fits the code), say so in your report: the inventory is corrected with
`/figma-component-inventory`, not here.
