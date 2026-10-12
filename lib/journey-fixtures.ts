import type { FormSchemaType } from "./schema";
import { multiTypes, singleTypes } from "./engine";
import { evaluateJourneyCase, type JourneyCase } from "./journey-testing";
import { z } from "zod";
import { hasSafeJourneyKeys, MAX_JOURNEY_FIXTURES, journeyFixtureLibrarySchema, journeyIdentifierSchema, manualJourneyFixtureSchema, validateManualJourneyInput, type JourneyExpectation, type JourneyFixture } from "./journey-fixture-codec";
export { MAX_JOURNEY_FIXTURES, validateJourneyFixtureLibrary, isManualJourneyFixture } from "./journey-fixture-codec";
export type { JourneyExpectation, JourneyFixture, TypedJourneyAnswer, ManualJourneyInput } from "./journey-fixture-codec";

export interface JourneyFixtureResult {
  fixtureId: string;
  passed: boolean;
  draftChanged: boolean;
  actual: JourneyCase;
  differences: string[];
}

/** A compact change detector, not a security hash or a published version identifier. */
export function journeyDraftFingerprint(form: FormSchemaType): string {
  const serialized = JSON.stringify(form);
  let a = 2166136261, b = 5381;
  for (let i = 0; i < serialized.length; i++) {
    const code = serialized.charCodeAt(i);
    a = Math.imul(a ^ code, 16777619);
    b = Math.imul(b, 33) ^ code;
  }
  return `${serialized.length}:${a >>> 0}:${b >>> 0}`;
}
export const journeyFixtureStorageKey = (quizId: string) => `pippi:journey-regressions:v1:${quizId}`;
export const expectationFor = (item: JourneyCase): JourneyExpectation => ({ status: item.status, resultId: item.resultId ?? null, score: item.score ?? null, questionIds: [...item.questionIds], categories: structuredClone(item.categories || []), resultSectionIds: [...(item.resultSectionIds || [])] });
export const hasExpandedJourneyChecks = (expected: JourneyExpectation) => expected.categories !== undefined && expected.resultSectionIds !== undefined;
export interface JourneyFixtureUpgrade {
  fixtureId: string;
  baseline: string;
  draftFingerprint: string;
  expected: JourneyExpectation;
}
/** Review adds missing assertions; it never replaces an existing expectation. */
export function prepareJourneyFixtureUpgrade(form: FormSchemaType, fixture: JourneyFixture): JourneyFixtureUpgrade {
  if (hasExpandedJourneyChecks(fixture.expected)) throw Error("This case already checks categories and result sections.");
  const result = runJourneyFixture(form, fixture);
  if (!result.passed) throw Error("The existing expectations must pass before adding checks. Resolve the differences first; the saved baseline is unchanged.");
  const full = expectationFor(result.actual);
  return { fixtureId: fixture.id, baseline: JSON.stringify(fixture), draftFingerprint: journeyDraftFingerprint(form), expected: { ...structuredClone(fixture.expected), categories: fixture.expected.categories === undefined ? full.categories : structuredClone(fixture.expected.categories), resultSectionIds: fixture.expected.resultSectionIds === undefined ? full.resultSectionIds : [...fixture.expected.resultSectionIds] } };
}
export function applyJourneyFixtureUpgrade(form: FormSchemaType, fixture: JourneyFixture, review: JourneyFixtureUpgrade): JourneyFixture {
  if (review.fixtureId !== fixture.id || review.baseline !== JSON.stringify(fixture) || review.draftFingerprint !== journeyDraftFingerprint(form)) throw Error("The draft or saved case changed during review. Review the checks again before saving.");
  const current = prepareJourneyFixtureUpgrade(form, fixture);
  if (JSON.stringify(current.expected) !== JSON.stringify(review.expected)) throw Error("The proposed checks changed. Review them again before saving.");
  return { ...fixture, expected: current.expected, draftFingerprint: current.draftFingerprint, revision: form.revision ?? null };
}

export function createJourneyFixture(form: FormSchemaType, item: JourneyCase, name: string, id: string): JourneyFixture {
  if (item.status === "invalid") throw Error("Complete this path manually before saving an expected result.");
  if (!name.trim()) throw Error("Give this regression case a name.");
  for (const [questionId, value] of Object.entries(item.answers)) {
    const question = form.questions.find(q => q.id === questionId);
    if (!question || !(singleTypes.has(question.type) || multiTypes.has(question.type) || ["terms", "checkbox"].includes(question.type))) throw Error("Saved cases support finite choices only. Do not include personal information.");
    if (singleTypes.has(question.type) && !question.options?.some(o => o.id === value)) throw Error("A saved answer no longer exists.");
    if (multiTypes.has(question.type) && (!Array.isArray(value) || value.length > 1000 || value.some(id => !question.options?.some(o => o.id === id)))) throw Error("A saved answer no longer exists.");
  }
  return { id, name: name.trim().slice(0, 100), answers: structuredClone(item.answers), expected: expectationFor(item), createdAt: new Date().toISOString(), draftFingerprint: journeyDraftFingerprint(form), revision: form.revision ?? null };
}

