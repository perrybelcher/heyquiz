import { z } from "zod";
import { analyticsQuery, parseAnalyticsQuery } from "./analytics-filters";

export const EXPERIMENT_EVIDENCE_HEADER = "X-Pippi-Experiment-Evidence";
export const EXPERIMENT_EVIDENCE_LIFETIME = 15 * 60 * 1000;
export const EXPERIMENT_EVIDENCE_PROOF_LIMIT = 8192;
export const EXPERIMENT_EVIDENCE_REQUEST_LIMIT = 4096;
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).refine(value => !["__proto__", "constructor", "prototype"].includes(value));
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const text = (limit: number) => z.string().max(limit).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value));
const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/).refine(value => { try { return new Date(value).toISOString() === value; } catch { return false; } });
const filters = z.object({ source: z.string().max(320), campaign: z.string().max(320), version: z.string().max(320) }).strict();
const cohort = z.object({ range: z.enum(["7", "30", "90", "all"]), filters }).strict().superRefine((value, ctx) => {
  try { parseAnalyticsQuery(new URLSearchParams(analyticsQuery(value.range, value.filters))); }
  catch { ctx.addIssue({ code: "custom", message: "Choose supported analytics filters." }); }
});
export const ExperimentEvidenceSelectorSchema = z.object({ questionId: id, wordingKey: hash, range: z.enum(["7", "30", "90", "all"]), filters }).strict().superRefine((value, ctx) => {
  if (!cohort.safeParse({ range: value.range, filters: value.filters }).success) ctx.addIssue({ code: "custom", message: "Choose supported analytics filters." });
});
export type ExperimentEvidenceSelector = z.infer<typeof ExperimentEvidenceSelectorSchema>;
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
/** Only display-safe aggregate metadata enters the saved experiment. No proof or row identifiers. */
export const ExperimentEvidenceSchema = z.object({
  version: z.literal(1), formId: id, quizTitle: text(300), questionId: id, questionTitle: text(1000), questionType: id, wordingKey: hash,
  sourceSnapshot: hash, publishedAt: iso, requested: cohort, cohort,
  observedAt: iso, cutoffAt: iso.nullable(), quietThresholdMinutes: z.literal(30), publicationNarrowed: z.boolean(),
  counts: z.object({ reached: count, measured: count, quiet: count, completed: count }).strict(),
}).strict().superRefine((value, ctx) => {
  const { reached, measured, quiet, completed } = value.counts;
  if (quiet < 1 || quiet > measured || measured > reached || completed > reached || quiet + completed > reached) ctx.addIssue({ code: "custom", message: "Invalid evidence counts." });
  if (value.cohort.range !== value.requested.range || value.cohort.filters.source !== value.requested.filters.source || value.cohort.filters.campaign !== value.requested.filters.campaign || value.cohort.filters.version !== `published:${value.publishedAt}` || value.requested.filters.version && value.requested.filters.version !== value.cohort.filters.version) ctx.addIssue({ code: "custom", message: "Invalid evidence cohort." });
  if (value.publicationNarrowed !== !value.requested.filters.version) ctx.addIssue({ code: "custom", message: "Invalid evidence publication scope." });
  if (!Number.isFinite(Date.parse(value.observedAt)) || !Number.isFinite(Date.parse(value.publishedAt))) return;
  const expectedCutoff = value.cohort.range === "all" ? null : new Date(Date.parse(value.observedAt.slice(0, 10)) - (Number(value.cohort.range) - 1) * 86400000).toISOString();
  if (value.cutoffAt !== expectedCutoff || Date.parse(value.publishedAt) > Date.parse(value.observedAt)) ctx.addIssue({ code: "custom", message: "Invalid evidence observation window." });
});
export type ExperimentEvidence = z.infer<typeof ExperimentEvidenceSchema>;
export const ExperimentEvidenceResponseSchema = z.object({ evidence: ExperimentEvidenceSchema }).strict();
export type ExperimentEvidenceHandoff = { formId: string; selector: ExperimentEvidenceSelector };
export function parseExperimentEvidenceSelector(value: unknown): ExperimentEvidenceSelector {
  const result = ExperimentEvidenceSelectorSchema.safeParse(value);
  if (!result.success) throw Error("Choose one measured question and supported analytics filters.");
  return result.data;
}
export function parseExperimentEvidence(value: unknown): ExperimentEvidence {
  const result = ExperimentEvidenceSchema.safeParse(value);
  if (!result.success) throw Error("This evidence could not be verified for display. Refresh it before reviewing the test.");
  return result.data;
}
export function parseExperimentEvidenceResponse(value: unknown): { evidence: ExperimentEvidence } {
  const result = ExperimentEvidenceResponseSchema.safeParse(value);
  if (!result.success) throw Error("This evidence could not be verified for display. Refresh it before reviewing the test.");
  return result.data;
}
export function experimentEvidenceHref(formId: string, selector: ExperimentEvidenceSelector): string {
  if (!id.safeParse(formId).success) throw Error("Choose a valid source quiz.");
  const checked = parseExperimentEvidenceSelector(selector), params = new URLSearchParams(analyticsQuery(checked.range, checked.filters));
  params.set("evidenceForm", formId); params.set("evidenceQuestion", checked.questionId); params.set("evidenceWording", checked.wordingKey);
  return `/experiments?${params.toString()}`;
}
/** Selectors only. Reject duplicates/unknown keys; never read counts or proofs from a URL. */
export function parseExperimentEvidenceHandoff(params: URLSearchParams): ExperimentEvidenceHandoff | null {
  if (![...params.keys()].length) return null;
  const allowed = ["evidenceForm", "evidenceQuestion", "evidenceWording", "range", "source", "campaign", "version"];
  for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1) throw Error("This experiment evidence link is invalid. Return to Results or set up a test manually.");
  const formId = params.get("evidenceForm");
  if (!id.safeParse(formId).success) throw Error("This experiment evidence link needs a source quiz.");
  const analytics = new URLSearchParams();
  for (const key of ["range", "source", "campaign", "version"]) if (params.has(key)) analytics.set(key, params.get(key)!);
  const selected = parseAnalyticsQuery(analytics);
  return { formId: formId!, selector: parseExperimentEvidenceSelector({ questionId: params.get("evidenceQuestion"), wordingKey: params.get("evidenceWording"), ...selected }) };
}
