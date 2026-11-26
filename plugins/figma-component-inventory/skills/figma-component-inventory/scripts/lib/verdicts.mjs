// @ts-check
// The rules of verdicts.json, the file the model fills: the five verdicts, what each one
// requires, the empty file given to the model, and the developer's approval.
import {
  buildApproval as buildApprovalOf,
  hashApprovedContent,
  readStandingApprovalDate,
} from "./approval.mjs"
import { listScreenNumbers } from "./mergeScreens.mjs"

// The field of verdicts.json's approval that holds the hash of the approved verdicts.
export const VERDICTS_HASH_KEY = "verdictsHash"

/** @typedef {import("./mergeScreens.mjs").MergedCandidate} Candidate */
/** @typedef {import("./mergeScreens.mjs").InstanceOnAScreen} Instance */
/** @typedef {"reused" | "to-adapt" | "to-create" | "out-of-scope" | "to-decide"} VerdictKey */
/**
 * What is said of a candidate, or of some of its instances.
 * @typedef {object} Judgement
 * @property {VerdictKey | null} [verdict] null until the model has judged
 * @property {string | null} [codeComponent] the React component: the existing one, or the proposed name for "to-create"
 * @property {string | null} [codePath] that component's file, from the repo's root
 * @property {string} [note] the reason, in the repo's language, printed under the image
 * @property {string} [question] for "to-decide": what the developer is asked
 * @property {string[]} [options] for "to-decide": the answers he picks from
 * @property {"developer"} [decidedBy] set when the developer gave this entry himself: no model changes it afterwards
 * @property {string} [developerDecision] one sentence in the repo's language saying what he decided
 */
/**
 * One entry of verdicts.json.
 * @typedef {Judgement & {
 *   number: number,
 *   figmaName: string,
 *   outlined?: boolean,
 *   except?: VerdictException[],
 * }} VerdictEntry
 * `outlined: false`: a Figma component that is not a React component of its own.
 * `except`: the instances whose judgement differs from the entry's.
 */
/**
 * What differs for some instances of a candidate, named by letter (`instances`) or by the
 * screens they are on (`screens`): another verdict, or another React component when the
 * candidate is several components in the code. An exception takes the entry's verdict and
 * component when it gives none, and writes its own note.
 * @typedef {Judgement & {
 *   instances?: string[],
 *   screens?: number[],
 *   outlined?: boolean,
 * }} VerdictException
 * `outlined: false`: on these instances the candidate is not a React component of its own
 * (a plain paragraph of its parent); the note says what draws them. No verdict.
 */
/**
 * The instances of an outlined candidate that an exception leaves without an outline.
 * @typedef {object} PartNotOutlined
 * @property {Instance[]} instances
 * @property {boolean} isNamedByScreens true when the exception names screens, false when it names letters
 * @property {string} note what draws these instances, in the repo's language
 */
/** @typedef {import("./approval.mjs").ApprovalOf<typeof VERDICTS_HASH_KEY>} Approval */
/** @typedef {{ figmaVersion: string, verdicts: VerdictEntry[], approval?: Approval }} VerdictsFile */
/**
 * @typedef {Instance & {
 *   verdict: VerdictKey,
 *   codeComponent: string | null,
 *   codePath: string | null,
 *   note: string | null,
 *   question: string | null,
 *   options: string[] | null,
 *   developerDecision: string | null,
 * }} JudgedInstance
 * `developerDecision`: null when the model judged; "" when the developer decided without a sentence.
 */
/**
 * A candidate with its entry of verdicts.json, and each instance with its own verdict.
 * @typedef {Omit<Candidate, "instances"> & Omit<VerdictEntry, "except" | "outlined"> & {
 *   outlined: boolean,
 *   instances: JudgedInstance[],
 *   partsNotOutlined: PartNotOutlined[],
 * }} JudgedCandidate
 * `instances`: without those of `partsNotOutlined`.
 */

/**
 * A verdict's name is the text "verdict.<key>" of the pages' shared dictionary.
 * color: of the outline and of every text about it in the page.
 * requiredFields: what the model must give with this verdict.
 * needsExistingCodePath: true when codePath must be a file of the repo.
 * @type {Record<VerdictKey, { color: string, requiredFields: (keyof Judgement)[], needsExistingCodePath: boolean }>}
 */
export const VERDICTS = {
  reused: {
    color: "#15803d",
    requiredFields: ["codeComponent", "codePath", "note"],
    needsExistingCodePath: true,
  },
  "to-adapt": {
    color: "#0369a1",
    requiredFields: ["codeComponent", "codePath", "note"],
    needsExistingCodePath: true,
  },
  "to-create": {
    color: "#7c3aed",
    requiredFields: ["codeComponent", "note"],
    needsExistingCodePath: false,
  },
  "out-of-scope": {
    color: "#be185d",
    requiredFields: ["note"],
    needsExistingCodePath: false,
  },
  "to-decide": {
    color: "#dc2626",
    requiredFields: ["note", "question", "options"],
    needsExistingCodePath: false,
  },
}
export const VERDICT_KEYS = /** @type {VerdictKey[]} */ (Object.keys(VERDICTS))

