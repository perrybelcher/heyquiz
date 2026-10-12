/** A fixed window anchored to the first observed landing, never extended by reloads. */
export const LANDING_VISIT_WINDOW_MS = 30 * 60 * 1000;
export type LandingVisitContext = { id: string; variant: 0 | 1 };
export interface LandingVisit {
  version: 1;
  formId: string;
  firstViewedAt: number;
  expiresAt: number;
  channel: "direct" | "embed";
  experiment?: LandingVisitContext;
}
export const landingVisitContext = (experiment?: LandingVisitContext) => experiment ? `${experiment.id}:${experiment.variant}` : "direct";
export const validLandingVisit = (visit: LandingVisit) => visit.version === 1 && ["direct", "embed"].includes(visit.channel) && Number.isFinite(visit.firstViewedAt) && visit.firstViewedAt > 0 && visit.expiresAt === visit.firstViewedAt + LANDING_VISIT_WINDOW_MS;
