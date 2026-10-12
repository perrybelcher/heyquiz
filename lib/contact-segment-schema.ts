import { z } from "zod";
import { contactFilterError, emptyContactFilters, type ContactFilters } from "./contact-filters";
import { answerOptionId, answerVersionId } from "./contact-answer-cohort";
import { parseAnalyticsQuery } from "./analytics-filters";

// Client-safe definitions only: no record/auth imports or participant data.
export const CONTACT_SEGMENT_LIMIT = 20;
export const CONTACT_SEGMENT_NAME_LIMIT = 80;
export const CONTACT_SEGMENT_REQUEST_BYTES = 16 * 1024;
export const CONTACT_SEGMENT_SET_BYTES = 128 * 1024;
export type ContactSegmentFilters = Omit<ContactFilters, "query">;
export type ContactSegment = { id: string; name: string; createdAt: string; updatedAt: string; filters: ContactSegmentFilters };
export type ContactSegmentResponse = { schemaVersion: 1; revision: number; segments: ContactSegment[] };
export type ContactSegmentCreate = { revision: number; name: string; filters: ContactSegmentFilters };
export type ContactSegmentPatch = { revision: number; id: string; operation: "rename"; name: string } | { revision: number; id: string; operation: "replace"; filters: ContactSegmentFilters };
export type ContactSegmentDelete = { revision: number; id: string };
export type StoredContactSegmentSet = { schemaVersion: 1; formId: string; segments: ContactSegment[] };
export class ContactSegmentValidationError extends Error {}
const invalid = (message: string): never => { throw new ContactSegmentValidationError(message); };
const revision = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const id = z.string().uuid();
const name = z.string().trim().min(1).max(CONTACT_SEGMENT_NAME_LIMIT).refine(value => !/[\u0000-\u001f\u007f]/.test(value));
const stamp = z.string().refine(value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
const percentageString = z.string().max(32);
const filtersSchema = z.object({
  consent: z.enum(["all", "yes", "no"]), from: z.string().max(10), to: z.string().max(10), result: z.string().max(4096),
  score: z.enum(["all", "scored", "unscored"]), minScore: percentageString, maxScore: percentageString,
  source: z.string().max(320), campaign: z.string().max(320), category: z.string().max(4096),
  categoryScore: z.enum(["all", "scored", "unscored", "missing"]), categoryMin: percentageString, categoryMax: percentageString,
  answerVersion: z.string().max(35), answerOption: z.string().max(128),
}).strict();
function exactHistoricalKey(value: string, category: boolean) {
  if (!value) return true;
  try {
    const parts: unknown = JSON.parse(value);
    return Array.isArray(parts) && parts.length === (category ? 2 : 3) && parts.every(part => typeof part === "string") &&
      JSON.stringify(parts) === value && (category || ["knowledge", "scorecard", "segmentation", "product_finder"].includes(parts[0]));
  } catch { return false; }
}
export function parseContactSegmentFilters(value: unknown): ContactSegmentFilters {
  const parsed = filtersSchema.safeParse(value);
  if (!parsed.success) return invalid("Choose supported saved filters. Contact search and extra fields cannot be saved.");
  const filters = parsed.data, current = { query: "", ...filters };
  const error = contactFilterError(current);
  if (error) return invalid(error);
  if (filters.score === "unscored" && (filters.minScore || filters.maxScore)) return invalid("Clear the overall score range when looking for unscored contacts.");
  if (!exactHistoricalKey(filters.result, false) || !exactHistoricalKey(filters.category, true)) return invalid("Choose a valid saved result or category.");
  if (Boolean(filters.answerVersion) !== Boolean(filters.answerOption) || filters.answerVersion && (!answerVersionId(filters.answerVersion) || !answerOptionId(filters.answerOption))) return invalid("Choose a saved question and answer together before saving filters.");
  try { parseAnalyticsQuery(new URLSearchParams({ source: filters.source, campaign: filters.campaign })); }
  catch { return invalid("Choose a valid recorded source and campaign."); }
  if (!Object.keys(filters).some(key => filters[key as keyof ContactSegmentFilters] !== emptyContactFilters[key as keyof ContactSegmentFilters])) return invalid("Choose at least one filter before saving it.");
  return filters;
}
export function contactSegmentFiltersFromCurrent(value: ContactFilters): ContactSegmentFilters {
  if (typeof value.query !== "string" || value.query !== "") return invalid("Clear contact search before saving filters.");
  const { query: _query, ...filters } = value;
  void _query;
  return parseContactSegmentFilters(filters);
}
export function contactFiltersFromSegment(value: ContactSegmentFilters): ContactFilters {
  return { query: "", ...parseContactSegmentFilters(value) };
}
export function contactSegmentNameKey(value: string) { return value.normalize("NFKC").toLowerCase(); }
export function contactSegmentJsonBytes(value: unknown) {
  try { return new TextEncoder().encode(JSON.stringify(value)).length; }
  catch { return Infinity; }
}
function budget(value: unknown, bytes: number, message: string) {
  if (contactSegmentJsonBytes(value) > bytes) invalid(message);
}
const storedName = z.string().min(1).max(CONTACT_SEGMENT_NAME_LIMIT).refine(value => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value));
const segmentSchema = z.object({ id, name: storedName, createdAt: stamp, updatedAt: stamp, filters: z.unknown() }).strict();
function parseSegments(value: unknown): ContactSegment[] {
  const parsed = z.array(segmentSchema).max(CONTACT_SEGMENT_LIMIT).safeParse(value);
  if (!parsed.success) return invalid("The saved filters could not be read. Reload them and try again.");
  const ids = new Set<string>(), names = new Set<string>();
  return parsed.data.map(segment => {
    const key = contactSegmentNameKey(segment.name);
    if (ids.has(segment.id) || names.has(key) || segment.updatedAt < segment.createdAt) return invalid("The saved filters could not be read. Reload them and try again.");
    ids.add(segment.id); names.add(key);
    return { ...segment, filters: parseContactSegmentFilters(segment.filters) };
  });
}
export function parseContactSegmentResponse(value: unknown): ContactSegmentResponse {
  budget(value, CONTACT_SEGMENT_SET_BYTES, "The saved filter set is too large to read.");
  const parsed = z.object({ schemaVersion: z.literal(1), revision, segments: z.unknown() }).strict().safeParse(value);
  if (!parsed.success) return invalid("The saved filters could not be read. Reload them and try again.");
  const segments = parseSegments(parsed.data.segments);
  if (parsed.data.revision === 0 && segments.length) return invalid("The saved filters could not be read. Reload them and try again.");
  return { ...parsed.data, segments };
}
export function parseStoredContactSegments(value: unknown): StoredContactSegmentSet {
  budget(value, CONTACT_SEGMENT_SET_BYTES, "The saved filter set is too large to read.");
  const parsed = z.object({ schemaVersion: z.literal(1), formId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/), segments: z.unknown() }).strict().safeParse(value);
  if (!parsed.success) return invalid("The saved filters could not be read. Reload them and try again.");
  return { ...parsed.data, segments: parseSegments(parsed.data.segments) };
}
export function parseContactSegmentCreate(value: unknown): ContactSegmentCreate {
  budget(value, CONTACT_SEGMENT_REQUEST_BYTES, "The saved filter request is too large.");
  const parsed = z.object({ revision, name, filters: z.unknown() }).strict().safeParse(value);
  if (!parsed.success) return invalid("Enter a name of 1–80 characters and reload the saved filter revision.");
  return { ...parsed.data, filters: parseContactSegmentFilters(parsed.data.filters) };
}
export function parseContactSegmentPatch(value: unknown): ContactSegmentPatch {
  budget(value, CONTACT_SEGMENT_REQUEST_BYTES, "The saved filter request is too large.");
  const parsed = z.discriminatedUnion("operation", [
    z.object({ revision, id, operation: z.literal("rename"), name }).strict(),
    z.object({ revision, id, operation: z.literal("replace"), filters: z.unknown() }).strict(),
  ]).safeParse(value);
  if (!parsed.success) return invalid("Choose a saved filter and a valid rename or update operation.");
  return parsed.data.operation === "replace" ? { ...parsed.data, filters: parseContactSegmentFilters(parsed.data.filters) } : parsed.data;
}
export function parseContactSegmentDelete(value: unknown): ContactSegmentDelete {
  budget(value, CONTACT_SEGMENT_REQUEST_BYTES, "The saved filter request is too large.");
  const parsed = z.object({ revision, id }).strict().safeParse(value);
  if (!parsed.success) return invalid("Choose a saved filter and reload its revision before deleting it.");
  return parsed.data;
}
