import { z } from "zod";
import type { FormSchemaType } from "./schema";
import { displayTypes, multiTypes, singleTypes, type Answers } from "./engine";
import type { JourneyCase, JourneyCategoryResult } from "./journey-testing";

export const MAX_JOURNEY_FIXTURES = 25;
export interface JourneyExpectation {
  status: JourneyCase["status"]; resultId: string | null; score: number | null; questionIds: string[];
  categories?: JourneyCategoryResult[]; resultSectionIds?: string[];
}
export interface TypedJourneyAnswer { type: "number" | "short_answer"; value: string }
export interface ManualJourneyInput {
  answers: Record<string, string | string[] | boolean>;
  typedAnswers: Record<string, TypedJourneyAnswer>;
}
interface FixtureBase {
  id: string; name: string; answers: Answers; expected: JourneyExpectation;
  createdAt: string; draftFingerprint: string; revision: number | null;
}
export type JourneyFixture = FixtureBase & (
  | { inputVersion?: never; typedAnswers?: never }
  | { inputVersion: 2; typedAnswers: Record<string, TypedJourneyAnswer> }
);

/** Check raw keys before Zod can discard special object properties. */
export function hasSafeJourneyKeys(value: unknown): boolean {
  let visited = 0;
  const active = new Set<object>();
  const walk = (item: unknown, depth: number): boolean => {
    if (++visited > 600_000 || depth > 40) return false;
    if (!item || typeof item !== "object") return true;
    if (active.has(item)) return false;
    active.add(item);
    for (const key of Object.keys(item)) {
      if (["__proto__", "prototype", "constructor"].includes(key) || !walk((item as Record<string, unknown>)[key], depth + 1)) return false;
    }
    active.delete(item);
    return true;
  };
  return walk(value, 0);
}
const safeKeys = <T extends z.ZodType>(schema: T) => z.unknown().superRefine((value, ctx) => {
  if (!hasSafeJourneyKeys(value)) ctx.addIssue({ code: "custom", message: "Reserved keys or invalid nested data are not supported." });
}).pipe(schema);

export const journeyIdentifierSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).refine(value => !["__proto__", "prototype", "constructor"].includes(value), "Reserved identifiers cannot be used.");
const ids = (max: number) => z.array(journeyIdentifierSchema).max(max).refine(values => new Set(values).size === values.length, "Identifiers must be unique.");
const score = z.number().finite().min(0).max(100).nullable();
const count = z.number().int().min(0).max(200);
const category = z.object({ id: journeyIdentifierSchema, score, answered: count, applicable: count, minAnswers: count.min(1) }).strict().refine(value => value.answered <= value.applicable, "Answered count exceeds applicable questions.");
const expectation = z.object({
  status: z.enum(["matched", "scored", "no_match", "completed"]), resultId: journeyIdentifierSchema.nullable(), score,
  questionIds: ids(200), categories: z.array(category).max(20).refine(values => new Set(values.map(value => value.id)).size === values.length, "Category identifiers must be unique.").optional(),
  resultSectionIds: ids(12).optional(),
}).strict();
const answerRecord = z.record(journeyIdentifierSchema, z.union([z.boolean(), journeyIdentifierSchema, ids(1000)])).refine(value => Object.keys(value).length <= 200, "Too many answer fields.");
const base = {
  id: journeyIdentifierSchema,
  name: z.string().min(1).max(100).refine(value => !!value.trim() && !/[\u0000-\u001f\u007f]/.test(value), "Use a plain case name."),
  answers: answerRecord, expected: expectation,
  createdAt: z.string().max(40).refine(value => { try { return new Date(value).toISOString() === value; } catch { return false; } }, "Use a valid ISO creation timestamp."),
  draftFingerprint: z.string().regex(/^\d+:\d+:\d+$/).max(100), revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
};
export const legacyJourneyFixtureSchema = safeKeys(z.object(base).strict());
// Number fields emit strings. Keeping the lexeme matters for exact equality and quiz keys.
const numberLexeme = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const unsafeText = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\u2028\u2029]/u;
function validUnicode(value: string) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) { const next = value.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) return false; }
    else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}