// What the developer picks on the page for an outline that is no React component of its own
// (a plain paragraph of its parent, say): the model then writes `"outlined": false`.
export const NOT_A_COMPONENT_KEY = "not-a-component"
const VERDICT_WAITING_FOR_THE_DEVELOPER = "to-decide"
export const MIN_QUIZ_OPTIONS = 2
export const MAX_QUIZ_OPTIONS = 4
// A note is printed under the image: two or three lines there, at about 110 characters a line.
const MAX_NOTE_CHARACTERS = 330
// A doubt is settled by reading the code before drawing, or asked with "to-decide".
const OPEN_DOUBT_PATTERN =
  /non vérifié|à vérifier|pas vérifié|not verified|to verify/i
// A "reused" note shows the height added up from the stylesheet: "36 px = 8 + 20 + 8".
const HEIGHT_SUM_PATTERN = /\d+(?:[.,]\d+)? ?px ?=/

/**
 * @param {Judgement} judgement a candidate's entry, or that entry with one of its exceptions applied
 * @param {string} who how the problems name it: "6 Segment"
 * @param {(codePath: string) => boolean} doesCodePathExist
 * @returns {string[]}
 */
function listProblemsOfJudgement(judgement, who, doesCodePathExist) {
  const verdict = judgement.verdict ? VERDICTS[judgement.verdict] : undefined
  if (!verdict) {
    return [
      `${who}: verdict ${JSON.stringify(judgement.verdict)} is not one of ${VERDICT_KEYS.join(", ")}`,
    ]
  }
  const problems = verdict.requiredFields
    .filter(
      (field) =>
        judgement[field] === undefined ||
        judgement[field] === null ||
        judgement[field] === "",
    )
    .map((field) => `${who}: verdict "${judgement.verdict}" needs "${field}"`)
  if (
    verdict.needsExistingCodePath &&
    judgement.codePath &&
    !doesCodePathExist(judgement.codePath)
  ) {
    problems.push(
      `${who}: codePath "${judgement.codePath}" does not exist in the repo`,
    )
  }
  const note = judgement.note ?? ""
  if (note.length > MAX_NOTE_CHARACTERS) {
    problems.push(
      `${who}: "note" is ${note.length} characters, the limit is ${MAX_NOTE_CHARACTERS} (2 or 3 lines)`,
    )
  }
  if (
    judgement.verdict === "reused" &&
    note &&
    !HEIGHT_SUM_PATTERN.test(note)
  ) {
    problems.push(
      `${who}: a "reused" note gives the height added up from the stylesheet, "36 px = 8 + 20 + 8 (.primaryLarge)"`,
    )
  }
  if (OPEN_DOUBT_PATTERN.test(note)) {
    problems.push(
      `${who}: "note" leaves a point to verify; check it in the code, or use "to-decide"`,
    )
  }
  const optionCount = judgement.options?.length ?? 0
  const hasWrongOptionCount =
    optionCount < MIN_QUIZ_OPTIONS || optionCount > MAX_QUIZ_OPTIONS
  if (
    judgement.verdict === VERDICT_WAITING_FOR_THE_DEVELOPER &&
    judgement.options &&
    hasWrongOptionCount
  ) {
    problems.push(
      `${who}: "options" needs ${MIN_QUIZ_OPTIONS} to ${MAX_QUIZ_OPTIONS} choices`,
    )
  }
  return problems
}

/**
 * What is said of the instances an exception names. The exception takes the entry's verdict
 * and React component when it gives none, and that component's file with it. Everything
 * else is its own: a reason, a question or a developer's decision written for the entry
 * says nothing of these instances.
 * @param {Judgement} entry
 * @param {Judgement} exception
 * @returns {Judgement}
 */
function applyException(entry, exception) {
  const namesItsOwnComponent = exception.codeComponent !== undefined
  return {
    verdict: exception.verdict ?? entry.verdict,
    codeComponent: namesItsOwnComponent
      ? exception.codeComponent
      : entry.codeComponent,
    codePath: namesItsOwnComponent
      ? exception.codePath
      : (exception.codePath ?? entry.codePath),
    note: exception.note,
    question: exception.question,
    options: exception.options,
    decidedBy: exception.decidedBy,
    developerDecision: exception.developerDecision,
  }
}

/**
 * @param {VerdictException} exception
 * @param {Instance} instance
 */
