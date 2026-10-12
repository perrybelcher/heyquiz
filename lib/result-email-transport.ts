import { readRecord, writeRecord } from "./records";
import { liveResultEmailSettings, requireResultEmailTest, sealResultEmail } from "./result-email-config";
export interface ResultEmailMessage { to: string; subject: string; text: string; html: string }
export interface ResultEmailArtifact { version: 1; jobId: string; formId: string; responseId: string; acceptedAt: number; messageBox: string }
export type ResultEmailTransport = (input: { jobId: string; owner: string; formId: string; responseId: string; message: ResultEmailMessage; validateAcceptance: () => Promise<void> }) => Promise<{ receiptId: string }>;
export class ResultEmailTransportError extends Error {
  constructor(public status: number, public retryAfterMs?: number) { super("The synthetic transport did not accept the test copy."); }
}
/** Deterministic encrypted acceptance is the local transport's idempotency boundary.
 * A crash after this write but before job acknowledgement does not create another copy. */
export const acceptSyntheticResultEmail: ResultEmailTransport = async input => {
  requireResultEmailTest();
  const id = `test-${input.jobId}`;
  const matches = (row: Awaited<ReturnType<typeof readRecord<ResultEmailArtifact>>>) => row && row.owner_id === input.owner && row.payload.version === 1 && row.payload.jobId === input.jobId && row.payload.formId === input.formId && row.payload.responseId === input.responseId;
  const old = await readRecord<ResultEmailArtifact>("result_email_tests", id);
  if (old) { await input.validateAcceptance(); if (!matches(old)) throw new ResultEmailTransportError(409); return { receiptId: id }; }
  const artifact: ResultEmailArtifact = { version: 1, jobId: input.jobId, formId: input.formId, responseId: input.responseId, acceptedAt: Date.now(), messageBox: sealResultEmail({ ...input.message }, `${input.owner}:${input.jobId}:artifact`) };
  await input.validateAcceptance();
  try { await writeRecord("result_email_tests", id, input.owner, artifact, 0); }
  catch (error) { if (!matches(await readRecord<ResultEmailArtifact>("result_email_tests", id))) throw error; }
  return { receiptId: id };
};

export interface ResendResultPayload {
  from: string; to: [string]; subject: string; text: string; html: string;
  tags: { name: string; value: string }[];
}
export type ResendResultTransport = (input: { idempotencyKey: string; payload: ResendResultPayload; validateAcceptance: () => Promise<void> }) => Promise<{ receiptId: string }>;
export class ResendResultTransportError extends Error {
  constructor(public status: number, public ambiguous = false, public retryAfterMs = 0) {
    super("The email provider did not confirm this delivery request.");
    this.name = "ResendResultTransportError";
  }
}
export const validResendId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
async function smallProviderJson(response: Response): Promise<Record<string, unknown>> {
  const reader = response.body?.getReader(); if (!reader) throw new ResendResultTransportError(502, true);
  let size = 0; const chunks: Uint8Array[] = [];
  try { for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > 65536) { void reader.cancel().catch(() => {}); throw new ResendResultTransportError(502, true); } chunks.push(next.value); } }
  finally { reader.releaseLock(); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString("utf8")); if (!value || typeof value !== "object" || Array.isArray(value)) throw Error(); return value; }
  catch { throw new ResendResultTransportError(502, true); }
}
/** One request only; the durable job owns every retry and its finite idempotency window. */
export const sendResendResultEmail: ResendResultTransport = async input => {
  const settings = liveResultEmailSettings();
  await input.validateAcceptance();
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", redirect: "error", cache: "no-store", signal: controller.signal,
      headers: { Authorization: `Bearer ${settings.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey }, body: JSON.stringify(input.payload) });
    const body = await smallProviderJson(response);
    if (!response.ok) {
      const seconds = Number(response.headers.get("retry-after"));
      const retryAfter = Number.isFinite(seconds) ? Math.min(3600000, Math.max(0, seconds * 1000)) : 0;
      // A concurrent same-key request is safe to repeat. A payload mismatch must
      // never be "fixed" by choosing a fresh key and potentially duplicating mail.
      const mismatch = response.status === 409 && body.name !== "concurrent_idempotent_requests";
      throw new ResendResultTransportError(mismatch ? 422 : response.status, mismatch || response.status >= 500 || response.status === 408 || response.status === 409, retryAfter);
    }
    if (!validResendId(body.id)) throw new ResendResultTransportError(502, true);
    return { receiptId: body.id };
  } catch (error) { if (error instanceof ResendResultTransportError) throw error; throw new ResendResultTransportError(408, true); }
  finally { clearTimeout(timer); }
};
export type ResendDeliveryEvent = "sent" | "delivered" | "delivery_delayed" | "bounced" | "complained" | "failed" | "suppressed";
export async function retrieveResendResultEmail(receiptId: string, recipient: string): Promise<ResendDeliveryEvent | null> {
  if (!validResendId(receiptId)) return null;
  const settings = liveResultEmailSettings(), controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://api.resend.com/emails/${receiptId}`, { cache: "no-store", redirect: "error", signal: controller.signal, headers: { Authorization: `Bearer ${settings.apiKey}` } });
    if (!response.ok) return null;
    const body = await smallProviderJson(response);
    if (body.id !== receiptId || !Array.isArray(body.to) || body.to.length !== 1 || body.to[0] !== recipient || typeof body.last_event !== "string") return null;
    return ["sent", "delivered", "delivery_delayed", "bounced", "complained", "failed", "suppressed"].includes(body.last_event) ? body.last_event as ResendDeliveryEvent : null;
  } catch { return null; } finally { clearTimeout(timer); }
}