/** Browser-local synthetic cases. Version 2 can contain creator-entered text. */
export function serializeJourneyFixtures(quizId: string, cases: JourneyFixture[]): string {
  if (cases.length > MAX_JOURNEY_FIXTURES) throw Error(`Save up to ${MAX_JOURNEY_FIXTURES} regression cases per quiz.`);
  const version = cases.some(item => item.inputVersion === 2) ? 2 : 1;
  if (version === 2) {
    if (!journeyFixtureLibrarySchema.safeParse(cases).success || !journeyIdentifierSchema.safeParse(quizId).success) throw Error("The current library is invalid for a mixed manual-case library. Existing data is unchanged.");
  } else if (cases.some(hasManualKeys)) throw Error("Manual input keys require a version-2 case.");
  const serialized = JSON.stringify({ version, quizId, cases });
  if (serialized.length > 500_000) throw Error("These saved cases exceed this browser’s regression storage limit. Remove a case before adding another.");
  return serialized;
}
const hasManualKeys = (value: unknown) => value !== null && typeof value === "object" && (Object.hasOwn(value, "inputVersion") || Object.hasOwn(value, "typedAnswers"));
const versionTwoLibrary = z.object({ version: z.literal(2), quizId: journeyIdentifierSchema, cases: journeyFixtureLibrarySchema }).strict().refine(value => value.cases.some(item => "inputVersion" in item && item.inputVersion === 2), "Version 2 requires a manual case.");

export function parseJourneyFixtures(raw: string | null, quizId: string): JourneyFixture[] {
  if (!raw) return [];
  if (raw.length > 500_000) throw Error("Saved journey cases are too large to load.");
  const data = JSON.parse(raw);
  if (data?.version === 2) {
    if (data.quizId !== quizId || !hasSafeJourneyKeys(data) || !versionTwoLibrary.safeParse(data).success) throw Error("Saved manual journey cases have an invalid or unsupported format.");
    return data.cases as JourneyFixture[];
  }
  // Preserve the permissive historical reader, except reserved manual markers.
  if (hasManualKeys(data) || Array.isArray(data?.cases) && data.cases.some(hasManualKeys)) throw Error("Manual input keys require a version-2 library.");
  if (data?.version !== 1 || data.quizId !== quizId || !Array.isArray(data.cases) || data.cases.length > MAX_JOURNEY_FIXTURES) throw Error("Saved journey cases have an unsupported format.");
  const id = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
  const string = (value: unknown, max: number) => typeof value === "string" && value.length <= max;
  const ids = new Set<string>();
  for (const item of data.cases) {
    const expected = item?.expected;
    if (!id(item?.id) || ids.has(item.id) || !string(item.name, 100) || !item.name.trim() || !string(item.createdAt, 40) || !string(item.draftFingerprint, 100) || !(item.revision === null || Number.isSafeInteger(item.revision) && item.revision >= 0)) throw Error("A saved journey case is invalid.");
    ids.add(item.id);
    if (!item.answers || typeof item.answers !== "object" || Array.isArray(item.answers) || Object.keys(item.answers).length > 200) throw Error("A saved journey case has invalid answers.");
    for (const [key, value] of Object.entries(item.answers)) {
      if (!id(key) || !(typeof value === "boolean" || id(value) || Array.isArray(value) && value.length <= 1000 && value.every(id))) throw Error("A saved journey case has invalid answers.");
    }
    if (!expected || !["matched", "scored", "no_match", "completed"].includes(expected.status) || !(expected.resultId === null || id(expected.resultId)) || !(expected.score === null || typeof expected.score === "number" && Number.isFinite(expected.score) && expected.score >= 0 && expected.score <= 100) || !Array.isArray(expected.questionIds) || expected.questionIds.length > 200 || !expected.questionIds.every(id)) throw Error("A saved journey case has invalid expectations.");
    const uniqueIds = (values: unknown[], maximum: number) => values.length <= maximum && values.every(id) && new Set(values).size === values.length;
    if (expected.categories !== undefined) {
      if (!Array.isArray(expected.categories) || expected.categories.length > 20) throw Error("A saved journey case has invalid category expectations.");
      const categoryIds = new Set<string>();
      for (const category of expected.categories) {
        const boundedCount = (value: unknown, minimum = 0) => typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= 200;
        if (!category || !id(category.id) || categoryIds.has(category.id) || !(category.score === null || typeof category.score === "number" && Number.isFinite(category.score) && category.score >= 0 && category.score <= 100) || !boundedCount(category.answered) || !boundedCount(category.applicable) || category.answered > category.applicable || !boundedCount(category.minAnswers, 1)) throw Error("A saved journey case has invalid category expectations.");
        categoryIds.add(category.id);
      }
    }
    if (expected.resultSectionIds !== undefined && (!Array.isArray(expected.resultSectionIds) || !uniqueIds(expected.resultSectionIds, 12))) throw Error("A saved journey case has invalid section expectations.");
  }
  return data.cases as JourneyFixture[];
}

