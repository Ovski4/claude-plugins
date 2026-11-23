// @ts-check
// Reads the settings file of the repo whose code is judged: where its components are and
// whether it has a Figma-to-code map.
import fs from "node:fs"
import path from "node:path"

/**
 * @typedef {object} ProjectSettings
 * @property {string} componentsFolder the folder that holds every UI component, from the
 *   repo's root: "src/components"
 * @property {string[]} componentFileExtensions the extensions of a component file:
 *   [".tsx"]. Test and Storybook files (button.test.tsx, button.stories.tsx) are left out.
 * @property {string | null} designSystemFolder the folder of the shared components, from
 *   the repo's root: "src/components/ui". Its files are proposed before a feature's own.
 *   null when the repo has no such folder: no file gets priority.
 * @property {string | null} figmaToCodeMap the Markdown table that gives the component of
 *   each Figma component, from the repo's root: "docs/design/figma-react-map.md". null when
 *   the repo has none: no name is pre-filled and every candidate gets the files with a
 *   close name.
 */

const PROJECT_SETTINGS_PATH = ".claude/figma-component-inventory.json"

const EXAMPLE_OF_SETTINGS_FILE = JSON.stringify(
  {
    componentsFolder: "src/components",
    componentFileExtensions: [".tsx"],
    designSystemFolder: "src/components/ui",
    figmaToCodeMap: null,
  },
  null,
  2,
)

/** @param {unknown} value */
const isFilledString = (value) => typeof value === "string" && value !== ""
/** @param {unknown} value */
const isFilledStringOrAbsent = (value) => value == null || isFilledString(value)

/**
 * @param {string} settingsText the content of the settings file
 * @returns {ProjectSettings}
 */
export function parseProjectSettings(settingsText) {
  const settings = JSON.parse(settingsText)
  const extensions = settings.componentFileExtensions
  const problems = [
    !isFilledString(settings.componentsFolder) &&
      '"componentsFolder" must be a folder path',
    !(
      Array.isArray(extensions) &&
      extensions.length > 0 &&
      extensions.every(
        (extension) => isFilledString(extension) && extension.startsWith("."),
      )
    ) &&
      '"componentFileExtensions" must list at least one extension like ".tsx"',
    !isFilledStringOrAbsent(settings.designSystemFolder) &&
      '"designSystemFolder" must be a folder path or null',
    !isFilledStringOrAbsent(settings.figmaToCodeMap) &&
      '"figmaToCodeMap" must be a file path or null',
  ].filter((problem) => typeof problem === "string")
  if (problems.length)
    throw new Error(`${PROJECT_SETTINGS_PATH}: ${problems.join("; ")}`)
  return {
    componentsFolder: settings.componentsFolder,
    componentFileExtensions: extensions,
    designSystemFolder: settings.designSystemFolder ?? null,
    figmaToCodeMap: settings.figmaToCodeMap ?? null,
  }
}

/**
 * @param {string} repoRoot
 * @returns {ProjectSettings}
 */
export function readProjectSettings(repoRoot) {
  const settingsFile = path.join(repoRoot, PROJECT_SETTINGS_PATH)
  if (!fs.existsSync(settingsFile))
    throw new Error(
      `${PROJECT_SETTINGS_PATH} is missing in ${repoRoot}. Create it with the paths of this repo, for example:\n${EXAMPLE_OF_SETTINGS_FILE}`,
    )
  return parseProjectSettings(fs.readFileSync(settingsFile, "utf8"))
}

const NAME_ENDINGS_OF_NON_COMPONENT_FILES = [".test", ".stories"]

/**
 * @param {string} file
 * @param {string[]} componentFileExtensions
 */
export function isComponentFile(file, componentFileExtensions) {
  const extension = componentFileExtensions.find((each) => file.endsWith(each))
  if (!extension) return false
  const nameWithoutExtension = file.slice(0, -extension.length)
  return !NAME_ENDINGS_OF_NON_COMPONENT_FILES.some((ending) =>
    nameWithoutExtension.endsWith(ending),
  )
}
