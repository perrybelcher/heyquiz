import { HttpError } from "./auth";
import { listRecords, readRecord, removeRecord, writeRecord, type StoredRecord } from "./records";
import { RESULT_REPORT_LIFETIME, reportRevokedBefore, resultLinkReceiptId, resultLinkRevoked, type ResultLinkRevocation, type ResultReport } from "./result-reports";
import type { FormSchemaType, QuizSubmissionResult } from "./schema";

export const REPORT_CLEANUP_BATCH = 25;
const PAGE_SIZE = 25;
type ExpirationReceipt = { formId: string; submissionId: string; expiresAt: number };
export type ManagedResultLink = {
  responseId: string;
  completedAt: string;
  expiresAt: number | null;
  status: "not_created" | "active" | "expired" | "revoked";
  creationWindowExpired: boolean;
};
export type ResultLinkListing = {
  rows: ManagedResultLink[];
  total: number;
  matched: number;
  counts: Record<ManagedResultLink["status"], number>;
  expiredCopies: number;
  page: number;
  pages: number;
};

async function requireOwnedQuiz(formId: string, owner: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(formId)) throw new HttpError(404, "Quiz not found.");
  const form = await readRecord<FormSchemaType>("forms", formId);
  if (!form || form.owner_id !== owner) throw new HttpError(404, "Quiz not found.");
}
/** Deleted quizzes have no editor, but their verified owner can still maintain
 * expired copies. A new live owner takes precedence over an old retirement. */
async function requireCleanupAccess(formId: string, owner: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(formId)) throw new HttpError(404, "Quiz not found.");
  const form = await readRecord<FormSchemaType>("forms", formId);
  if (form?.owner_id === owner) return;
  if (form || (await reportRevokedBefore(formId, owner)) <= 0) throw new HttpError(404, "Quiz not found.");
}
function responseIdIsValid(id: unknown): id is string {
  return typeof id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
}
function isReportFor(row: StoredRecord<ResultReport>, formId: string, owner: string, responseId = row.payload.submissionId) {
  return row.owner_id === owner && row.payload.formId === formId && row.payload.submissionId === responseId && row.id === `result-${responseId}`;
}
/** A malformed expiry is never permission to remove a report early. */
function isExpiredCopy(row: StoredRecord<ResultReport>, formId: string, owner: string, now: number) {
  const originalExpiry = Date.parse(row.payload.createdAt) + RESULT_REPORT_LIFETIME;
  return isReportFor(row, formId, owner) && responseIdIsValid(row.payload.submissionId) && Number.isFinite(originalExpiry) && row.payload.expiresAt === originalExpiry && originalExpiry <= now;
}

/** Display only retained responses. Orphaned reports/attempts never recreate a deleted response in this list. */
export async function listResultLinks(formId: string, owner: string, requestedPage = 1, responseId = ""): Promise<ResultLinkListing> {
  await requireOwnedQuiz(formId, owner);
  if (responseId.length > 128) throw new HttpError(400, "Response ID is too long.");
  const [submissions, reports, revocations, expirations, retiredAt] = await Promise.all([
    listRecords<QuizSubmissionResult>("submissions", owner),
    listRecords<ResultReport>("result_reports", owner),
    listRecords<ResultLinkRevocation>("result_report_link_revocations", owner),
    listRecords<ExpirationReceipt>("result_report_expirations", owner),
    reportRevokedBefore(formId, owner),
  ]);
  const reportByResponse = new Map(reports.filter(row => isReportFor(row, formId, owner)).map(row => [row.payload.submissionId, row.payload]));
  const revoked = new Set(revocations.filter(row => row.owner_id === owner && row.payload.formId === formId && row.id === resultLinkReceiptId(formId, owner, row.payload.submissionId)).map(row => row.payload.submissionId));
  const expired = new Map(expirations.filter(row => row.owner_id === owner && row.payload.formId === formId && row.id === resultLinkReceiptId(formId, owner, row.payload.submissionId)).map(row => [row.payload.submissionId, row.payload.expiresAt]));
  const now = Date.now();
  const rows: ManagedResultLink[] = submissions.filter(row => row.owner_id === owner && row.payload.formId === formId).map(row => {
    const report = reportByResponse.get(row.id), expiredAt = expired.get(row.id);
    const completed = Date.parse(row.payload.submittedAt), originalExpiry = completed + RESULT_REPORT_LIFETIME;
    const windowExpired = !Number.isFinite(originalExpiry) || originalExpiry <= now;
    // An old response with no report and no expiry receipt remains Not created.
    // Quiz retirement only labels reports that existed, not every old response.
    const hadLink = Boolean(report || expiredAt !== undefined || revoked.has(row.id));
    const status: ManagedResultLink["status"] = revoked.has(row.id) || (hadLink && retiredAt > 0 && completed <= retiredAt)
      ? "revoked" : hadLink && (windowExpired || (report?.expiresAt ?? expiredAt ?? 0) <= now)
        ? "expired" : report ? "active" : "not_created";
    return { responseId: row.id, completedAt: row.payload.submittedAt, expiresAt: Number.isFinite(originalExpiry) ? originalExpiry : null, status, creationWindowExpired: windowExpired };
  }).sort((a, b) => b.completedAt.localeCompare(a.completedAt) || a.responseId.localeCompare(b.responseId));
  const counts: ResultLinkListing["counts"] = { not_created: 0, active: 0, expired: 0, revoked: 0 };
  for (const row of rows) counts[row.status]++;
  const matching = responseId.trim() ? rows.filter(row => row.responseId.toLowerCase() === responseId.trim().toLowerCase()) : rows;
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
  return { rows: matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: rows.length, matched: matching.length, counts, expiredCopies: reports.filter(row => isExpiredCopy(row, formId, owner, now)).length, page, pages };
}

