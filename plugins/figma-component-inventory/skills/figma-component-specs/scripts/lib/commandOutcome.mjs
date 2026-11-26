// @ts-check
// What the two commands of the skill share: the name of the file the model fills, and the
// exit codes that tell the model why a command stopped.

export { SPECS_FILE_NAME } from "../../../figma-component-inventory/scripts/lib/approval.mjs"
export const EXIT_CODE_FAILED = 1
/** The inventory is not approved, changed since its approval, or not in the promised format. */
export const EXIT_CODE_INVENTORY_NOT_USABLE = 2
/** specs.json breaks a rule. */
export const EXIT_CODE_INVALID_SPECS = 3
