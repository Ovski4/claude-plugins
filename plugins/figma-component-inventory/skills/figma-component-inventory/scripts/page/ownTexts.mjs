// @ts-check
// The texts only inventory.html shows, in each language the developer can read the page
// in. render.mjs pastes this file into the page before pageReview.mjs, as a plain script
// without its "export" word: pageReview.mjs adds them to the shared texts of pageTexts.mjs.
// Nothing here touches the page, so that the tests can load it.
// What the model wrote in verdicts.json (the reasons, the questions) is shown as written.

/** @type {Record<import("./pageTexts.mjs").PageLanguage, Record<string, string>>} */
export const OWN_PAGE_TEXTS = {
  fr: {
    "page.title": "Inventaire des composants",
    "page.documentTitle": "Inventaire — {subject}",
    "page.builtOn": "Construit le {date} · {mockupAndCommit}",
    "screen.openInFigma": "Ouvrir dans Figma",
    "correction.everyUse": "Toutes ses utilisations",
    "page.hint":
      "Cliquer sur un composant, son étiquette ou sa raison pour l'isoler et le corriger ; recliquer, cliquer à côté ou Échap pour revenir.",
    "settings.textsOutsideLeaves":
      "Textes hors sous-composant : montrer chaque texte qu'aucun sous-composant ne contient",
    "settings.differencesOnly":
      "Différences seulement : estomper ce qui est identique sur tous les écrans",
    "settings.hideOutOfScope":
      "Sans le hors périmètre : cacher les composants hors périmètre et ne plus les compter parmi ce qui est à vérifier",
    "tabs.allScreens": "Tous les écrans",
    "panel.components": "Composants",
    "panel.notOutlined": "Non entourés",
    "panel.outOfScopeLeftOut.one":
      "{count} hors périmètre masqué (voir les paramètres)",
    "panel.outOfScopeLeftOut.several":
      "{count} hors périmètre masqués (voir les paramètres)",
    "panel.developerDecided": "Décidé par le développeur",
    "review.screen":
      "Écran vérifié : tout ce qui est entouré est juste, rien n'est oublié",
    "review.component": "Vérifié",
    "review.notAComponent": "Vérifié : pas un composant à part",
    "correction.verdict": "Verdict",
    "correction.component": "Composant React",
    "correction.sameAs": "Même composant que",
    "correction.toDecide": "À trancher : {question}",
    "corrections.none":
      "Aucune correction : cliquer sur un composant pour le corriger",
    "corrections.title": "Corrections de l'inventaire « {subject} » :",
    "corrections.field.verdict": "verdict",
    "corrections.field.component": "composant React",
    "corrections.field.sameAs": "même composant que",
  },
  en: {
    "page.title": "Component inventory",
    "page.documentTitle": "Inventory — {subject}",
    "page.builtOn": "Built on {date} · {mockupAndCommit}",
    "screen.openInFigma": "Open in Figma",
    "correction.everyUse": "All its uses",
    "page.hint":
      "Click a component, its label or its reason to isolate and correct it; click it again, click beside it or press Escape to come back.",
    "settings.textsOutsideLeaves":
      "Texts outside sub-components: show each text that no sub-component holds",
    "settings.differencesOnly":
      "Differences only: fade what is the same on every screen",
    "settings.hideOutOfScope":
      "Without out of scope: hide the out-of-scope components and leave them out of what is to check",
    "tabs.allScreens": "All screens",
    "panel.components": "Components",
    "panel.notOutlined": "Not outlined",
    "panel.outOfScopeLeftOut.one":
      "{count} out-of-scope component hidden (see the settings)",
    "panel.outOfScopeLeftOut.several":
      "{count} out-of-scope components hidden (see the settings)",
    "panel.developerDecided": "Decided by the developer",
    "review.screen":
      "Screen checked: everything outlined is right, nothing is missing",
    "review.component": "Checked",
    "review.notAComponent": "Checked: not a component of its own",
    "correction.verdict": "Verdict",
    "correction.component": "React component",
    "correction.sameAs": "Same component as",
    "correction.toDecide": "To decide: {question}",
    "corrections.none": "No correction: click a component to correct it",
    "corrections.title": "Corrections of the inventory “{subject}”:",
    "corrections.field.verdict": "verdict",
    "corrections.field.component": "React component",
    "corrections.field.sameAs": "same component as",
  },
}
