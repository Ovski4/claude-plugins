# Design rules for the pages the plugins write

Some skills end with a page the developer opens in a browser, reads and corrects:
`inventory.html`, `specs.html`. These rules keep those pages looking and behaving alike.
They apply to any new page of this kind, in any plugin of this repo.

The rules describe what the two existing pages do. When a page needs something they do
not cover, add it to the page, then add the rule here in the same change.

## Where the look comes from

- The shared look is one stylesheet:
  `plugins/figma-component-inventory/skills/figma-component-inventory/scripts/page/pageBase.css`.
  `writeStandalonePage` (`scripts/lib/standalonePage.mjs`) pastes it before the page's own
  `page.css`.
- A page's `page.css` holds only what that page alone draws. A rule two pages need moves
  to `pageBase.css`.
- A page of another plugin cannot import that file: plugins are installed one by one. It
  starts from a copy of `pageBase.css`, and says so in a comment at the top of the copy.
- A page is one HTML file that opens without a server: styles, scripts, data and images
  are pasted into it. No font, script or image is fetched from the network.

## Colours

Use the variables of `pageBase.css`, never a raw colour for these roles:

| Variable             | Value     | Role                                           |
| -------------------- | --------- | ---------------------------------------------- |
| `--page-background`  | `#f8fafc` | the page                                       |
| `--surface`          | `#ffffff` | cards, the corrections bar, buttons            |
| `--border`           | `#e2e8f0` | the edge of a card or of a block inside a card |
| `--text`             | `#0f172a` | text; the fill of a picked tab                 |
| `--text-muted`       | `#5b6676` | hints, secondary text, the edge of a button    |
| `--halo`             | `#ffffff` | text on a colour, the light ring around a line |
| `--approval-given`   | `#15803d` | the pill of an approved page                   |
| `--approval-missing` | `#dc2626` | the pill of a draft                            |

- A colour carries one meaning per page. Two categories shown on the same page never
  share a colour: « Changement de style » is not the purple of « À créer ».
- Red is kept for what waits on the developer (« À trancher », a draft).
- The colours of a set of categories (verdicts, kinds of zone) are declared once in the
  lib that defines the set, with their French label, and sent to the page with the data.
  The page's CSS never repeats them.
- A colour that carries text, or text on it, has a contrast of 4.5 to 1 at least with
  `--surface`: « À adapter » is `#0369a1`, not a lighter blue.
- No dark theme.

## Text

- `system-ui`, 14 px, line height 1.45. Side panels and the corrections bar: 13 px. Hints,
  captions and tags: 12 px or 11 px, in `--text-muted`.
- What the developer reads is in the page's language (see "Languages"); what the model
  wrote is in French. Code, comments and class names are in English.
- A component name or a prop name is written as in the code, in `<code>` when it sits in a
  sentence.
- The page shows what there is to read. It never writes that a list is empty; the title
  of an empty section goes away with it.

## Languages

- A page is read in French or in English: the developer picks the language in the
  settings, the browser keeps it for every page of the same kind, and the page loads
  again in it. French is the language of a page nobody picked a language for.
- No text is written in `page.html` or in a page script. A text has a name
  (« approval.given ») and one sentence per language in a dictionary: `pageTexts.mjs` for
  what both pages show, the `ownTexts.mjs` of the page's folder for the rest
  (`addPageTexts`). A script asks for it with `translate(name, values)`; an element of
  `page.html` names it in `data-text`, or in `data-text-aria-label` for its `aria-label`.
- A value goes in braces (« {date} »), never glued to the sentence by the script: the
  words around it do not come in the same order in every language.
- A text that `render.mjs` builds from the inventory (« Editor (2 écrans) », a verdict's
  name on a label) is written into the page's data once per language
  (`writeInEveryLanguage` of `lib/languages.mjs`), and the page shows the one of its
  language (`inPageLanguage`). What is sized from a text (a column of labels) takes the
  longest of the languages.
- A test checks that every language has every text, with the same names in braces.

## Layout, from top to bottom