function validTypedValue(entry: TypedJourneyAnswer, allowBlank: boolean) {
  if (entry.value.length > (entry.type === "number" ? 64 : 256) || unsafeText.test(entry.value) || !validUnicode(entry.value)) return false;
  if (!entry.value.trim()) return allowBlank;
  return entry.type === "short_answer" || numberLexeme.test(entry.value) && Number.isFinite(Number(entry.value));
}
const typedEntry = z.object({ type: z.enum(["number", "short_answer"]), value: z.string() }).strict();
const typedRecord = z.record(journeyIdentifierSchema, typedEntry.refine(value => validTypedValue(value, false), "Use a supported bounded synthetic value."));
export const manualJourneyFixtureSchema = safeKeys(z.object({ ...base, inputVersion: z.literal(2), typedAnswers: typedRecord }).strict().superRefine((value, ctx) => {
  const typedKeys = Object.keys(value.typedAnswers), keys = Object.keys(value.answers);
  if (value.expected.categories === undefined || value.expected.resultSectionIds === undefined) ctx.addIssue({ code: "custom", message: "Manual cases require full category and result-section expectations." });
  if (!typedKeys.length || typedKeys.length + keys.length > 200 || typedKeys.some(key => Object.hasOwn(value.answers, key))) ctx.addIssue({ code: "custom", message: "Manual answers must be nonempty, disjoint and bounded to 200 fields." });
}));
export const journeyFixtureSchema = z.union([legacyJourneyFixtureSchema, manualJourneyFixtureSchema]);
export const journeyFixtureLibrarySchema = safeKeys(z.array(journeyFixtureSchema).max(MAX_JOURNEY_FIXTURES).refine(cases => new Set(cases.map(item => item.id)).size === cases.length, "Case identifiers must be unique."));
export const canonicalJourneyValue = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export const isManualJourneyFixture = (value: JourneyFixture): value is JourneyFixture & { inputVersion: 2; typedAnswers: Record<string, TypedJourneyAnswer> } => value.inputVersion === 2;
export function validateJourneyFixtureLibrary(cases: unknown): asserts cases is JourneyFixture[] {
  if (!journeyFixtureLibrarySchema.safeParse(cases).success) throw Error("The current library is invalid for this operation. Its existing data is unchanged; review its saved cases first.");
}
export function manualJourneyQuestionKind(type: string): "single" | "multi" | "boolean" | "number" | "short_answer" | "display" | "unsupported" {
  if (singleTypes.has(type)) return "single";
  if (multiTypes.has(type)) return "multi";
  if (type === "terms" || type === "checkbox") return "boolean";
  if (type === "number" || type === "short_answer") return type;
  return displayTypes.has(type) ? "display" : "unsupported";
}
const inputSchema = safeKeys(z.object({
  answers: z.record(journeyIdentifierSchema, z.union([z.boolean(), journeyIdentifierSchema.or(z.literal("")), ids(1000)])),
  typedAnswers: z.record(journeyIdentifierSchema, typedEntry.refine(value => validTypedValue(value, true), "Use a supported bounded synthetic value.")),
}).strict().refine(value => Object.keys(value.answers).length + Object.keys(value.typedAnswers).length <= 200 && !Object.keys(value.answers).some(key => Object.hasOwn(value.typedAnswers, key)), "Answers must be disjoint and bounded to 200 fields."));

/** Validate both maps before routing, even supplied values on a skipped question. */
export function validateManualJourneyInput(form: FormSchemaType, input: unknown): { input: ManualJourneyInput; answers: ManualJourneyInput["answers"]; typedAnswers: ManualJourneyInput["typedAnswers"]; mergedAnswers: Answers } {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0], id = issue.path[1];
    const field = typeof id === "string" && journeyIdentifierSchema.safeParse(id).success ? ` “${id}”` : "";
    throw Error(`Manual input${field} is invalid. Use supported choices, a finite numeric string up to 64 characters, or short text up to 256 characters; no duplicate selections or control characters.`);
  }
  const value = parsed.data, answers: ManualJourneyInput["answers"] = {}, typedAnswers: ManualJourneyInput["typedAnswers"] = {};
  const question = (id: string) => {
    const matches = form.questions.filter(item => item.id === id);
    if (matches.length !== 1) throw Error(`Saved input “${id}” needs one existing question.`);
    return matches[0];
  };
  for (const [id, answer] of Object.entries(value.answers)) {
    const q = question(id), kind = manualJourneyQuestionKind(q.type);
    if (kind === "single") {
      if (typeof answer !== "string" || answer !== "" && q.options?.filter(option => option.id === answer).length !== 1) throw Error(`Saved input “${id}” needs an available single-choice answer.`);
    } else if (kind === "multi") {
      if (!Array.isArray(answer) || answer.some(selected => q.options?.filter(option => option.id === selected).length !== 1)) throw Error(`Saved input “${id}” needs available multiple-choice answers.`);
    } else if (kind !== "boolean" || typeof answer !== "boolean") throw Error(`Saved input “${id}” no longer has a supported finite-choice type.`);
    if (answer !== "" && !(Array.isArray(answer) && answer.length === 0)) answers[id] = structuredClone(answer);
  }
  for (const [id, answer] of Object.entries(value.typedAnswers)) {
    if (question(id).type !== answer.type) throw Error(`Saved input “${id}” no longer has its recorded ${answer.type} type.`);
    if (answer.value.trim()) typedAnswers[id] = { ...answer };
  }
  return { input: value, answers, typedAnswers, mergedAnswers: { ...answers, ...Object.fromEntries(Object.entries(typedAnswers).map(([id, entry]) => [id, entry.value])) } };
}
