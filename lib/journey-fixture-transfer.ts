import { z } from "zod";
import type { FormSchemaType } from "./schema";
import { journeyDraftFingerprint, serializeJourneyFixtures, type JourneyFixture } from "./journey-fixtures";
import { hasSafeJourneyKeys, MAX_JOURNEY_FIXTURES, journeyIdentifierSchema, legacyJourneyFixtureSchema, journeyFixtureLibrarySchema, canonicalJourneyValue } from "./journey-fixture-codec";

export const MAX_JOURNEY_TRANSFER_BYTES = 128 * 1024;
const documentSchema = z.union([
  z.object({ format: z.literal("pippi-journey-cases"), version: z.literal(1), quizId: journeyIdentifierSchema, cases: z.array(legacyJourneyFixtureSchema).max(MAX_JOURNEY_FIXTURES) }).strict(),
  z.object({ format: z.literal("pippi-journey-cases"), version: z.literal(2), quizId: journeyIdentifierSchema, cases: journeyFixtureLibrarySchema }).strict().refine(value => value.cases.some(item => "inputVersion" in item && item.inputVersion === 2), "Version 2 requires a manual case."),
]);
const canonical = canonicalJourneyValue;
const versionFor = (cases: JourneyFixture[]) => cases.some(item => item.inputVersion === 2) ? 2 : 1;

function bounded(text: string) {
  if (new TextEncoder().encode(text).byteLength > MAX_JOURNEY_TRANSFER_BYTES) throw Error("This file exceeds the 128 KiB transfer limit. Keep the existing library and use a smaller case file.");
}
function parse(text: string, quizId: string): JourneyFixture[] {
  bounded(text);
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw Error("Choose a valid JSON case file."); }
  if (!hasSafeJourneyKeys(value)) throw Error("Invalid case file: reserved keys or invalid nested data.");
  const parsed = documentSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw Error(`Invalid case file${issue.path.length ? ` at ${issue.path.join(".")}` : ""}: ${issue.message}`);
  }
  if (parsed.data.quizId !== quizId) throw Error("This file belongs to another quiz. Import it only into the original quiz.");
  const seen = new Set<string>();
  for (const item of parsed.data.cases) { if (seen.has(item.id)) throw Error("The file contains duplicate case IDs. Each case must appear once."); seen.add(item.id); }
  return parsed.data.cases;
}

export function decodeJourneyFixtureFile(bytes: Uint8Array): string {
  if (bytes.byteLength > MAX_JOURNEY_TRANSFER_BYTES) throw Error("Choose a JSON file no larger than 128 KiB.");
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw Error("The case file must contain valid UTF-8 text."); }
}
/** Exports saved synthetic cases, including manual text; no respondent storage is read. */
export function exportJourneyFixtures(quizId: string, cases: JourneyFixture[]): string {
  const text = JSON.stringify({ format: "pippi-journey-cases", version: versionFor(cases), quizId, cases }, null, 2);
  parse(text, quizId);
  return text;
}
export interface JourneyImportReview {
  quizId: string; draftFingerprint: string; libraryBaseline: string; fileBaseline: string;
  cases: JourneyFixture[]; additions: JourneyFixture[]; duplicates: string[];
}
export function prepareJourneyFixtureImport(form: FormSchemaType, text: string, current: JourneyFixture[]): JourneyImportReview {
  const cases = parse(text, form.id), additions: JourneyFixture[] = [], duplicates: string[] = [];
  // Check stored cases without applying the smaller transfer-file byte limit.
  // The older local parser is permissive; appending must not rewrite malformed
  // or unknown fields that export would reject. No repair or stripping occurs.
  const stored = journeyFixtureLibrarySchema.safeParse(current);
  if (!stored.success) {
    const issue = stored.error.issues[0];
    throw Error(`The current library is invalid${issue.path.length ? ` at cases.${issue.path.join(".")}` : ""}: ${issue.message} Keep it unchanged and review its saved cases first.`);
  }
  if (new Set(current.map(item => item.id)).size !== current.length) throw Error("The current library is invalid. Keep it unchanged and review its saved cases first.");
  const existing = new Map(current.map(item => [item.id, item]));
  for (const item of cases) {
    const saved = existing.get(item.id);
    if (!saved) additions.push(item);
    else if (canonical(saved) === canonical(item)) duplicates.push(item.id);
    else throw Error(`Case “${item.name}” has the same ID as a different saved case. Nothing was imported.`);
  }
  if (current.length + additions.length > MAX_JOURNEY_FIXTURES) throw Error(`Import would exceed ${MAX_JOURNEY_FIXTURES} saved cases. Nothing was imported.`);
  serializeJourneyFixtures(form.id, [...current, ...additions]);
  return { quizId: form.id, draftFingerprint: journeyDraftFingerprint(form), libraryBaseline: canonical(current), fileBaseline: canonical(cases), cases, additions, duplicates };
}
/** Recheck against current inputs at confirmation. Expectations are never scored or refreshed. */
export function applyJourneyFixtureImport(form: FormSchemaType, current: JourneyFixture[], review: JourneyImportReview): JourneyFixture[] {
  if (review.quizId !== form.id || review.draftFingerprint !== journeyDraftFingerprint(form) || review.libraryBaseline !== canonical(current)) throw Error("The draft or saved library changed during review. Cancel and review the file again.");
  if (review.fileBaseline !== canonical(review.cases)) throw Error("The import review changed. Cancel and review the file again.");
  // Revalidation must not reject an accepted compact file because export's
  // human-readable whitespace would be larger than the original byte budget.
  const checked = prepareJourneyFixtureImport(form, JSON.stringify({ format: "pippi-journey-cases", version: versionFor(review.cases), quizId: form.id, cases: review.cases }), current);
  if (canonical(checked) !== canonical(review)) throw Error("The import review changed. Cancel and review the file again.");
  return [...current, ...checked.additions];
}