/** A durable per-response tombstone makes repeat/concurrent revokes idempotent. */
export async function revokeResultLink(formId: string, owner: string, responseId: unknown) {
  await requireOwnedQuiz(formId, owner);
  if (!responseIdIsValid(responseId)) throw new HttpError(400, "Choose a valid response.");
  const submission = await readRecord<QuizSubmissionResult>("submissions", responseId);
  if (!submission || submission.owner_id !== owner || submission.payload.formId !== formId) throw new HttpError(404, "Response not found.");
  if (await resultLinkRevoked(formId, owner, responseId)) return { status: "revoked" as const };
  const report = await readRecord<ResultReport>("result_reports", `result-${responseId}`);
  if (!report || !isReportFor(report, formId, owner, responseId)) throw new HttpError(404, "This response has no saved result link.");
  try {
    await writeRecord<ResultLinkRevocation>("result_report_link_revocations", resultLinkReceiptId(formId, owner, responseId), owner, { formId, submissionId: responseId, revokedAt: Date.now() }, 0);
  } catch (error) {
    if (!(await resultLinkRevoked(formId, owner, responseId))) throw error;
  }
  return { status: "revoked" as const };
}

/** Keep only the existence/expiry receipt when removing an expired report copy. */
async function rememberExpiration(row: StoredRecord<ResultReport>, owner: string) {
  const { formId, submissionId, expiresAt } = row.payload;
  const id = resultLinkReceiptId(formId, owner, submissionId);
  const matches = (existing: StoredRecord<ExpirationReceipt> | null) => existing && existing.owner_id === owner && existing.payload.formId === formId && existing.payload.submissionId === submissionId && existing.payload.expiresAt === expiresAt;
  const existing = await readRecord<ExpirationReceipt>("result_report_expirations", id);
  if (matches(existing)) return;
  if (existing) throw new Error("Saved report history could not be verified.");
  try {
    await writeRecord<ExpirationReceipt>("result_report_expirations", id, owner, { formId, submissionId, expiresAt }, 0);
  } catch (error) {
    if (!matches(await readRecord<ExpirationReceipt>("result_report_expirations", id))) throw error;
  }
}

/** Bounds destructive work to 25 copies. The generic adapter still scans the owner's records. */
export async function cleanExpiredResultCopies(formId: string, owner: string) {
  await requireCleanupAccess(formId, owner);
  const now = Date.now();
  const eligible = (await listRecords<ResultReport>("result_reports", owner)).filter(row => isExpiredCopy(row, formId, owner, now)).sort((a, b) => a.payload.expiresAt - b.payload.expiresAt || a.id.localeCompare(b.id));
  let removed = 0, failed = 0;
  for (const candidate of eligible.slice(0, REPORT_CLEANUP_BATCH)) {
    try {
      const row = await readRecord<ResultReport>("result_reports", candidate.id);
      if (!row || !isExpiredCopy(row, formId, owner, now)) continue;
      // Write history first: a failed deletion is retryable, and a successful
      // deletion never makes a previously issued link appear never created.
      await rememberExpiration(row, owner);
      if (await removeRecord("result_reports", row.id, owner)) removed++;
    } catch {
      // A concurrent cleanup may have already removed the same immutable copy.
      if (await readRecord("result_reports", candidate.id)) failed++;
    }
  }
  const remaining = (await listRecords<ResultReport>("result_reports", owner)).filter(row => isExpiredCopy(row, formId, owner, Date.now())).length;
  return { removed, remaining, failed, batchSize: REPORT_CLEANUP_BATCH };
}
