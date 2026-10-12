import type { FormSchemaType } from "./schema";
import { evaluateJourneyCase, type JourneyCase } from "./journey-testing";
import { expectationFor, journeyDraftFingerprint, parseJourneyFixtures, serializeJourneyFixtures } from "./journey-fixtures";
import {
  MAX_JOURNEY_FIXTURES, canonicalJourneyValue, journeyFixtureLibrarySchema, journeyIdentifierSchema,
  manualJourneyQuestionKind, validateJourneyFixtureLibrary, validateManualJourneyInput,
  type JourneyFixture, type ManualJourneyInput,
} from "./journey-fixture-codec";
export { manualJourneyQuestionKind, validateManualJourneyInput } from "./journey-fixture-codec";
export type { ManualJourneyInput, TypedJourneyAnswer } from "./journey-fixture-codec";

export interface ManualJourneyReview {
  quizId: string;
  draftFingerprint: string;
  /** Exact supplied input/name, including blank fields omitted from the saved path. */
  inputBaseline: string;
  name: string;
  libraryRaw: string | null;
  fixtureBaseline: string;
  fixture: JourneyFixture;
  actual: JourneyCase;
  omittedQuestionIds: string[];
  unsupportedQuestionIds: string[];
}
export interface AppliedManualJourneyCase { cases: JourneyFixture[]; serialized: string; fixture: JourneyFixture }

function prepare(form: FormSchemaType, input: ManualJourneyInput, name: string, id: string, rawLibrary: string | null, createdAt: string): ManualJourneyReview {
  if (typeof name !== "string" || !name.trim() || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) throw Error("Use a plain case name of up to 100 characters.");
  if (!journeyIdentifierSchema.safeParse(id).success) throw Error("Use a valid new case identifier.");
  if (!(rawLibrary === null || typeof rawLibrary === "string")) throw Error("The saved library could not be read. No case was saved.");
  const library = parseJourneyFixtures(rawLibrary, form.id);
  validateJourneyFixtureLibrary(library);
  if (library.length >= MAX_JOURNEY_FIXTURES) throw Error("Save up to 25 regression cases per quiz.");
  if (library.some(fixture => fixture.id === id)) throw Error("This case identifier already exists. Start a new review; existing cases are unchanged.");
  const checked = validateManualJourneyInput(form, input), inputBaseline = JSON.stringify(input);
  if (inputBaseline.length > 500_000) throw Error("These manual inputs exceed the local case size limit.");
  const actual = evaluateJourneyCase(form, checked.mergedAnswers);
  if (actual.status === "invalid") throw Error(actual.error || "Complete the required inputs before reviewing a manual case.");
  // Keep only answers the actual resolved path used; volatile inputs remain in
  // the caller's composer and are included in the stale-review comparison.
  const answers = Object.fromEntries(Object.entries(checked.answers).filter(([questionId]) => Object.hasOwn(actual.answers, questionId)));
  const typedAnswers = Object.fromEntries(Object.entries(checked.typedAnswers).filter(([questionId]) => Object.hasOwn(actual.answers, questionId)));
  const base = {
    id, name: name.trim(), answers, expected: expectationFor(actual), createdAt,
    draftFingerprint: journeyDraftFingerprint(form), revision: form.revision ?? null,
  };
  const fixture: JourneyFixture = Object.keys(typedAnswers).length ? { ...base, inputVersion: 2, typedAnswers } : base;
  if (!journeyFixtureLibrarySchema.safeParse([...library, fixture]).success) throw Error("This manual case cannot be saved in the bounded case format.");
  serializeJourneyFixtures(form.id, [...library, fixture]);
  const kept = new Set(Object.keys(actual.answers));
  return {
    quizId: form.id, draftFingerprint: fixture.draftFingerprint, inputBaseline, name, libraryRaw: rawLibrary,
    fixtureBaseline: canonicalJourneyValue(fixture), fixture, actual,
    omittedQuestionIds: [...Object.keys(input.answers), ...Object.keys(input.typedAnswers)].filter(questionId => !kept.has(questionId)),
    unsupportedQuestionIds: actual.questionIds.filter(questionId => {
      const q = form.questions.find(question => question.id === questionId);
      return q && (manualJourneyQuestionKind(q.type) === "unsupported" || q.type === "hidden");
    }),
  };
}

/** No storage/network operations. The UI must acknowledge synthetic-only use. */
export function prepareManualJourneyCase(form: FormSchemaType, input: ManualJourneyInput, name: string, id: string, rawLibrary: string | null): ManualJourneyReview {
  return prepare(form, input, name, id, rawLibrary, new Date().toISOString());
}

/** Recompute instead of trusting a caller-supplied result or expectation. */
export function applyManualJourneyCase(form: FormSchemaType, input: ManualJourneyInput, name: string, currentRaw: string | null, review: ManualJourneyReview): AppliedManualJourneyCase {
  if (!review || review.quizId !== form.id || review.draftFingerprint !== journeyDraftFingerprint(form) || review.libraryRaw !== currentRaw || review.name !== name) throw Error("The draft, name or saved library changed during review. Review this case again.");
  validateManualJourneyInput(form, input);
  if (review.inputBaseline !== JSON.stringify(input)) throw Error("The manual answers changed during review. Review this case again.");
  if (review.fixtureBaseline !== canonicalJourneyValue(review.fixture)) throw Error("The proposed manual case changed during review. Review it again before saving.");
  const checked = prepare(form, input, name, review.fixture?.id, currentRaw, review.fixture?.createdAt);
  if (canonicalJourneyValue(checked) !== canonicalJourneyValue(review)) throw Error("The proposed manual case changed during review. Review it again before saving.");
  const cases = [...parseJourneyFixtures(currentRaw, form.id), checked.fixture];
  return { cases, serialized: serializeJourneyFixtures(form.id, cases), fixture: checked.fixture };
}
