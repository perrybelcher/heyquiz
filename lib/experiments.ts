import type { FormSchemaType } from "./schema";
import type { Attempt } from "./attempts";
import type { ExperimentPlan } from "./experiment-plan";
import type { ExperimentEvidence } from "./experiment-evidence";
import { HttpError, verifyToken } from "./auth";
import { readRecord } from "./records";
import { reportRevokedBefore } from "./result-reports";
export interface Experiment {
  name: string;
  createdAt: number;
  active: boolean;
  variants: [FormSchemaType, FormSchemaType];
  /** Absent on older/basic tests; never infer a retrospective plan. */
  plan?: ExperimentPlan;
  /** Frozen owner-verified aggregate observation. Never stores the short-lived proof. */
  evidence?: ExperimentEvidence;
}
export interface ExperimentAssignment { id: string; visitor: string; variant: 0 | 1 }
/** Frozen variants survive republishing, but never a quiz deletion or ownership change. */
export async function availableExperiment(id: string) {
  const row = await readRecord<Experiment>("experiments", id);
  if (!row?.payload.active) throw new HttpError(410, "This experiment is paused or unavailable.");
  const available = await Promise.all(row.payload.variants.map(async variant => {
    const [form, published, retiredAt] = await Promise.all([
      readRecord<FormSchemaType>("forms", variant.id),
      readRecord<FormSchemaType>("published", variant.id),
      reportRevokedBefore(variant.id, row.owner_id),
    ]);
    return form?.owner_id === row.owner_id && published?.owner_id === row.owner_id &&
      Number.isFinite(row.payload.createdAt) && row.payload.createdAt > retiredAt;
  }));
  if (!available.every(Boolean)) throw new HttpError(410, "A quiz in this experiment is no longer available. Create a new experiment with your published quizzes.");
  return row;
}
// Assignment is signed by the server; clients cannot select an arm or substitute a quiz.
export async function resolveExperiment(token: unknown) {
  const claims = typeof token === "string" ? verifyToken(token) : null;
  if (!claims || claims.purpose !== "experiment" || typeof claims.experimentId !== "string" || typeof claims.visitor !== "string" || ![0, 1].includes(claims.variant as number))
    throw new HttpError(401, "Reopen the experiment link to continue.");
  const row = await availableExperiment(claims.experimentId);
  const assignment: ExperimentAssignment = { id: row.id, visitor: claims.visitor, variant: claims.variant as 0 | 1 };
  return { row, assignment, form: row.payload.variants[assignment.variant] };
}
export function experimentStats(id: string, attempts: Attempt[]) {
  // One visitor contributes at most once per metric. Retakes cannot inflate conversion rates.
  const visitors = new Map<string, { variant: 0 | 1; complete: boolean; lead: boolean; click: boolean }>();
  for (const a of [...attempts].sort((a, b) => a.startedAt - b.startedAt)) {
    const e = a.experiment;
    if (a.preview || e?.id !== id) continue;
    const v = visitors.get(e.visitor) || { variant: e.variant, complete: false, lead: false, click: false };
    if (v.variant !== e.variant) continue;
    v.complete ||= Boolean(a.completed);
    v.lead ||= Boolean(a.result?.contact || a.result?.contactCaptured);
    v.click ||= Boolean(a.offerClickedAt);
    visitors.set(e.visitor, v);
  }
  return ([0, 1] as const).map(variant => {
    const rows = [...visitors.values()].filter(v => v.variant === variant);
    return { visitors: rows.length, completions: rows.filter(v => v.complete).length, leads: rows.filter(v => v.lead).length, clicks: rows.filter(v => v.click).length };
  });
}
