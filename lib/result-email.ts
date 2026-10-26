import { createHash, randomUUID } from "node:crypto";
import { HttpError } from "./auth";
import { getAttempt, type Attempt } from "./attempts";
import { listRecords, readRecord, writeRecord, ConflictError, type StoredRecord } from "./records";
import { issueResultReport, readResultReport, type ResultReport } from "./result-reports";
import { localEmailOrigin, openResultEmail, recipientDigest, requireResultEmailTest, sealResultEmail } from "./result-email-config";
import { acceptSyntheticResultEmail, ResultEmailTransportError, type ResultEmailMessage, type ResultEmailTransport, type ResultEmailArtifact } from "./result-email-transport";
import { renderResultEmailCopy, resolveResultEmailCopy, validateResolvedResultEmailCopy, type ResolvedResultEmailCopy } from "./result-email-copy";
export type ResultEmailState = "queued" | "preparing" | "prepared" | "failed" | "cancelled";
export interface ResultEmailJob {
  version: 1; formId: string; responseId: string; requestedAt: number; requestVersion: 1;
  recipientBox: string; recipientDigest: string; state: ResultEmailState; attempts: number;
  nextAttemptAt: number; leaseUntil?: number; claim?: string; preparedAt?: number; receiptId?: string;
  /** Absent means the exact legacy message. Resolved text is scoped and encrypted. */
  copyBox?: string;
}
export const RESULT_EMAIL_MAX_ATTEMPTS = 3, RESULT_EMAIL_LEASE_MS = 90000;
const scope = (owner: string, id: string) => `${owner}:${id}`;
export const resultEmailJobId = (owner: string, formId: string, responseId: string) => `mail-${createHash("sha256").update(JSON.stringify([owner, formId, responseId])).digest("hex").slice(0, 48)}`;
const messages: Record<ResultEmailState, string> = { queued: "Queued for a local test. No email has been sent.", preparing: "Preparing the local test copy. No email has been sent.", prepared: "One encrypted test copy was prepared locally. No email was sent.", failed: "The local test copy could not be prepared. No email was sent.", cancelled: "This result is no longer available. The queued test was cancelled; no email was sent." };
export function resultEmailView(job: ResultEmailJob) {
  return { mode: "synthetic" as const, state: job.state, attempts: job.attempts, message: messages[job.state], nextAttemptAt: job.state === "queued" ? job.nextAttemptAt : null, canRetry: job.state === "failed" && job.attempts < RESULT_EMAIL_MAX_ATTEMPTS };
}
function address(value: unknown) {
  if (typeof value !== "string" || value.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim())) throw new HttpError(400, "Enter a valid email address for the local test.");
  return value.trim().toLowerCase();
}
export async function authorizeResultEmail(token: unknown, formId: string) {
  requireResultEmailTest();
  const attempt = await getAttempt(token, formId);
  if (attempt.payload.preview || !attempt.payload.completed || !attempt.payload.result) throw new HttpError(409, "Complete a published quiz before requesting a test copy.");
  // Reuse the saved report's immutable snapshot, retention and revocation checks.
  await issueResultReport(attempt);
  return attempt;
}
function matches(row: StoredRecord<ResultEmailJob>, attempt: StoredRecord<Attempt>) {
  return row.owner_id === attempt.owner_id && row.payload.formId === attempt.payload.form.id && row.payload.responseId === attempt.id && row.payload.version === 1;
}
export async function requestResultEmail(attempt: StoredRecord<Attempt>, email: unknown, requested: unknown) {
  requireResultEmailTest();
  if (requested !== true) throw new HttpError(400, "Choose to request a local test copy first.");
  if (attempt.payload.preview || !attempt.payload.completed) throw new HttpError(409, "Complete a published quiz first.");
  const recipient = address(email), id = resultEmailJobId(attempt.owner_id, attempt.payload.form.id, attempt.id), context = scope(attempt.owner_id, id);
  await issueResultReport(attempt);
  const digest = recipientDigest(recipient, context), now = Date.now();
  let row = await readRecord<ResultEmailJob>("result_email_jobs", id);
  if (!row) {
    let copyBox: string | undefined;
    if (attempt.payload.form.resultEmailCopy !== undefined) {
      let copy: ResolvedResultEmailCopy;
      try { copy = resolveResultEmailCopy(attempt.payload.form.resultEmailCopy, { quizTitle: attempt.payload.form.title, brandName: attempt.payload.form.theme.brandName }); }
      catch { throw new HttpError(422, "The saved quiz's email copy cannot be prepared. Your private result link is still available."); }
      copyBox = sealResultEmail({ renderingVersion: "1", subject: copy.subject, introduction: copy.introduction, signOff: copy.signOff }, `${context}:copy:v1`);
    }
    const job: ResultEmailJob = { version: 1, formId: attempt.payload.form.id, responseId: attempt.id, requestedAt: now, requestVersion: 1, recipientBox: sealResultEmail({ email: recipient }, `${context}:recipient`), ...(copyBox ? { copyBox } : {}), recipientDigest: digest, state: "queued", attempts: 0, nextAttemptAt: now };
    try { row = await writeRecord("result_email_jobs", id, attempt.owner_id, job, 0); }
    catch (error) { row = await readRecord<ResultEmailJob>("result_email_jobs", id); if (!row) throw error; }
  }
  if (!matches(row, attempt)) throw new HttpError(404, "Test request not found.");
  if (row.payload.recipientDigest !== digest) throw new HttpError(409, "A test copy was already requested for a different address. This response keeps its original address.");
  return resultEmailView(row.payload);
}
export async function resultEmailStatus(attempt: StoredRecord<Attempt>) {
  requireResultEmailTest();
  const row = await readRecord<ResultEmailJob>("result_email_jobs", resultEmailJobId(attempt.owner_id, attempt.payload.form.id, attempt.id));
  if (!row) return null;
  if (!matches(row, attempt)) throw new HttpError(404, "Test request not found.");
  return resultEmailView(row.payload);
}
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
export function resultEmailMessage(to: string, report: ResultReport, path: string, copy?: ResolvedResultEmailCopy): ResultEmailMessage {
  const url = new URL(path, localEmailOrigin());
  if (url.origin !== localEmailOrigin() || !/^\/result\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(url.pathname) || url.search || url.hash) throw new Error("The private result address is unavailable.");
  const title = report.quizTitle.replace(/[\r\n\u0000-\u001f]/g, " ").slice(0, 160), link = url.href;
  const expires = new Date(report.expiresAt).toISOString().slice(0, 10);
  if (copy) return { to, ...renderResultEmailCopy(copy, { expiresOn: expires, privateUrl: link }) };
  return { to, subject: "Your requested quiz result — local test", text: `LOCAL TEST ONLY — no email was sent.\n\nYou requested a private result link for ${title}.\n\n${link}\n\nThis link expires on ${expires} (UTC). Anyone with the link can view the saved result. This request does not subscribe you to marketing emails.`, html: `<p><strong>LOCAL TEST ONLY — no email was sent.</strong></p><p>You requested a private result link for ${escape(title)}.</p><p><a href="${escape(link)}">Open your saved result</a></p><p>This link expires on ${expires} (UTC). Anyone with the link can view the saved result.</p><p>This request does not subscribe you to marketing emails.</p>` };
}
async function availableReport(row: StoredRecord<ResultEmailJob>) {
  const attempt = await readRecord<Attempt>("attempts", row.payload.responseId);
  if (!attempt || !matches(row, attempt)) throw new HttpError(410, "Result unavailable.");
  const link = await issueResultReport(attempt), report = await readResultReport(link.path.slice("/result/".length));
  if (!report) throw new HttpError(410, "Result unavailable.");
  return { link, report };
}
/** One bounded job. The synthetic transport owns durable idempotent acceptance. */
export async function prepareResultEmail(id: string, owner: string, transport: ResultEmailTransport = acceptSyntheticResultEmail) {
  requireResultEmailTest();
  let row = await readRecord<ResultEmailJob>("result_email_jobs", id);
  if (!row || row.owner_id !== owner) throw new HttpError(404, "Test request not found.");
  const now = Date.now(), job = row.payload;
  const accepted = await readRecord<ResultEmailArtifact>("result_email_tests", `test-${id}`);
  const hasReceipt = accepted?.owner_id === owner && accepted.payload.version === 1 && accepted.payload.jobId === id && accepted.payload.formId === job.formId && accepted.payload.responseId === job.responseId;
  if (job.state === "prepared" || job.state === "cancelled" || job.state === "preparing" && (job.leaseUntil || 0) > now || job.state === "failed" && !hasReceipt || job.state === "queued" && job.nextAttemptAt > now && !hasReceipt) return resultEmailView(job);
  // Reconcile acceptance even after the final allowed attempt crashed before acknowledgement.
  if (job.attempts >= RESULT_EMAIL_MAX_ATTEMPTS && !hasReceipt) {
    row = await writeRecord("result_email_jobs", id, owner, { ...job, state: "failed", claim: undefined, leaseUntil: undefined }, row.version);
    return resultEmailView(row.payload);
  }
  try { row = await writeRecord("result_email_jobs", id, owner, { ...job, state: "preparing", attempts: hasReceipt ? job.attempts : job.attempts + 1, leaseUntil: now + RESULT_EMAIL_LEASE_MS, claim: randomUUID() }, row.version); }
  catch (error) { if (!(error instanceof ConflictError)) throw error; const current = await readRecord<ResultEmailJob>("result_email_jobs", id); if (!current || current.owner_id !== owner) throw new HttpError(404, "Test request not found."); return resultEmailView(current.payload); }
  const claimed = row;
  let timeout: ReturnType<typeof setTimeout> | number | undefined;
  let next: ResultEmailJob, accepting = true;
  const validateAcceptance = async () => {
    if (!accepting) throw new HttpError(409, "This preparation window has ended.");
    const latest = await readRecord<ResultEmailJob>("result_email_jobs", id);
    if (!latest || latest.owner_id !== owner || latest.payload.state !== "preparing" || latest.payload.claim !== claimed.payload.claim || (latest.payload.leaseUntil || 0) <= Date.now()) throw new HttpError(409, "This preparation claim is no longer active.");
    await availableReport(claimed);
    if (!accepting) throw new HttpError(409, "This preparation window has ended.");
  };
  try {
    const { link, report } = await availableReport(claimed);
    const recipient = openResultEmail(claimed.payload.recipientBox, `${scope(owner, id)}:recipient`).email;
    let copy: ResolvedResultEmailCopy | undefined;
    if (claimed.payload.copyBox !== undefined) {
      const frozen = openResultEmail(claimed.payload.copyBox, `${scope(owner, id)}:copy:v1`);
      if (frozen.renderingVersion !== "1" || Object.keys(frozen).some(key => !["renderingVersion", "subject", "introduction", "signOff"].includes(key))) throw new ResultEmailTransportError(422);
      copy = validateResolvedResultEmailCopy({ version: 1, subject: frozen.subject, introduction: frozen.introduction, signOff: frozen.signOff });
    }
    const message = resultEmailMessage(address(recipient), report, link.path, copy);
    const receipt = await Promise.race([transport({ jobId: id, owner, formId: job.formId, responseId: job.responseId, message, validateAcceptance }), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new ResultEmailTransportError(408)), 1500); })]);
    await availableReport(claimed);
    if (receipt.receiptId !== `test-${id}`) throw new ResultEmailTransportError(502);
    next = { ...claimed.payload, state: "prepared", preparedAt: Date.now(), receiptId: receipt.receiptId, claim: undefined, leaseUntil: undefined };
  } catch (error) {
    const cancelled = error instanceof HttpError && !(error instanceof ConflictError) && [400, 404, 409, 410].includes(error.status);
    const permanent = error instanceof ResultEmailTransportError && error.status >= 400 && error.status < 500 && ![408, 425, 429].includes(error.status);
    const retry = !cancelled && !permanent && claimed.payload.attempts < RESULT_EMAIL_MAX_ATTEMPTS;
    const retryAfter = error instanceof ResultEmailTransportError && Number.isFinite(error.retryAfterMs) ? Math.min(60000, Math.max(0, error.retryAfterMs!)) : 0;
    next = { ...claimed.payload, state: cancelled ? "cancelled" : retry ? "queued" : "failed", nextAttemptAt: Date.now() + Math.max(retryAfter, Math.min(60000, 2000 * 2 ** (claimed.payload.attempts - 1))), claim: undefined, leaseUntil: undefined };
  } finally { accepting = false; clearTimeout(timeout); }
  // If persistence fails after acceptance, keep the lease. A later reclaim uses the same artifact ID.
  try { row = await writeRecord("result_email_jobs", id, owner, next, claimed.version); }
  catch (error) { if (!(error instanceof ConflictError)) throw error; row = await readRecord<ResultEmailJob>("result_email_jobs", id); if (!row || row.owner_id !== owner) throw new HttpError(404, "Test request not found."); }
  return resultEmailView(row.payload);
}
export async function retryResultEmail(attempt: StoredRecord<Attempt>) {
  requireResultEmailTest();
  const id = resultEmailJobId(attempt.owner_id, attempt.payload.form.id, attempt.id), row = await readRecord<ResultEmailJob>("result_email_jobs", id);
  if (!row || !matches(row, attempt)) throw new HttpError(404, "Test request not found.");
  if (row.payload.state !== "failed" || row.payload.attempts >= RESULT_EMAIL_MAX_ATTEMPTS) throw new HttpError(409, "This test cannot be retried. Its original request remains unchanged.");
  await issueResultReport(attempt);
  return resultEmailView((await writeRecord<ResultEmailJob>("result_email_jobs", id, attempt.owner_id, { ...row.payload, state: "queued", nextAttemptAt: Date.now() }, row.version)).payload);
}
/** Explicit local owner action; no cron, provider, email API or global background dispatch. */
export async function drainResultEmails(owner: string, formId: string) {
  requireResultEmailTest();
  const now = Date.now(), [jobs, artifacts] = await Promise.all([listRecords<ResultEmailJob>("result_email_jobs", owner), listRecords<ResultEmailArtifact>("result_email_tests", owner)]);
  const accepted = new Set(artifacts.filter(row => row.owner_id === owner && row.payload.formId === formId && row.id === `test-${row.payload.jobId}`).map(row => row.payload.jobId));
  const rows = jobs.filter(row => row.owner_id === owner && row.payload.formId === formId && ((row.payload.state === "queued" && (row.payload.nextAttemptAt <= now || accepted.has(row.id))) || row.payload.state === "preparing" && (row.payload.leaseUntil || 0) <= now || row.payload.state === "failed" && accepted.has(row.id))).sort((a, b) => a.payload.requestedAt - b.payload.requestedAt).slice(0, 5);
  const results = [];
  for (const row of rows) results.push(await prepareResultEmail(row.id, owner));
  return { mode: "synthetic", processed: results.length, results, message: "Local test processing only. No email was sent." };
}