function doesExceptionName(exception, instance) {
  return Boolean(
    exception.instances?.includes(instance.letter) ||
    exception.screens?.includes(instance.screen),
  )
}

/**
 * Everything that keeps verdicts.json from being drawn. An empty list means it is valid.
 * @param {object} inventory
 * @param {Candidate[]} inventory.candidates
 * @param {string} inventory.figmaVersionOfCandidates the Figma version candidates.json was built on
 * @param {VerdictsFile} inventory.verdictsFile
 * @param {(codePath: string) => boolean} inventory.doesCodePathExist
 * @returns {string[]}
 */
export function listVerdictProblems({
  candidates,
  figmaVersionOfCandidates,
  verdictsFile,
  doesCodePathExist,
}) {
  const { figmaVersion, verdicts: entries } = verdictsFile
  const problems = []
  if (figmaVersion !== figmaVersionOfCandidates) {
    problems.push(
      `verdicts.json was filled for Figma version ${figmaVersion}, candidates.json is at ${figmaVersionOfCandidates}`,
    )
  }
  const candidatesByNumber = new Map(
    candidates.map((candidate) => [candidate.number, candidate]),
  )
  const entriesByNumber = Map.groupBy(entries, (entry) => entry.number)
  for (const candidate of candidates) {
    const entryCount = entriesByNumber.get(candidate.number)?.length ?? 0
    const who = `${candidate.number} ${candidate.figmaName}`
    if (candidate.mustBeJudged && entryCount === 0)
      problems.push(`${who}: no entry in verdicts.json`)
    if (entryCount > 1)
      problems.push(`${who}: ${entryCount} entries in verdicts.json`)
  }
  for (const entry of entries) {
    const candidate = candidatesByNumber.get(entry.number)
    const who = `${entry.number} ${entry.figmaName}`
    if (!candidate) {
      problems.push(`${who}: no candidate has this number`)
      continue
    }
    if (candidate.figmaName !== entry.figmaName) {
      problems.push(
        `${who}: candidate ${entry.number} is "${candidate.figmaName}"`,
      )
    }
    if (entry.outlined === false) {
      if (!entry.note)
        problems.push(`${who}: "outlined": false needs a "note" saying why`)
      continue
    }
    problems.push(...listProblemsOfJudgement(entry, who, doesCodePathExist))
    const letters = candidate.instances.map((instance) => instance.letter)
    const screenNumbers = listScreenNumbers(candidate.instances)
    const exceptions = entry.except ?? []
    const lettersNamedTwice = candidate.instances
      .filter(
        (instance) =>
          exceptions.filter((each) => doesExceptionName(each, instance))
            .length > 1,
      )
      .map((instance) => instance.letter)
    if (lettersNamedTwice.length)
      problems.push(
        `${who}: instance(s) ${lettersNamedTwice.join(" ")} are named by several "except"`,
      )
    for (const exception of exceptions) {
      const exceptedLetters = exception.instances ?? []
      const exceptedScreens = exception.screens ?? []
      const unknownLetters = exceptedLetters.filter(
        (letter) => !letters.includes(letter),
      )
      const unknownScreens = exceptedScreens.filter(
        (screen) => !screenNumbers.includes(screen),
      )
      const exceptionWho = exceptedScreens.length
        ? `${who}, except screens ${exceptedScreens.join(" ")}`
        : `${who}, except ${exceptedLetters.join(" ")}`
      if (!exceptedLetters.length && !exceptedScreens.length)
        problems.push(
          `${who}: an "except" has neither "instances" nor "screens"`,
        )
      if (unknownLetters.length)
        problems.push(
          `${exceptionWho}: the candidate's instances are ${letters.join(" ")}`,
        )
      if (unknownScreens.length)
        problems.push(
          `${exceptionWho}: the candidate is on screens ${screenNumbers.join(" ")}`,
        )
      if (exception.outlined === false) {
        if (!exception.note)
          problems.push(
            `${exceptionWho}: "outlined": false needs a "note" saying what draws it`,
          )
        continue
      }
      problems.push(
        ...listProblemsOfJudgement(
          applyException(entry, exception),
          exceptionWho,
          doesCodePathExist,
        ),
      )
    }
  }
  return problems
}

/**
 * The verdicts.json given to the model: one entry to fill per candidate that must be judged,
 * and the entries the developer decided, whatever their candidate.
 * @param {object} inventory
 * @param {Candidate[]} inventory.candidates
 * @param {string} inventory.figmaVersion
 * @param {import("./figmaToCodeMap.mjs").LookUpInFigmaToCodeMap} inventory.lookUpInFigmaToCodeMap
 * @param {VerdictEntry[]} inventory.previousEntries the entries of the file being replaced: those
 *   the developer decided are kept, found again by Figma name since numbers may have moved
 * @returns {VerdictsFile}
 */
