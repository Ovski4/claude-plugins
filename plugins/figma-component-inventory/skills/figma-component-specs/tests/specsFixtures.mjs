// @ts-check
// The approved inventory and the specs.json the tests of this folder start from.

/** @typedef {import("../scripts/lib/componentSpecs.mjs").SpecsFile} SpecsFile */

const SETTINGS_BOX = { x: 24, y: 244, width: 432, height: 92 }
const SELECT_BOX = { x: 24, y: 272, width: 200, height: 40 }
const GROUP_BOX = { x: 24, y: 244, width: 432, height: 68 }
const LABEL_BOX = { x: 24, y: 244, width: 70, height: 20 }
const SELECT_VALUE_BOX = { x: 32, y: 282, width: 60, height: 20 }
const CLOSE_BUTTON_BOX = { x: 420, y: 16, width: 36, height: 36 }

// One screen: the temperature settings to create hold a plain "Group" frame, a Select to
// adapt showing « 19,5 °C », wrapped in a row of its own size, and the « Consigne » label;
// the close button, reused, sits outside.
export const buildApprovedInventory = () =>
  /** @type {import("../scripts/lib/componentSpecs.mjs").ApprovedInventory} */ (
    /** @type {unknown} */ ({
      fingerprint: {
        figma: {
          fileKey: "AbCdEfGhIjKlMnOpQrStUv",
          version: "2423993102449653660",
          lastModified: "2026-11-20T10:18:35Z",
        },
        gitCommit: "34ee98aa6",
      },
      approvedOn: "2026-11-23",
      screens: [
        {
          number: 1,
          nodeId: "87:91461",
          name: "Editor — regulation · Continuous · Default",
          capture: {
            file: "screen-87-91461.png",
            x: -24,
            y: -16,
            width: 528,
            height: 468,
          },
          texts: [
            { nodeId: "87:1", characters: "Consigne", box: LABEL_BOX },
            { nodeId: "87:2", characters: "Fermer", box: CLOSE_BUTTON_BOX },
            { nodeId: "87:3", characters: "19,5 °C", box: SELECT_VALUE_BOX },
          ],
        },
      ],
      judgedCandidates: [
        {
          number: 3,
          figmaName: "Button — icon",
          outlined: true,
          partsNotOutlined: [],
          instances: [
            {
              letter: "a",
              screen: 1,
              variant: "",
              box: CLOSE_BUTTON_BOX,
              verdict: "reused",
              codeComponent: "Button",
              codePath: "src/components/ui/button.tsx",
            },
          ],
        },
        {
          number: 8,
          figmaName: "Input — field",
          outlined: true,
          partsNotOutlined: [],
          instances: [
            {
              letter: "a",
              screen: 1,
              variant: "State=Default",
              box: SELECT_BOX,
              verdict: "to-adapt",
              codeComponent: "Select",
              codePath: "src/components/ui/select.tsx",
              note: "Le libellé au-dessus du champ manque.",
              developerDecision: "Le libellé devient une prop du Select.",
            },
          ],
        },
        {
          number: 17,
          figmaName: "Mode settings",
          outlined: true,
          partsNotOutlined: [],
          instances: [
            {
              letter: "b",
              screen: 1,
              variant: "",
              box: SETTINGS_BOX,
              verdict: "to-create",
              codeComponent: "OrderDeliverySettings",
              codePath: null,
              note: "Aucun composant ne dessine ces réglages.",
              developerDecision: null,
            },
          ],
        },
        {
          number: 19,
          figmaName: "Group",
          outlined: false,
          partsNotOutlined: [],
          instances: [{ letter: "a", screen: 1, variant: "", box: GROUP_BOX }],
        },
        {
          number: 20,
          figmaName: "Field row",
          outlined: false,
          partsNotOutlined: [],
          instances: [{ letter: "a", screen: 1, variant: "", box: SELECT_BOX }],
        },
      ],
    })
  )

/** @returns {SpecsFile} */
export const buildSpecsFile = () => ({
  figmaVersion: "2423993102449653660",
  components: [
    {
      codeComponent: "Select",
      changes: [{ what: "Hauteur du champ", before: "32 px", after: "36 px" }],
      props: [],
      zones: [
        {
          letter: "A",
          label: "Champ",
          kind: "change",
          parts: [{ instance: "8a" }],
        },
      ],
    },
    {
      codeComponent: "OrderDeliverySettings",
      props: [
        {
          name: "targetTemperature",
          type: "number",
          required: true,
          source: "state.targetTemperature de useOrderEditorState",
        },
      ],
      zones: [
        {
          letter: "A",
          label: "Consigne",
          kind: "prop",
          parts: [{ candidate: 8 }],
          props: ["targetTemperature"],
        },
        {
          letter: "B",
          label: "Libellé « Consigne »",
          kind: "fixed",
          parts: [{ text: "Consigne" }],
        },
      ],
    },
  ],
})
