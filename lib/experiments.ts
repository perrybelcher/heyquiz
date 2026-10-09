import type { FormSchemaType } from "./schema";
import type { Attempt } from "./attempts";
import { HttpError, verifyToken } from "./auth";
import { readRecord } from "./records";
export interface Experiment {
  name: string;
  createdAt: number;
  active: boolean;
  variants: [FormSchemaType, FormSchemaType];
}
export interface ExperimentAssignment { id: string; visitor: string; variant: 0 | 1 }
// Assignment is signed by the server; clients cannot select an arm or substitute a quiz.
export async function resolveExperiment(token: unknown) {
  const claims = typeof token === "string" ? verifyToken(token) : null;
  if (!claims || claims.purpose !== "experiment" || typeof claims.experimentId !== "string" || typeof claims.visitor !== "string" || ![0, 1].includes(claims.variant as number))
    throw new HttpError(401, "Reopen the experiment link to continue.");
  const row = await readRecord<Experiment>("experiments", claims.experimentId);
  if (!row?.payload.active) throw new HttpError(410, "This experiment is paused or unavailable.");
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