export function buildVerdictsSkeleton({
  candidates,
  figmaVersion,
  lookUpInFigmaToCodeMap,
  previousEntries,
}) {
  const developerEntriesByFigmaName = new Map(
    previousEntries
      .filter((entry) => entry.decidedBy === "developer")
      .map((entry) => [entry.figmaName, entry]),
  )
  const verdicts = candidates
    .filter(
      (candidate) =>
        candidate.mustBeJudged ||
        developerEntriesByFigmaName.has(candidate.figmaName),
    )
    .map(({ number, figmaName }) => {
      const developerEntry = developerEntriesByFigmaName.get(figmaName)
      if (developerEntry) return { ...developerEntry, number }
      const { codeComponent, codePath } = lookUpInFigmaToCodeMap(figmaName)
      return { number, figmaName, codeComponent, codePath, verdict: null }
    })
  return { figmaVersion, verdicts }
}

/**
 * Joins the candidates that have an entry with that entry. Call it on valid verdicts only.
 * @param {Candidate[]} candidates
 * @param {VerdictEntry[]} entries
 * @returns {JudgedCandidate[]}
 */
export function applyVerdictsToCandidates(candidates, entries) {
  const entriesByNumber = new Map(entries.map((entry) => [entry.number, entry]))
  return candidates.flatMap((candidate) => {
    const candidateEntry = entriesByNumber.get(candidate.number)
    if (!candidateEntry) return []
    const { except: allExceptions = [], ...entry } = candidateEntry
    const [exceptionsNotOutlined = [], exceptions = []] = [true, false].map(
      (isNotOutlined) =>
        allExceptions.filter(
          (each) => (each.outlined === false) === isNotOutlined,
        ),
    )
    const partsNotOutlined = exceptionsNotOutlined.map((exception) => ({
      instances: candidate.instances.filter((instance) =>
        doesExceptionName(exception, instance),
      ),
      isNamedByScreens: Boolean(exception.screens?.length),
      note: exception.note ?? "",
    }))
    const instancesNotOutlined = new Set(
      partsNotOutlined.flatMap((part) => part.instances),
    )
    const outlinedInstances = candidate.instances.filter(
      (instance) => !instancesNotOutlined.has(instance),
    )
    return {
      ...candidate,
      ...entry,
      outlined: entry.outlined !== false,
      partsNotOutlined,
      instances: outlinedInstances.map((instance) => {
        const exception = exceptions.find((each) =>
          doesExceptionName(each, instance),
        )
        const judgement = exception ? applyException(entry, exception) : entry
        return {
          ...instance,
          verdict: /** @type {VerdictKey} */ (judgement.verdict),
          codeComponent: judgement.codeComponent ?? null,
          codePath: judgement.codePath ?? null,
          note: judgement.note ?? null,
          question: judgement.question ?? null,
          options: judgement.options ?? null,
          developerDecision:
            judgement.decidedBy === "developer"
              ? (judgement.developerDecision ?? "")
              : null,
        }
      }),
    }
  })
}

/**
 * The instances of a candidate that share a verdict and a React component: several groups
 * when an exception judges some of them differently, or names another component. The page
 * and inventory.md show one item per group.
 * @param {JudgedInstance[]} instances
 */
export function groupByJudgement(instances) {
  return [
    ...Map.groupBy(
      instances,
      (instance) => `${instance.verdict}\n${instance.codeComponent}`,
    ).values(),
  ]
}

/**
 * The numbers of the outlined candidates the developer still has to decide on: the inventory
 * cannot be approved while there is one.
 * @param {JudgedCandidate[]} judgedCandidates
 */
export function listNumbersStillToDecide(judgedCandidates) {
  return judgedCandidates
    .filter((candidate) => candidate.outlined)
    .filter((candidate) =>
      candidate.instances.some(
        (instance) => instance.verdict === VERDICT_WAITING_FOR_THE_DEVELOPER,
      ),
    )
    .map((candidate) => candidate.number)
}

/**
 * Changes as soon as any verdict, note, question or option changes.
 * @param {VerdictEntry[]} entries
 */
export const hashVerdicts = (entries) => hashApprovedContent(entries)

/**
 * @param {VerdictEntry[]} entries the verdicts the developer has just approved
 * @param {Date} now
 * @returns {Approval}
 */
export const buildApproval = (entries, now) =>
  buildApprovalOf(VERDICTS_HASH_KEY, entries, now)

/**
 * False once any verdict has changed since the developer approved: the page is a draft again.
 * @param {VerdictsFile} verdictsFile
 */
export const isApprovalStillValid = ({ approval, verdicts }) =>
  readStandingApprovalDate(VERDICTS_HASH_KEY, approval, verdicts) !== null
