import type { Attempt } from "./attempts";
import { landingVisitContext, validLandingVisit, type LandingVisit } from "./landing-visit";
/** Visit cohorts use first-view dates; starter cohorts keep their existing start-date definition. */
export function summarizeLandingVisits(formId: string, visits: { id: string; payload: LandingVisit }[], attempts: { id: string; payload: Attempt }[], cutoff: number, now: number) {
  const valid = new Map(visits.filter(row => row.payload.formId === formId && validLandingVisit(row.payload) && row.payload.firstViewedAt <= now).map(row => [row.id, row.payload]));
  const firstRecordedAt = valid.size ? [...valid.values()].reduce((first, visit) => Math.min(first, visit.firstViewedAt), now) : null;
  const cohort = new Map([...valid].filter(([, visit]) => visit.firstViewedAt >= cutoff));
  const startedVisits = new Set<string>();
  let linkedStarts = 0, unlinkedStarts = 0, cohortStarts = 0;
  for (const { payload: attempt } of attempts) {
    if (attempt.preview || attempt.form.id !== formId || !Number.isFinite(attempt.startedAt) || attempt.startedAt > now) continue;
    const visit = attempt.landingVisitId ? valid.get(attempt.landingVisitId) : undefined;
    const linked = visit && attempt.startedAt >= visit.firstViewedAt && attempt.startedAt < visit.expiresAt && landingVisitContext(attempt.experiment) === landingVisitContext(visit.experiment);
    if (attempt.startedAt >= cutoff) { if (linked) linkedStarts++; else unlinkedStarts++; }
    if (linked && cohort.has(attempt.landingVisitId!)) { startedVisits.add(attempt.landingVisitId!); cohortStarts++; }
  }
  return {
    firstRecordedAt: firstRecordedAt === null ? null : new Date(firstRecordedAt).toISOString(),
    partialHistory: firstRecordedAt !== null && firstRecordedAt > cutoff,
    visits: firstRecordedAt === null ? null : cohort.size,
    visitsWithStarts: firstRecordedAt === null ? null : startedVisits.size,
    startRate: cohort.size ? Math.round(startedVisits.size / cohort.size * 1000) / 10 : null,
    directVisits: [...cohort.values()].filter(visit => visit.channel === "direct").length,
    embedVisits: [...cohort.values()].filter(visit => visit.channel === "embed").length,
    linkedStarts, unlinkedStarts, repeatStarts: cohortStarts - startedVisits.size,
  };
}
