import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { HttpError } from "./auth";
import { getAttempt, type Attempt } from "./attempts";
import { listRecords, readRecord, writeRecord, type StoredRecord } from "./records";
import { issueResultReport, readResultReport } from "./result-reports";
import { liveRecipientDigest, liveResultEmailSettings, openLiveResultEmail, resultEmailAddress, sealLiveResultEmail } from "./result-email-config";
import { DEFAULT_RESULT_EMAIL_COPY, renderResultEmailCopy, resolveResultEmailCopy } from "./result-email-copy";
import { ResendResultTransportError, retrieveResendResultEmail, sendResendResultEmail, validResendId, type ResendDeliveryEvent, type ResendResultPayload, type ResendResultTransport } from "./result-email-transport";

export const LIVE_EMAIL_MAX_ATTEMPTS = 3, LIVE_EMAIL_LEASE_MS = 90000, LIVE_EMAIL_RETRY_WINDOW_MS = 23 * 3600000;
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/), timestamp = z.number().int().nonnegative().safe();
const states = ["queued", "sending", "accepted", "delivered", "delivery_delayed", "bounced", "complained", "failed", "unknown", "cancelled"] as const;
export type LiveResultEmailState = typeof states[number];
const JobSchema = z.object({
  version: z.literal(2), mode: z.literal("resend"), formId: identifier, responseId: identifier, requestedAt: timestamp,
  recipientDigest: z.string().regex(/^[a-f0-9]{64}$/), payloadBox: z.string().max(100000), payloadHash: z.string().regex(/^[a-f0-9]{64}$/), credentialFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  reportExpiresAt: timestamp, state: z.enum(states), attempts: z.number().int().min(0).max(LIVE_EMAIL_MAX_ATTEMPTS), nextAttemptAt: timestamp,
  firstAttemptAt: timestamp.optional(), leaseUntil: timestamp.optional(), claim: z.string().uuid().optional(), uncertain: z.boolean(), retryable: z.boolean(),
  acceptedAt: timestamp.optional(), deliveredAt: timestamp.optional(), providerId: z.string().uuid().optional(),
}).strict();
export type LiveResultEmailJob = z.infer<typeof JobSchema>;
const ReceiptSchema = z.object({ version: z.literal(1), jobId: identifier, providerId: z.string().uuid(), acceptedAt: timestamp,
  state: z.enum(["accepted", "delivered", "delivery_delayed", "bounced", "complained", "failed"]), eventAt: timestamp, deliveredAt: timestamp.optional(), lastCheckedAt: timestamp.optional(),
}).strict();
type Receipt = z.infer<typeof ReceiptSchema>;
const messages: Record<LiveResultEmailState, string> = {
  queued: "Your result email is queued. Delivery has not yet been confirmed.", sending: "Your result email is being submitted to the email service.",
  accepted: "The email service accepted your result email. Delivery to your mail server has not yet been confirmed.",
  delivered: "Your mail server accepted the result email. Check your inbox and spam folder; this does not confirm that it was read.",
  delivery_delayed: "The email service accepted your email, but delivery is delayed. It is still retrying delivery.",
  bounced: "Your mail server rejected the result email. Use your private result link instead.",
  complained: "This result email was reported as spam. It will not be sent again.",
  failed: "The result email could not be delivered. Your private result link is still available.",
  unknown: "The email service did not confirm the outcome. To avoid a duplicate, this request will not be sent again. Use your private result link instead.",
  cancelled: "Your result is no longer available. This queued email was cancelled before a confirmed send.",
};
export function viewLiveResultEmail(job: LiveResultEmailJob) {
  return { mode: "resend" as const, state: job.state, attempts: job.attempts, message: messages[job.state], nextAttemptAt: job.state === "queued" ? job.nextAttemptAt : null,
    canRetry: job.state === "failed" && job.retryable && job.attempts < LIVE_EMAIL_MAX_ATTEMPTS && (!job.firstAttemptAt || Date.now() < job.firstAttemptAt + LIVE_EMAIL_RETRY_WINDOW_MS),
    acceptedAt: job.acceptedAt ?? null, deliveredAt: job.deliveredAt ?? null };
}
export const liveResultEmailJobId = (owner: string, formId: string, responseId: string) => `mail-${createHash("sha256").update(JSON.stringify([owner, formId, responseId])).digest("hex").slice(0, 48)}`;
const context = (owner: string, id: string) => `${owner}:${id}:resend:v2`;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const credentialFingerprint = () => createHmac("sha256", process.env.SESSION_SECRET!).update(liveResultEmailSettings().apiKey).digest("hex");
function checkedJob(row: StoredRecord<unknown> | null, owner?: string): StoredRecord<LiveResultEmailJob> | null {
  if (!row) return null;
  if (owner && row.owner_id !== owner) throw new HttpError(404, "Delivery request not found.");
  if ((row.payload as { version?: unknown })?.version === 1) throw new HttpError(409, "A local test request cannot be converted into a real email.");
  const parsed = JobSchema.safeParse(row.payload);
  if (!parsed.success || row.kind !== "result_email_jobs" || !row.owner_id || !Number.isSafeInteger(row.version) || row.version < 1 || row.id !== liveResultEmailJobId(row.owner_id, parsed.data.formId, parsed.data.responseId)) throw new HttpError(503, "The saved delivery request is unavailable.");
  return { ...row, payload: parsed.data };
}
const readJob = async (id: string, owner?: string) => checkedJob(await readRecord("result_email_jobs", id), owner);
async function readReceipt(row: StoredRecord<LiveResultEmailJob>) {
  const record = await readRecord("result_email_receipts", `receipt-${row.id}`);
  if (!record) return null;
  const parsed = ReceiptSchema.safeParse(record.payload);
  if (!parsed.success || record.kind !== "result_email_receipts" || record.id !== `receipt-${row.id}` || record.owner_id !== row.owner_id || parsed.data.jobId !== row.id || !Number.isSafeInteger(record.version) || record.version < 1) throw new HttpError(503, "Delivery confirmation is temporarily unavailable.");
  return { ...record, payload: parsed.data };
}
async function reportFor(row: StoredRecord<LiveResultEmailJob>) {
  const attempt = await readRecord<Attempt>("attempts", row.payload.responseId);
  if (!attempt || attempt.owner_id !== row.owner_id || attempt.payload.form.id !== row.payload.formId || attempt.payload.preview || !attempt.payload.completed) throw new HttpError(410, "Result unavailable.");
  const link = await issueResultReport(attempt), report = await readResultReport(link.path.slice("/result/".length));
  if (!report || report.expiresAt !== row.payload.reportExpiresAt) throw new HttpError(410, "Result unavailable.");
  return report;
}
function frozenPayload(row: StoredRecord<LiveResultEmailJob>): ResendResultPayload {
  const raw = openLiveResultEmail(row.payload.payloadBox, context(row.owner_id, row.id));
  if (hash(JSON.stringify(raw)) !== row.payload.payloadHash) throw new HttpError(503, "The saved delivery message is unavailable.");
  const parsed = z.object({ from: z.string().max(340), to: z.tuple([z.string().max(254)]), subject: z.string().max(200), text: z.string().max(16000), html: z.string().max(24000), tags: z.array(z.object({ name: z.string(), value: z.string() }).strict()).length(1) }).strict().safeParse(raw);
  if (!parsed.success || parsed.data.to[0] !== resultEmailAddress(parsed.data.to[0]) || parsed.data.tags[0].name !== "pippi_job" || parsed.data.tags[0].value !== row.id) throw new HttpError(503, "The saved delivery message is unavailable.");
  return parsed.data;
}
export async function authorizeLiveResultEmail(token: unknown, formId: string) {
  liveResultEmailSettings();
  const attempt = await getAttempt(token, formId);
  if (attempt.payload.preview || !attempt.payload.completed || !attempt.payload.result) throw new HttpError(409, "Complete a published quiz before requesting your result email.");
  await issueResultReport(attempt);
  return attempt;
}
export async function requestLiveResultEmail(attempt: StoredRecord<Attempt>, email: unknown, requested: unknown) {
  const settings = liveResultEmailSettings();
  if (requested !== true) throw new HttpError(400, "Choose to receive your result email first.");
  if (attempt.payload.preview || !attempt.payload.completed || !attempt.payload.result) throw new HttpError(409, "Complete a published quiz first.");
  const recipient = resultEmailAddress(email), id = liveResultEmailJobId(attempt.owner_id, attempt.payload.form.id, attempt.id), ctx = context(attempt.owner_id, id);
  const link = await issueResultReport(attempt), digest = liveRecipientDigest(recipient, ctx);
  let row = await readJob(id, attempt.owner_id);
  if (!row) {
    const privateUrl = new URL(link.path, settings.origin).href;
    const copy = resolveResultEmailCopy(attempt.payload.form.resultEmailCopy ?? DEFAULT_RESULT_EMAIL_COPY, { quizTitle: attempt.payload.form.title, brandName: attempt.payload.form.theme.brandName });
    const message = renderResultEmailCopy(copy, { expiresOn: link.expiresAt.slice(0, 10), privateUrl, mode: "resend" });
    const payload: ResendResultPayload = { from: settings.from, to: [recipient], ...message, tags: [{ name: "pippi_job", value: id }] };
    const now = Date.now(), job: LiveResultEmailJob = { version: 2, mode: "resend", formId: attempt.payload.form.id, responseId: attempt.id, requestedAt: now, recipientDigest: digest,
      payloadBox: sealLiveResultEmail(payload, ctx), payloadHash: hash(JSON.stringify(payload)), credentialFingerprint: credentialFingerprint(), reportExpiresAt: Date.parse(link.expiresAt), state: "queued", attempts: 0, nextAttemptAt: now, uncertain: false, retryable: true };
    try { row = await writeRecord("result_email_jobs", id, attempt.owner_id, job, 0); }
    catch { row = await readJob(id, attempt.owner_id); if (!row) throw new HttpError(503, "The result email could not be queued. Please try again."); }
  }
  if (row.payload.recipientDigest !== digest) throw new HttpError(409, "This response already has a result email request. It keeps the original recipient.");
  return viewLiveResultEmail(row.payload);
}
const rank: Record<Receipt["state"], number> = { accepted: 0, delivery_delayed: 1, delivered: 2, failed: 3, bounced: 4, complained: 5 };
function receiptState(event: ResendDeliveryEvent): Receipt["state"] { return event === "sent" ? "accepted" : event === "suppressed" ? "failed" : event; }
/** Receipt persists independently of the worker lease and can recover a crash after provider acceptance. */
export async function recordLiveEmailReceipt(id: string, owner: string, providerId: string, event: ResendDeliveryEvent = "sent", eventAt = Date.now()) {
  if (!validResendId(providerId) || !Number.isSafeInteger(eventAt) || eventAt < 0 || eventAt > Date.now() + 300000) throw new HttpError(400, "Invalid delivery confirmation.");
  const row = await readJob(id, owner); if (!row || row.payload.firstAttemptAt === undefined) throw new HttpError(404, "Delivery request not found.");
  for (let n = 0; n < 4; n++) {
    const old = await readReceipt(row);
    if (old && old.payload.providerId !== providerId) throw new HttpError(409, "Conflicting delivery confirmation.");
    const incoming = receiptState(event), state = old && rank[old.payload.state] >= rank[incoming] ? old.payload.state : incoming;
    const data: Receipt = { ...(old?.payload || {}), version: 1, jobId: id, providerId, acceptedAt: old?.payload.acceptedAt ?? eventAt, state, eventAt: Math.max(old?.payload.eventAt || 0, eventAt), ...(event === "delivered" ? { deliveredAt: old?.payload.deliveredAt ?? eventAt } : {}) };
    if (old && JSON.stringify(data) === JSON.stringify(old.payload)) return old;
    try { return await writeRecord("result_email_receipts", `receipt-${id}`, owner, data, old?.version ?? 0); }
    catch { const latest = await readReceipt(row); if (latest && latest.payload.providerId === providerId && rank[latest.payload.state] >= rank[state]) return latest; if (n === 3) throw new HttpError(503, "Delivery confirmation could not be saved."); }
  }
  throw new HttpError(503, "Delivery confirmation could not be saved.");
}
async function reconcile(row: StoredRecord<LiveResultEmailJob>, receipt: StoredRecord<Receipt>) {
  const current = await readJob(row.id, row.owner_id); if (!current) throw new HttpError(404, "Delivery request not found.");
  const next: LiveResultEmailJob = { ...current.payload, state: receipt.payload.state, providerId: receipt.payload.providerId, acceptedAt: receipt.payload.acceptedAt, deliveredAt: receipt.payload.deliveredAt, uncertain: false, retryable: false, leaseUntil: undefined, claim: undefined };
  if (JSON.stringify(next) === JSON.stringify(current.payload)) return current;
  try { return await writeRecord("result_email_jobs", row.id, row.owner_id, next, current.version); }
  catch { const latest = await readJob(row.id, row.owner_id); if (!latest) throw new HttpError(503, "Delivery status is temporarily unavailable."); return latest; }
}
async function writeStatus(row: StoredRecord<LiveResultEmailJob>, patch: Partial<LiveResultEmailJob>) {
  try { return await writeRecord("result_email_jobs", row.id, row.owner_id, { ...row.payload, ...patch }, row.version); }
  catch { const latest = await readJob(row.id, row.owner_id); if (!latest || latest.version === row.version) throw new HttpError(503, "Delivery status could not be saved."); return latest; }
}
export async function processLiveResultEmail(id: string, owner: string, transport: ResendResultTransport = sendResendResultEmail) {
  liveResultEmailSettings();
  let row = await readJob(id, owner); if (!row) throw new HttpError(404, "Delivery request not found.");
  const receipt = await readReceipt(row); if (receipt) return viewLiveResultEmail((await reconcile(row, receipt)).payload);
  const job = row.payload, now = Date.now();
  if (["accepted", "delivered", "delivery_delayed", "bounced", "complained", "cancelled", "unknown", "failed"].includes(job.state) || job.state === "sending" && (job.leaseUntil || 0) > now || job.state === "queued" && job.nextAttemptAt > now) return viewLiveResultEmail(job);
  if (job.firstAttemptAt !== undefined && now >= job.firstAttemptAt + LIVE_EMAIL_RETRY_WINDOW_MS || job.attempts >= LIVE_EMAIL_MAX_ATTEMPTS) return viewLiveResultEmail((await writeStatus(row, { state: job.uncertain ? "unknown" : "failed", retryable: false, claim: undefined, leaseUntil: undefined })).payload);
  if (job.credentialFingerprint !== credentialFingerprint()) return viewLiveResultEmail((await writeStatus(row, { state: job.firstAttemptAt === undefined ? "failed" : "unknown", retryable: false })).payload);
  // Check lifecycle before claiming. A revoked link must never generate a new send.
  try { await reportFor(row); } catch (error) { if (error instanceof HttpError && [400, 404, 409, 410].includes(error.status)) return viewLiveResultEmail((await writeStatus(row, { state: job.uncertain ? "unknown" : "cancelled", retryable: false })).payload); throw error; }
  const payload = frozenPayload(row), claim = randomUUID();
  row = await writeStatus(row, { state: "sending", attempts: job.attempts + 1, firstAttemptAt: job.firstAttemptAt ?? now, leaseUntil: now + LIVE_EMAIL_LEASE_MS, claim, uncertain: true });
  if (row.payload.claim !== claim) return viewLiveResultEmail(row.payload);
  const claimed = row;
  let providerReturned = false;
  try {
    const result = await transport({ idempotencyKey: `pippi-result-v2/${id}`, payload, validateAcceptance: async () => {
      const latest = await readJob(id, owner);
      if (!latest || latest.payload.state !== "sending" || latest.payload.claim !== claim || (latest.payload.leaseUntil || 0) <= Date.now() || latest.payload.firstAttemptAt === undefined || Date.now() >= latest.payload.firstAttemptAt + LIVE_EMAIL_RETRY_WINDOW_MS) throw new HttpError(409, "This delivery claim is no longer active.");
      await reportFor(latest);
      if ((latest.payload.leaseUntil || 0) <= Date.now() || Date.now() >= latest.payload.firstAttemptAt + LIVE_EMAIL_RETRY_WINDOW_MS) throw new HttpError(409, "This delivery claim is no longer active.");
    } });
    if (!validResendId(result.receiptId)) throw new ResendResultTransportError(502, true);
    providerReturned = true;
    const accepted = await recordLiveEmailReceipt(id, owner, result.receiptId);
    // Acceptance remains acceptance even if the report was revoked while the
    // provider processed the request. A sent message cannot be recalled.
    return viewLiveResultEmail((await reconcile(claimed, accepted)).payload);
  } catch (error) {
    const accepted = await readReceipt(claimed); if (accepted) return viewLiveResultEmail((await reconcile(claimed, accepted)).payload);
    // Provider accepted but our receipt write failed. Leave the durable lease
    // intact: reclaiming within the window repeats the same key/payload and
    // recovers that provider ID. Do not mislabel known acceptance as cancelled.
    if (providerReturned) throw new HttpError(503, "Delivery confirmation is temporarily unavailable. The request remains saved.");
    const cancelled = !providerReturned && error instanceof HttpError && [400, 404, 409, 410].includes(error.status);
    const ambiguous = providerReturned || (error instanceof ResendResultTransportError ? error.ambiguous : !cancelled);
    const transient = error instanceof ResendResultTransportError && [408, 409, 425, 429].includes(error.status) || error instanceof ResendResultTransportError && error.status >= 500;
    const uncertain = job.uncertain || ambiguous;
    const retryable = !cancelled && transient && claimed.payload.attempts < LIVE_EMAIL_MAX_ATTEMPTS;
    const nextAttemptAt = Date.now() + Math.max(error instanceof ResendResultTransportError ? error.retryAfterMs : 0, 2000 * 2 ** (claimed.payload.attempts - 1));
    return viewLiveResultEmail((await writeStatus(claimed, { state: retryable ? "queued" : uncertain ? "unknown" : cancelled ? "cancelled" : "failed", uncertain, retryable, nextAttemptAt, claim: undefined, leaseUntil: undefined })).payload);
  }
}
/** Best-effort low-latency processing. The durable row survives interruption;
 * later authorized worker/status actions never invent a new message or key. */