1. **Header.** On the left, the `h1` says what kind of page it is (« Inventaire des
   composants »), and under it what it is about: the name the screens share, from
   `titleInventory`. On the right, from 1000 px of width: the approval pill, then a round
   « i » that shows on hover or focus what the page was built on (dates, commit). Under
   1000 px the right part goes under the title.
2. **Legend.** One entry per category the page draws, none for a category it has
   nothing of: a dotted line and the label, both in the category's colour.
3. **What to show.** Tabs for the screens. When things are nested (the components of the
   specs page), a tree picks which one is shown: it is a column on the left of the capture,
   drawn on the page itself (a card is kept for what is read, not for the navigation),
   in view while the capture scrolls, and the tabs of the shown thing sit on the capture's
   card. On a window too narrow for the tree, the capture and the panel side by side
   (under about 1270 px), the tree goes above first: the capture and its panel stay
   together as long as they can.
4. **The settings**, when the page has any: what changes the way the page is read, never
   what it says. A round cog under the « i » of the header (`.settings-button`, in
   `.status-buttons`) shows them in a panel over the page (`.page-settings`), which stays
   while the developer ticks its boxes: the cog again, a click anywhere else or Escape
   hides it. Each setting is a box to tick with what it does
   (`.page-switch`). A page adds its boxes there and wires them with `wireSettingSwitch`
   of the shared `pageReview.mjs`: the browser keeps each choice for every page of the
   same kind. No setting sits elsewhere on the page.
5. **One line of hint**: what a click does and how to come back.
6. **The capture and its side panel**, in `.capture-beside-panel`: side by side while the
   window has room, the panel under the capture otherwise.
7. **The corrections bar**, fixed at the bottom of the window. It covers what is under
   it, and its height changes (the form opens, the corrections add up): the shared
   `pageReview.mjs` measures it into `--corrections-bar-height`, and `pageBase.css` ends
   the page, the side panel and what is scrolled into view above it. A page never sets a
   fixed room for the bar.

## Controls

- A button has a 1 px edge in `--text-muted`, a 6 px radius, a `--surface` fill and 13 px
  text.
- What throws the developer's work away (« Tout effacer ») is not such a button but underlined
  text in `--text-muted` (`.quiet-action`): it never weighs as much as the button beside
  it.
- A tab looks like a button; the picked one is filled with `--text`. Screen tabs are named
  « 1 · Off · Default »: the screen's number, then what its name does not share with the
  others (`shortenScreenNames`). The left and right arrow keys step through the tabs;
  the page does not write it.
- A node of a tree is a line of text, as in the file tree of a code editor; the shown one
  is filled with `--text` like a picked tab. Lines join a parent to its children. A small
  square in the category's colour ends the line, and a legend under the tree names the
  squares. At that size two close colours are hard to tell apart: the tree takes colours
  that are far from each other (purple for « À créer », green for « À adapter »). The
  square keeps its colour on the shown line.
- A choice between a few answers is a row of such buttons, filled once picked
  (`.correction-choices`).
- Escape drops the selection. While the caret is in a field, the page's keys do nothing,
  except Escape, which leaves the field.

## Captures and outlines

- A capture is drawn at the mock-up's size: one pixel of the mock-up is one pixel of the
  page.
- A capture sits on a card (`--surface`, 1 px `--border`, 8 px radius), under a title that
  links to the screen in Figma. A card that holds one capture is as wide as the capture:
  its texts wrap to that width.
- A hint names the place it points at (« dans le panneau « Zones » »), never a side of the
  window: the panel goes under the capture on a narrow window.
- An outline is a 2 px dotted line in its category's colour, with a light halo so that it
  stays readable on a dark capture. Only the colour tells the category.
- An outline carries a small square badge on its top-left corner: a number on the
  inventory, a letter on the specs. The same badge starts the matching item of the side
  panel.
- Picking something keeps the picture in place. The picked outline stays as it is, the
  other outlines fade to `--faded-opacity`, and a veil of `--veil-opacity` covers what is
  outside the picked thing. Nothing is resized, moved or removed by a click.

## Side panel

- A card with the class `side-panel`: sticky, as tall as the window at most, scrolling on
  its own.
