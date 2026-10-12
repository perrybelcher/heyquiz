import { createHash } from "node:crypto";
import { HttpError, signToken, verifyToken } from "./auth";
import { readRecord, writeRecord } from "./records";
import { reportRevokedBefore } from "./result-reports";
import { LANDING_VISIT_WINDOW_MS, landingVisitContext, validLandingVisit, type LandingVisit, type LandingVisitContext } from "./landing-visit";
export const landingViewKey = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const recordId = (formId: string, owner: string, key: string, experiment?: LandingVisitContext) => `visit-${createHash("sha256").update(JSON.stringify([owner, formId, landingVisitContext(experiment), key.toLowerCase()])).digest("hex").slice(0, 48)}`;
/** The UUID is a short-lived tab-local nonce, not a visitor identity. Only its scoped hash is retained. */
export async function recordLandingVisit(formId: string, owner: string, key: unknown, embed: boolean, experiment?: LandingVisitContext) {
  if (!landingViewKey(key)) throw new HttpError(400, "A valid landing view key is required.");
  const id = recordId(formId, owner, key, experiment), now = Date.now();
  let row = await readRecord<LandingVisit>("landing_visits", id);
  if (!row) {
    try { row = await writeRecord<LandingVisit>("landing_visits", id, owner, { version: 1, formId, firstViewedAt: now, expiresAt: now + LANDING_VISIT_WINDOW_MS, channel: embed ? "embed" : "direct", ...(experiment ? { experiment: { id: experiment.id, variant: experiment.variant } } : {}) }, 0); }
    catch (error) { row = await readRecord<LandingVisit>("landing_visits", id); if (!row) throw error; }
  }
  if (row.owner_id !== owner || row.payload.formId !== formId || landingVisitContext(row.payload.experiment) !== landingVisitContext(experiment) || !validLandingVisit(row.payload)) throw new HttpError(400, "Invalid landing view.");
  if (row.payload.expiresAt <= now || row.payload.firstViewedAt <= await reportRevokedBefore(formId, owner)) throw new HttpError(409, "Start a new landing view window.");
  const token = signToken({ purpose: "landing-view", id, formId, context: landingVisitContext(experiment), exp: row.payload.expiresAt });
  return { token, expiresAt: row.payload.expiresAt, remainingMs: Math.max(0, row.payload.expiresAt - Date.now()) };
}
/** Analytics is optional: malformed, expired, foreign, deleted or unavailable links never stop a quiz. */
export async function verifiedLandingVisit(token: unknown, formId: string, owner: string, experiment?: LandingVisitContext): Promise<string | undefined> {
  const verify = async (): Promise<string | undefined> => {
  try {
    if (typeof token !== "string" || token.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return;
    const claims = verifyToken(token);
    if (claims?.purpose !== "landing-view" || claims.formId !== formId || claims.context !== landingVisitContext(experiment) || typeof claims.id !== "string" || !/^visit-[a-f0-9]{48}$/.test(claims.id)) return;
    const row = await readRecord<LandingVisit>("landing_visits", claims.id), now = Date.now();
    if (!row || row.owner_id !== owner || row.payload.formId !== formId || !validLandingVisit(row.payload) || row.payload.firstViewedAt > now || row.payload.expiresAt <= now || row.payload.expiresAt !== claims.exp || landingVisitContext(row.payload.experiment) !== landingVisitContext(experiment)) return;
    if (row.payload.firstViewedAt <= await reportRevokedBefore(formId, owner)) return;
    return row.id;
  } catch { return; }
  };
  // The record adapter may be slow/unavailable. Optional analytics must not delay core Start.
  let timeout: ReturnType<typeof setTimeout> | number | undefined;
  try { return await Promise.race([verify(), new Promise<undefined>(resolve => { timeout = setTimeout(resolve, 250); })]); }
  finally { clearTimeout(timeout); }
}