export async function runLiveResultEmail(id: string, owner: string) {
  const deadline = Date.now() + 25000;
  for (let n = 0; n < LIVE_EMAIL_MAX_ATTEMPTS; n++) {
    const view = await processLiveResultEmail(id, owner);
    if (view.state !== "queued" || !view.nextAttemptAt) return;
    const delay = Math.max(0, view.nextAttemptAt - Date.now());
    if (delay > 8000 || Date.now() + delay + 8000 > deadline) return;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
async function refreshJobStatus(row: StoredRecord<LiveResultEmailJob>, refresh: boolean) {
  const id = row.id;
  let receipt = await readReceipt(row);
  if (receipt && refresh && Date.now() - (receipt.payload.lastCheckedAt || 0) >= 30000 && ["accepted", "delivery_delayed"].includes(receipt.payload.state) && row.payload.credentialFingerprint === credentialFingerprint()) {
    // Claim the poll slot before contacting the provider; concurrent browser
    // refreshes do not multiply provider GETs. No send occurs on a status read.
    try { receipt = await writeRecord("result_email_receipts", receipt.id, row.owner_id, { ...receipt.payload, lastCheckedAt: Date.now() }, receipt.version);
      const event = await retrieveResendResultEmail(receipt.payload.providerId, frozenPayload(row).to[0]);
      if (event) receipt = await recordLiveEmailReceipt(id, row.owner_id, receipt.payload.providerId, event);
    } catch { /* Keep the last confirmed state; provider lookup failure is not delivery failure. */ }
  }
  if (receipt) row = await reconcile(row, receipt);
  return viewLiveResultEmail(row.payload);
}
export async function liveResultEmailStatus(attempt: StoredRecord<Attempt>, options: { refresh?: boolean } = {}) {
  liveResultEmailSettings();
  const row = await readJob(liveResultEmailJobId(attempt.owner_id, attempt.payload.form.id, attempt.id), attempt.owner_id);
  return row ? refreshJobStatus(row, Boolean(options.refresh)) : null;
}
export async function retryLiveResultEmail(attempt: StoredRecord<Attempt>) {
  liveResultEmailSettings();
  const row = await readJob(liveResultEmailJobId(attempt.owner_id, attempt.payload.form.id, attempt.id), attempt.owner_id);
  if (!row || !viewLiveResultEmail(row.payload).canRetry) throw new HttpError(409, "This delivery request cannot be resent. Use the private result link instead.");
  await reportFor(row);
  return viewLiveResultEmail((await writeStatus(row, { state: "queued", nextAttemptAt: Date.now() })).payload);
}
export async function drainLiveResultEmails(owner?: string, formId?: string) {
  liveResultEmailSettings(); const now = Date.now(), rows = await listRecords<unknown>("result_email_jobs", owner);
  const jobs = rows.filter(row => (!owner || row.owner_id === owner) && (row.payload as { version?: unknown })?.version === 2).map(row => checkedJob(row)!).filter(row => !formId || row.payload.formId === formId);
  const selected = jobs.filter(row => row.payload.state === "queued" && row.payload.nextAttemptAt <= now || row.payload.state === "sending" && (row.payload.leaseUntil || 0) <= now)
    .sort((a, b) => a.payload.requestedAt - b.payload.requestedAt).slice(0, 5);
  const results = []; for (const row of selected) results.push(await processLiveResultEmail(row.id, row.owner_id));
  // Separate bounded polling handles missing/delayed webhooks without resending.
  const receipts = await listRecords<Receipt>("result_email_receipts", owner), checks = new Map(receipts.map(row => [row.payload.jobId, row.payload.lastCheckedAt || 0]));
  const polling = jobs.filter(row => ["accepted", "delivery_delayed", "unknown"].includes(row.payload.state) && row.payload.reportExpiresAt > now && checks.has(row.id))
    .sort((a, b) => (checks.get(a.id)! - checks.get(b.id)!) || a.payload.requestedAt - b.payload.requestedAt).slice(0, 5);
  for (const row of polling) await refreshJobStatus(row, true);
  return { mode: "resend" as const, processed: results.length, checked: polling.length, results };
}
export async function listLiveResultEmails(owner: string, formId: string) {
  liveResultEmailSettings();
  const form = await readRecord("forms", formId); if (!form || form.owner_id !== owner) throw new HttpError(404, "Quiz not found.");
  const rows = (await listRecords<unknown>("result_email_jobs", owner)).filter(row => row.owner_id === owner && (row.payload as { version?: unknown })?.version === 2).map(row => checkedJob(row, owner)!).filter(row => row.payload.formId === formId).sort((a, b) => b.payload.requestedAt - a.payload.requestedAt);
  return { mode: "resend" as const, total: rows.length, jobs: await Promise.all(rows.slice(0, 100).map(async row => { const receipt = await readReceipt(row); const current = receipt ? await reconcile(row, receipt) : row; return { responseId: current.payload.responseId, requestedAt: current.payload.requestedAt, ...viewLiveResultEmail(current.payload) }; })) };
}
/** Called only after authenticating the provider's raw signed webhook body.
 * Retain a minimal receipt; never store the provider's recipient/message payload. */
export async function applyLiveResultEmailEvent(value: unknown) {
  liveResultEmailSettings();
  const event = z.object({ type: z.string(), created_at: z.string(), data: z.object({ email_id: z.string(), to: z.array(z.string()), tags: z.record(z.string(), z.string()).optional() }).passthrough() }).passthrough().safeParse(value);
  if (!event.success) throw new HttpError(400, "Invalid delivery event.");
  const mapping: Record<string, ResendDeliveryEvent> = { "email.sent": "sent", "email.delivered": "delivered", "email.delivery_delayed": "delivery_delayed", "email.bounced": "bounced", "email.complained": "complained", "email.failed": "failed", "email.suppressed": "suppressed" };
  const type = mapping[event.data.type], id = event.data.data.tags?.pippi_job;
  if (!type || !id || !/^mail-[a-f0-9]{48}$/.test(id)) return { matched: false };
  const row = await readJob(id); if (!row || row.payload.firstAttemptAt === undefined) return { matched: false };
  const eventAt = Date.parse(event.data.created_at), recipient = frozenPayload(row).to[0];
  if (!validResendId(event.data.data.email_id) || event.data.data.to.length !== 1 || event.data.data.to[0].toLowerCase() !== recipient || !Number.isFinite(eventAt) || eventAt < row.payload.firstAttemptAt - 300000) throw new HttpError(400, "Invalid delivery event.");
  const receipt = await recordLiveEmailReceipt(id, row.owner_id, event.data.data.email_id, type, eventAt);
  await reconcile(row, receipt);
  return { matched: true };
}