- An uppercase heading (`h3`) names each list: « Composants », « Zones ».
- A list of `.panel-items`: one item per thing outlined on the capture. An item is its
  badge and its title in the category's colour (`.item-title`, `.item-badge`), a bar of
  that colour on its left, then its sentences in plain text.
- A click on an item picks the same thing as a click on its outline. The picked item is
  tinted, the others fade.
- A click never leaves what is shown without saying so. What leads elsewhere (the specs of
  a component nested in the shown one) is a link in the item, named after where it goes:
  « Ouvrir Select → ».
- What the developer decided is written « Décidé par le développeur : … » in bold
  (`.developer-words`).
- A list keeps its length and its order whatever is picked: what relates to the picked
  thing stands out, the rest fades. Nothing is filtered away.

## Corrections

- The developer corrects on the page and pastes the result in the chat: the page never
  writes a file.
- The form is in the bar at the bottom: on the left what is being corrected, named in
  full (« Corriger Select · zone A »), and its fields; on the right the count of
  corrections, « Copier les corrections », « Tout effacer », and the list.
- The empty state tells what to click: « Aucune correction : cliquer sur … pour le
  corriger ».
- The text to paste is built by a module of `scripts/lib`, tested there, and pasted into
  the page as a plain script: the page's script imports nothing.
- Corrections are kept in the browser under a key that holds a hash of the data, so that
  a page rebuilt from other data starts without them.

## Review checks

- The developer ticks a box on each thing he has checked: « Vérifié » on an item of the
  side panel (what the capture does not outline has its own list there, « Non entourés »,
  with a box per item), « Écran vérifié : … » under a capture, « Composant vérifié : … » at the end
  of the specs' panel. The box says what ticking it means. A zone has no box of its own:
  the screen's box covers the zones drawn on it.
- A box (`.review-check`) is grey until ticked, then bold in `--text`: green is a
  verdict's colour (« Réutilisé »), so it does not also say "checked". A tab whose
  screen is ticked ends with « ✓ », and so does a node of the tree once the component's
  box and the boxes of its screens are ticked.
- What waits for the developer's decision, or carries a correction, cannot be ticked: the
  box is disabled and says why.
- The bar at the bottom counts them and says what they are: « 12 / 31 vérifiés (8
  composants, 23 écrans) ». No button ticks everything.
- Beside the count, « Suivant à vérifier → » brings into view the next box that can be
  ticked and is not, on whatever tab or component holds it, and outlines it
  (`.review-check.pointed`). Whatever was picked is dropped first: the box is never shown
  faded. It goes away once nothing is left to tick.
- The boxes, their count and the invitation to approve are made by the shared
  `scripts/page/pageReview.mjs`, which `writeStandalonePage` pastes before the page's own
  `page.js`: a page says what its boxes are and when one cannot be ticked, never how a box
  is drawn, kept or counted. The same file fills the header (`showPageHeader`) and copies a
  text with its « Copié » (`copyWithConfirmation`): a page does not write these again.
- A check is kept in the browser as a hash of what the developer read (`reviewHash`,
  worked out by the lib): a rebuilt page keeps the checks of what did not change.
- The boxes only help the developer keep track of what he has read: they approve nothing
  and block nothing. The page cannot write a file, so the approval is given in the
  conversation: once nothing waits for a decision and no correction is left, the bar
  invites the developer to say there that he approves (`.approval-invitation`), ticked or
  not, and the model runs the script's `--approve`. An approved page does not show the
  invitation.

## Access

- Everything a click does is reachable with the keyboard: what is clickable is a
  `<button>`, or holds one.
- The state of a button is in an ARIA attribute the CSS reads (`aria-selected` for a tab,
  `aria-pressed` for a toggle, `aria-current` for a node of a tree), not in a class alone.
- A text shown on hover is also shown on focus.

## Before handing a page over

- Render it on real data and open it in Firefox; a headless Playwright run from a repo
  that has Playwright is enough to check clicks, keys and the absence of script errors.
- Look at a screenshot at 1500 px, at 1280 px (a laptop) and at 800 px of width.
- A refactor of the page's files leaves the rendered HTML byte-identical: compare before
  and after.
