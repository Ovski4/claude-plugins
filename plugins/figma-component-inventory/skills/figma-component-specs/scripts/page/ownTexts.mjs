// @ts-check
// The texts only specs.html shows, in each language the developer can read the page in.
// render.mjs pastes this file into the page before page.js, as a plain script without its
// "export" word: page.js adds them to the shared texts of the inventory skill's
// pageTexts.mjs. Nothing here touches the page, so that the tests can load it.
// What the model wrote in specs.json (the zones' names, the rules, the questions) is
// shown as written.

/** @type {Record<import("../../../figma-component-inventory/scripts/page/pageTexts.mjs").PageLanguage, Record<string, string>>} */
export const OWN_PAGE_TEXTS = {
  fr: {
    "page.title": "Props des composants à créer ou à adapter",
    "page.documentTitle": "Props — {subject}",
    "page.hint":
      "Cliquer sur un encadré pour voir ses règles dans le panneau « Zones », faire ressortir ses props et le corriger ; recliquer, cliquer à côté ou Échap pour revenir.",
    "tree.title": "Composants",
    "tree.component": "{component}, {verdict}",
    "tree.componentReviewed": "{component}, {verdict}, vérifié",
    "screen.tabs": "Écran",
    "screen.link": "Écran {number} — {name}",
    "screen.size": "{component} : {width} × {height} px",
    "screen.sizeSameSpecs.one":
      "{component} : {width} × {height} px · mêmes specs sur l'écran {screens}",
    "screen.sizeSameSpecs.several":
      "{component} : {width} × {height} px · mêmes specs sur les écrans {screens}",
    "screen.noFile": "Pas encore de fichier : composant à créer.",
    "outline.zone": "Zone {letter} : {label}",
    "panel.allProps": "Toutes les props",
    "panel.whatChanges": "Ce qui change",
    "panel.before": "Avant",
    "panel.after": "Après",
    "panel.changedProps": "Props nouvelles ou modifiées",
    "panel.zones": "Zones",
    "prop.type": "Type",
    "prop.source": "D'où vient la valeur",
    "prop.rule": "Règle",
    "prop.zones": "Zones",
    "prop.required": "obligatoire",
    "prop.optional": "optionnelle",
    "zone.props": "Props : ",
    "zone.openComponent": "Ouvrir {component} →",
    "review.component":
      "Composant vérifié : ses props, ses changements et ses décisions",
    "review.screen":
      "Écran vérifié : les zones de {component} sont justes, rien n'est oublié",
    "correction.title": "Corriger {target}",
    "correction.answer": "À trancher : réponse à la question",
    "corrections.none":
      "Aucune correction : cliquer sur un composant ou une zone pour le corriger",
  },
  en: {
    "page.title": "Props of the components to create or to adapt",
    "page.documentTitle": "Props — {subject}",
    "page.hint":
      "Click an outline to see its rules in the “Zones” panel, bring out its props and correct it; click it again, click beside it or press Escape to come back.",
    "tree.title": "Components",
    "tree.component": "{component}, {verdict}",
    "tree.componentReviewed": "{component}, {verdict}, checked",
    "screen.tabs": "Screen",
    "screen.link": "Screen {number} — {name}",
    "screen.size": "{component}: {width} × {height} px",
    "screen.sizeSameSpecs.one":
      "{component}: {width} × {height} px · same specs on screen {screens}",
    "screen.sizeSameSpecs.several":
      "{component}: {width} × {height} px · same specs on screens {screens}",
    "screen.noFile": "No file yet: component to create.",
    "outline.zone": "Zone {letter}: {label}",
    "panel.allProps": "All the props",
    "panel.whatChanges": "What changes",
    "panel.before": "Before",
    "panel.after": "After",
    "panel.changedProps": "New or changed props",
    "panel.zones": "Zones",
    "prop.type": "Type",
    "prop.source": "Where the value comes from",
    "prop.rule": "Rule",
    "prop.zones": "Zones",
    "prop.required": "required",
    "prop.optional": "optional",
    "zone.props": "Props: ",
    "zone.openComponent": "Open {component} →",
    "review.component":
      "Component checked: its props, its changes and its decisions",
    "review.screen":
      "Screen checked: the zones of {component} are right, nothing is missing",
    "correction.title": "Correct {target}",
    "correction.answer": "To decide: answer to the question",
    "corrections.none":
      "No correction: click a component or a zone to correct it",
  },
}
