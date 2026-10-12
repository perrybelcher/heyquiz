import { z } from "zod";

export const experimentMetricLabels = { completions: "Completion rate", leads: "Captured-contact rate" } as const;
export type ExperimentPrimaryMetric = keyof typeof experimentMetricLabels;
const plainText = z.string().trim().min(1).max(600).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value), "Use ordinary text for your test plan.");
export function validExperimentReviewDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
/** This is a creator's rationale, not a generated prediction or proof of one change. */
export const ExperimentPlanSchema = z.object({
  version: z.literal(1),
  hypothesis: plainText,
  intendedChange: plainText,
  primaryMetric: z.enum(["completions", "leads"]),
  completionFloor: z.number().finite().min(0).max(100).optional(),
  reviewDate: z.string().refine(validExperimentReviewDate, "Choose a valid review date (YYYY-MM-DD)." ).optional(),
}).strict();
export type ExperimentPlan = z.infer<typeof ExperimentPlanSchema>;
export const ExperimentLaunchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  a: z.string().regex(/^[\w-]{1,128}$/),
  b: z.string().regex(/^[\w-]{1,128}$/),
  plan: ExperimentPlanSchema.optional(),
  reviewedSnapshots: z.tuple([z.string().regex(/^[a-f0-9]{64}$/), z.string().regex(/^[a-f0-9]{64}$/)]).optional(),
}).strict().superRefine((value, context) => {
  if (value.a === value.b) context.addIssue({ code: "custom", path: ["b"], message: "Choose two different published quizzes." });
  if (Boolean(value.plan) !== Boolean(value.reviewedSnapshots)) context.addIssue({ code: "custom", path: ["reviewedSnapshots"], message: "Review both published versions before launching a planned test." });
});
export type ExperimentLaunch = z.infer<typeof ExperimentLaunchSchema>;
/** Evidence travels in a protected header; client-supplied counts never enter this request schema. */
export function assertExperimentEvidencePlan(body: ExperimentLaunch, hasEvidence: boolean) {
  if (hasEvidence && (!body.plan || !body.reviewedSnapshots)) throw new ExperimentRequestError(400, "Review a test plan and both published versions before attaching evidence.");
}
export interface ExperimentMetricCounts { visitors: number; completions: number; leads: number; clicks: number }
/** All experiment rates retain the existing assigned-browser-start denominator. */
export function experimentMetricRate(count: number, starters: number): number | null {
  if (!Number.isSafeInteger(starters) || starters <= 0 || !Number.isSafeInteger(count) || count < 0 || count > starters) return null;
  return count / starters * 100;
}
export function experimentPlanObservation(plan: ExperimentPlan, counts: ExperimentMetricCounts, now = Date.now()) {
  const primaryRate = experimentMetricRate(counts[plan.primaryMetric], counts.visitors);
  const completionRate = experimentMetricRate(counts.completions, counts.visitors);
  return {
    primaryCount: counts[plan.primaryMetric], primaryRate, completionRate,
    // Compare raw fractions; rounded display values must not decide a boundary.
    floor: plan.completionFloor === undefined ? "not_set" as const : completionRate === null ? "not_measured" as const : completionRate < plan.completionFloor ? "below" as const : "at_or_above" as const,
    sharedMetric: plan.primaryMetric === "completions" && plan.completionFloor !== undefined,
    reviewDue: Boolean(plan.reviewDate && Number.isFinite(now) && new Date(now).toISOString().slice(0, 10) >= plan.reviewDate),
  };
}

/** Hash callers use a canonical full snapshot, independent of JSON object key order. */
export function experimentSnapshotJson(value: unknown): string {
  const ordered = (item: unknown): unknown => Array.isArray(item) ? item.map(ordered) : item && typeof item === "object" ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, ordered(child)])) : item;
  return JSON.stringify(ordered(value));
}

export class ExperimentRequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = "ExperimentRequestError"; }
}
/** A streamed byte limit also covers chunked/multibyte bodies before JSON parsing. */
export async function readExperimentBody(req: Request, limit = 12 * 1024): Promise<unknown> {
  if (Number(req.headers.get("content-length")) > limit) throw new ExperimentRequestError(413, "The experiment request is too large.");
  const reader = req.body?.getReader();
  if (!reader) throw new ExperimentRequestError(400, "Choose a valid experiment request.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { void reader.cancel().catch(() => {}); throw new ExperimentRequestError(413, "The experiment request is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new ExperimentRequestError(400, "Choose a valid UTF-8 JSON experiment request."); }
}
