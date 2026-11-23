// @ts-check
// The rules of verdicts.json, the file the model fills: the five verdicts, what each one
// requires, the empty file given to the model, and the developer's approval.
import { createHash } from "node:crypto"

/** @typedef {import("./collectCandidates.mjs").Candidate} Candidate */
/** @typedef {import("./collectCandidates.mjs").Instance} Instance */
/** @typedef {"reused" | "to-adapt" | "to-create" | "out-of-scope" | "to-decide"} VerdictKey */
/**
 * What is said of a candidate, or of some of its instances.
 * @typedef {object} Judgement
 * @property {VerdictKey | null} [verdict] null until the model has judged
 * @property {string | null} [codeComponent] the React component: the existing one, or the proposed name for "to-create"
 * @property {string | null} [codePath] that component's file, from the repo's root
 * @property {string} [note] the reason, in French, printed under the image
 * @property {string} [question] for "to-decide": what the developer is asked
 * @property {string[]} [options] for "to-decide": the answers he picks from
 * @property {"developer"} [decidedBy] set when the developer gave this entry himself: no model changes it afterwards
 * @property {string} [developerDecision] one French sentence saying what he decided
 */
/**
 * One entry of verdicts.json.
 * @typedef {Judgement & {
 *   number: number,
 *   figmaName: string,
 *   outlined?: boolean,
 *   except?: (Judgement & { instances: string[] })[],
 * }} VerdictEntry
 * `outlined: false`: a Figma component that is not a React component of its own.
 * `except`: the instances, by letter, whose judgement differs from the entry's.
 */
/**
 * @typedef {object} Approval
 * @property {string} date the day the developer approved, "2026-11-23"
 * @property {string} verdictsHash the hash of the verdicts he approved
 */
/** @typedef {{ figmaVersion: string, verdicts: VerdictEntry[], approval?: Approval }} VerdictsFile */
/**
 * @typedef {Instance & {
 *   verdict: VerdictKey,
 *   note: string | null,
 *   developerDecision: string | null,
 * }} JudgedInstance
 * `developerDecision`: null when the model judged; "" when the developer decided without a sentence.
 */
/**
 * A candidate with its entry of verdicts.json, and each instance with its own verdict.
 * @typedef {Omit<Candidate, "instances"> & Omit<VerdictEntry, "except" | "outlined"> & {
 *   outlined: boolean,
 *   instances: JudgedInstance[],
 * }} JudgedCandidate
 */

/**
 * label: shown in the page, in French because its images go into Jira tickets.
 * color: of the outline and of every text about it in the page.
 * requiredFields: what the model must give with this verdict.
 * needsExistingCodePath: true when codePath must be a file of the repo.
 * @type {Record<VerdictKey, { label: string, color: string, requiredFields: (keyof Judgement)[], needsExistingCodePath: boolean }>}
 */
export const VERDICTS = {
  reused: {
    label: "Réutilisé",
    color: "#15803d",
    requiredFields: ["codeComponent", "codePath"],
    needsExistingCodePath: true,
  },
  "to-adapt": {
    label: "À adapter",
    color: "#0891d1",
    requiredFields: ["codeComponent", "codePath", "note"],
    needsExistingCodePath: true,
  },
  "to-create": {
    label: "À créer",
    color: "#7c3aed",
    requiredFields: ["codeComponent", "note"],
    needsExistingCodePath: false,
  },
  "out-of-scope": {
    label: "Hors périmètre",
    color: "#e0218a",
    requiredFields: ["note"],
    needsExistingCodePath: false,
  },
  "to-decide": {
    label: "À trancher",
    color: "#dc2626",
    requiredFields: ["note", "question", "options"],
    needsExistingCodePath: false,
  },
}
export const VERDICT_KEYS = /** @type {VerdictKey[]} */ (Object.keys(VERDICTS))
const VERDICT_WAITING_FOR_THE_DEVELOPER = "to-decide"
const MIN_QUIZ_OPTIONS = 2
const MAX_QUIZ_OPTIONS = 4
// A note is printed under the image: two or three lines there, at about 110 characters a line.
const MAX_NOTE_CHARACTERS = 330
// A doubt is settled by reading the code before drawing, or asked with "to-decide".
const OPEN_DOUBT_PATTERN =
  /non vérifié|à vérifier|pas vérifié|not verified|to verify/i

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
 * Everything that keeps verdicts.json from being drawn. An empty list means it is valid.
 * @param {object} cut
 * @param {Candidate[]} cut.candidates
 * @param {string} cut.figmaVersionOfCandidates the Figma version candidates.json was built on
 * @param {VerdictsFile} cut.verdictsFile
 * @param {(codePath: string) => boolean} cut.doesCodePathExist
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
    for (const exception of entry.except ?? []) {
      const exceptedLetters = exception.instances ?? []
      const unknownLetters = exceptedLetters.filter(
        (letter) => !letters.includes(letter),
      )
      const exceptionWho = `${who}, except ${exceptedLetters.join(" ")}`
      if (!exceptedLetters.length)
        problems.push(`${who}: an "except" has no "instances"`)
      if (unknownLetters.length)
        problems.push(
          `${exceptionWho}: the candidate's instances are ${letters.join(" ")}`,
        )
      problems.push(
        ...listProblemsOfJudgement(
          { ...entry, ...exception },
          exceptionWho,
          doesCodePathExist,
        ),
      )
    }
  }
  return problems
}

/**
 * The verdicts.json given to the model: one entry to fill per candidate that must be judged.
 * @param {object} cut
 * @param {Candidate[]} cut.candidates
 * @param {string} cut.figmaVersion
 * @param {import("./figmaToCodeMap.mjs").LookUpInFigmaToCodeMap} cut.lookUpInFigmaToCodeMap
 * @param {VerdictEntry[]} cut.previousEntries the entries of the file being replaced: those
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
    .filter((candidate) => candidate.mustBeJudged)
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
    const { except: exceptions = [], ...entry } = candidateEntry
    return {
      ...candidate,
      ...entry,
      outlined: entry.outlined !== false,
      instances: candidate.instances.map((instance) => {
        const exception = exceptions.find((each) =>
          each.instances.includes(instance.letter),
        )
        const judgement = { ...entry, ...exception }
        return {
          ...instance,
          verdict: /** @type {VerdictKey} */ (judgement.verdict),
          note: judgement.note ?? null,
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
 * The numbers of the outlined candidates the developer still has to decide on: the cut
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

/** @param {VerdictEntry[]} entries */
function hashVerdicts(entries) {
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex")
}

/**
 * @param {VerdictEntry[]} entries the verdicts the developer has just approved
 * @param {Date} now
 * @returns {Approval}
 */
export function buildApproval(entries, now) {
  return {
    date: now.toISOString().slice(0, 10),
    verdictsHash: hashVerdicts(entries),
  }
}

/**
 * False once any verdict has changed since the developer approved: the page is a draft again.
 * @param {VerdictsFile} verdictsFile
 */
export function isApprovalStillValid(verdictsFile) {
  return (
    verdictsFile.approval?.verdictsHash === hashVerdicts(verdictsFile.verdicts)
  )
}
