// @ts-check
// The developer's approval of specs.json: what still keeps him from giving it, the stamp
// written once he has, and whether the specs changed since.
import {
  buildApproval,
  hashApprovedContent,
  readStandingApprovalDate as readStandingApprovalDateOf,
  SPECS_HASH_KEY,
} from "../../../figma-component-inventory/scripts/lib/approval.mjs"

/** @typedef {import("./componentSpecs.mjs").SpecsFile} SpecsFile */
/** @typedef {import("./componentSpecs.mjs").ComponentSpec} ComponentSpec */
/** @typedef {import("../../../figma-component-inventory/scripts/lib/approval.mjs").ApprovalOf<typeof SPECS_HASH_KEY>} SpecsApproval */

/**
 * The zones that still ask the developer a question: the specs cannot be approved while
 * there is one.
 * @param {SpecsFile} specsFile
 * @returns {string[]} "OrderDeliverySettings zone C"
 */
export function listZonesStillToDecide(specsFile) {
  return specsFile.components.flatMap((component) =>
    component.zones
      .filter((zone) => zone.kind === "to-decide")
      .map((zone) => `${component.codeComponent} zone ${zone.letter}`),
  )
}

/** @param {ComponentSpec[]} components changes as soon as any prop, zone or decision does */
export const hashComponents = (components) => hashApprovedContent(components)

/**
 * @param {ComponentSpec[]} components the specs the developer has just approved
 * @param {Date} now
 * @returns {SpecsApproval}
 */
export const buildSpecsApproval = (components, now) =>
  buildApproval(SPECS_HASH_KEY, components, now)

/**
 * The day of the approval while it stands: null when the developer has not approved, or
 * when anything changed since, which makes the page a draft again.
 * @param {SpecsFile} specsFile
 * @returns {string | null}
 */
export const readStandingApprovalDate = ({ approval, components }) =>
  readStandingApprovalDateOf(SPECS_HASH_KEY, approval, components)