export function runJourneyFixture(form: FormSchemaType, fixture: JourneyFixture): JourneyFixtureResult {
  let actual: JourneyCase;
  if (fixture.inputVersion === 2 || hasManualKeys(fixture)) {
    try {
      if (!manualJourneyFixtureSchema.safeParse(fixture).success) throw Error("This saved manual case has invalid input metadata.");
      const input = validateManualJourneyInput(form, { answers: fixture.answers, typedAnswers: fixture.typedAnswers });
      actual = evaluateJourneyCase(form, input.mergedAnswers);
    } catch (error) {
      actual = { id: "explicit", answers: {}, questionIds: [], resultTitle: "Review saved manual inputs", status: "invalid", error: error instanceof Error ? error.message : "This saved manual case could not be evaluated." };
    }
  } else actual = evaluateJourneyCase(form, fixture.answers);
  const differences: string[] = [];
  for (const questionId of new Set([...Object.keys(fixture.answers), ...Object.keys(fixture.typedAnswers || {})])) {
    if (!form.questions.some(q => q.id === questionId)) differences.push(`Saved question “${questionId}” no longer exists.`);
  }
  if (actual.status !== fixture.expected.status) differences.push(`Status: expected ${fixture.expected.status.replaceAll("_", " ")}, received ${actual.status.replaceAll("_", " ")}.`);
  if ((actual.resultId ?? null) !== fixture.expected.resultId) differences.push(`Result: expected ${fixture.expected.resultId || "no named result"}, received ${actual.resultId || "no named result"}.`);
  if ((actual.score ?? null) !== fixture.expected.score) differences.push(`Score: expected ${fixture.expected.score === null ? "no score" : `${fixture.expected.score}%`}, received ${actual.score === undefined ? "no score" : `${actual.score}%`}.`);
  if (JSON.stringify(actual.questionIds) !== JSON.stringify(fixture.expected.questionIds)) differences.push(`The visible questions or their order changed: expected ${fixture.expected.questionIds.join(" → ") || "none"}, received ${actual.questionIds.join(" → ") || "none"}.`);
  if (fixture.expected.categories !== undefined) {
    const actualCategories = new Map((actual.categories || []).map(category => [category.id, category]));
    const expectedIds = new Set(fixture.expected.categories.map(category => category.id));
    const scoreText = (value: number | null) => value === null ? "not enough information" : `${value}%`;
    for (const expected of fixture.expected.categories) {
      const received = actualCategories.get(expected.id);
      if (!received) { differences.push(`Category “${expected.id}” is missing from the result.`); continue; }
      if (expected.score !== received.score) differences.push(`Category “${expected.id}” score: expected ${scoreText(expected.score)}, received ${scoreText(received.score)}.`);
      for (const [key, label] of [["answered", "scored answers"], ["applicable", "applicable questions"], ["minAnswers", "minimum answers needed"]] as const) {
        if (expected[key] !== received[key]) differences.push(`Category “${expected.id}” ${label}: expected ${expected[key]}, received ${received[key]}.`);
      }
    }
    for (const received of actual.categories || []) if (!expectedIds.has(received.id)) differences.push(`Category “${received.id}” was added to the result (score: ${scoreText(received.score)}).`);
  }
  if (fixture.expected.resultSectionIds !== undefined && JSON.stringify(fixture.expected.resultSectionIds) !== JSON.stringify(actual.resultSectionIds || [])) {
    differences.push(`Result sections in order: expected ${fixture.expected.resultSectionIds.join(" → ") || "none"}, received ${(actual.resultSectionIds || []).join(" → ") || "none"}.`);
  }
  if (actual.error) differences.push(actual.error);
  return { fixtureId: fixture.id, passed: !differences.length, draftChanged: fixture.draftFingerprint !== journeyDraftFingerprint(form), actual, differences };
}
