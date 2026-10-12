import { createHash } from "node:crypto";
import { HttpError, signToken, verifyToken } from "./auth";
import { readRecord, writeRecord } from "./records";
import type { Attempt } from "./attempts";
import type { FormSchemaType, FormTheme, QuizSubmissionResult } from "./schema";
import type { ReportDesign } from "./report-design";
export const RESULT_REPORT_LIFETIME = 30 * 24 * 60 * 60 * 1000;
export type ResultLinkRevocation = { formId: string; submissionId: string; revokedAt: number };
/** Per-response receipts never contain bearer tokens, contact details or result content. */
export function resultLinkReceiptId(formId: string, owner: string, submissionId: string) {
    return createHash("sha256").update(JSON.stringify([owner, formId, submissionId])).digest("hex");
}
export async function resultLinkRevoked(formId: string, owner: string, submissionId: string) {
    const row = await readRecord<ResultLinkRevocation>("result_report_link_revocations", resultLinkReceiptId(formId, owner, submissionId));
    return Boolean(row && row.owner_id === owner && row.payload.formId === formId && row.payload.submissionId === submissionId);
}
type ReportRevocation = { retiredAt: number };
function revocationId(formId: string, owner: string) {
    return createHash("sha256").update(JSON.stringify([owner, formId])).digest("hex");
}
export async function reportRevokedBefore(formId: string, owner: string) {
    const row = await readRecord<ReportRevocation>("result_report_revocations", revocationId(formId, owner));
    return row?.owner_id === owner && Number.isFinite(row.payload.retiredAt) ? row.payload.retiredAt : 0;
}
/** Keep a small tombstone so restoring the same quiz ID cannot revive old bearer links. */
export async function revokeFormResultReports(formId: string, owner: string) {
    const id = revocationId(formId, owner), retiredAt = Date.now();
    for (let retry = 0; retry < 4; retry++) {
        const old = await readRecord<ReportRevocation>("result_report_revocations", id);
        if (old && old.payload.retiredAt >= retiredAt) return;
        try {
            await writeRecord("result_report_revocations", id, owner, { retiredAt }, old?.version ?? 0);
            return;
        } catch (error) {
            const concurrent = await readRecord<ReportRevocation>("result_report_revocations", id);
            if (concurrent && concurrent.payload.retiredAt >= retiredAt) return;
            if (retry === 3 || concurrent?.version === old?.version) throw error;
        }
    }
}
export interface ResultReport {
    submissionId: string;
    formId: string;
    createdAt: string;
    expiresAt: number;
    quizTitle: string;
    theme: FormTheme;
    /** Freeze creator-selected report presentation with the completed attempt. */
    reportDesign?: ReportDesign;
    heading: string;
    message: string;
    cta?: {
        label: string;
        url: string;
    };
    result: Pick<QuizSubmissionResult, "marketing" | "totalPointsEarned" | "totalPointsPossible" | "percentageScore">;
}
/** Explicit allowlist: a portable report never contains contact details, raw answers or grading transcripts. */
export function makeResultReport(form: FormSchemaType, result: QuizSubmissionResult, submissionId: string): ResultReport {
    const submitted = Date.parse(result.submittedAt);
    if (!Number.isFinite(submitted))
        throw new HttpError(400, "This response has no valid completion date.");
    const url = result.matchedTier?.ctaUrl || form.endingPage?.redirectUrl;
    const report: ResultReport = {
        submissionId,
        formId: form.id,
        createdAt: result.submittedAt,
        expiresAt: submitted + RESULT_REPORT_LIFETIME,
        quizTitle: form.title,
        theme: form.theme,
        ...(form.reportDesign ? { reportDesign: form.reportDesign } : {}),
        heading: result.matchedTier?.title || form.endingPage?.title || "Your results",
        message: result.matchedTier?.message || form.endingPage?.message || "Thank you for completing this quiz.",
        cta: url && /^https?:\/\//i.test(url) ? { label: result.matchedTier?.ctaText || form.endingPage?.buttonText || "Continue", url } : undefined,
        result: {
            marketing: result.marketing,
            totalPointsEarned: result.totalPointsEarned,
            totalPointsPossible: result.totalPointsPossible,
            percentageScore: result.percentageScore,
        },
    };
    return structuredClone(report);
}
type AttemptRow = {
    id: string;
    owner_id: string;
    payload: Attempt;
};
export async function issueResultReport(attempt: AttemptRow) {
    const a = attempt.payload;
    if (a.preview)
        throw new HttpError(400, "Private previews do not create saved result links.");
    if (!a.completed || !a.result)
        throw new HttpError(409, "Complete the quiz before saving a result link.");
    const [submission, form, retiredAt, individuallyRevoked] = await Promise.all([
        readRecord<QuizSubmissionResult>("submissions", attempt.id),
        readRecord<FormSchemaType>("forms", a.form.id),
        reportRevokedBefore(a.form.id, attempt.owner_id),
        resultLinkRevoked(a.form.id, attempt.owner_id, attempt.id),
    ]);
    if (!submission || !form || form.owner_id !== attempt.owner_id || submission.owner_id !== attempt.owner_id || submission.payload.formId !== a.form.id)
        throw new HttpError(404, "This response is no longer available.");
    // A frozen experiment can outlive its original quiz. Its old published snapshot
    // must not become a new report merely because an attempt starts after deletion.
    const publishedAt = Date.parse(a.form.publishedAt || "");
    if (retiredAt > 0 && (a.startedAt <= retiredAt || !Number.isFinite(publishedAt) || publishedAt <= retiredAt))
        throw new HttpError(410, "This quiz was deleted. Its previous result links are no longer available.");
    if (individuallyRevoked)
        throw new HttpError(410, "This saved result link was permanently revoked.");
    // Check the original completion window BEFORE writing. Cleanup must not be
    // undone by replaying an old attempt and recreating an already-expired copy.
    const expiresAt = Date.parse(submission.payload.submittedAt) + RESULT_REPORT_LIFETIME;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
        throw new HttpError(410, "The 30-day window for this saved result has ended.");
    // Purpose and ID prefix separate this read-only capability from attempt/auth tokens.
    // A stable ID makes retries idempotent; the first frozen snapshot wins.
    const id = `result-${attempt.id}`;
    let row = await readRecord<ResultReport>("result_reports", id);
    if (!row) {
        try {
            row = await writeRecord("result_reports", id, attempt.owner_id, makeResultReport(a.form, submission.payload, attempt.id), 0);
        }
        catch (error) {
            row = await readRecord<ResultReport>("result_reports", id);
            if (!row)
                throw error;
        }
    }
    if (row.owner_id !== attempt.owner_id || row.payload.submissionId !== attempt.id || row.payload.formId !== a.form.id)
        throw new HttpError(404, "Result unavailable.");
    if (!Number.isFinite(row.payload.expiresAt) || row.payload.expiresAt <= Date.now())
        throw new HttpError(410, "This result link has expired.");
    // A revoke can commit while the immutable snapshot is being created. The
    // tombstone is authoritative for both issuance and every subsequent read.
    const [revokedAfterWrite, retiredAfterWrite] = await Promise.all([
        resultLinkRevoked(a.form.id, attempt.owner_id, attempt.id),
        reportRevokedBefore(a.form.id, attempt.owner_id),
    ]);
    if (revokedAfterWrite || (retiredAfterWrite > 0 && (a.startedAt <= retiredAfterWrite || !Number.isFinite(publishedAt) || publishedAt <= retiredAfterWrite)))
        throw new HttpError(410, "This saved result link is no longer available.");
    const token = signToken({ purpose: "result-view", id, exp: row.payload.expiresAt });
    return { path: `/result/${token}`, expiresAt: new Date(row.payload.expiresAt).toISOString() };
}
export async function readResultReport(token: string): Promise<ResultReport | null> {
    if (token.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
        return null;
    const claims = verifyToken(token);
    if (!claims || claims.purpose !== "result-view" || typeof claims.id !== "string" || !/^result-[a-f0-9-]{36}$/.test(claims.id))
        return null;
    const row = await readRecord<ResultReport>("result_reports", claims.id);
    if (!row || row.payload.expiresAt !== claims.exp || row.payload.expiresAt <= Date.now())
        return null;
    // Deleting a response or quiz also revokes its link without relying on cleanup jobs.
    const [submission, form, retiredAt, individuallyRevoked] = await Promise.all([
        readRecord<QuizSubmissionResult>("submissions", row.payload.submissionId),
        readRecord<FormSchemaType>("forms", row.payload.formId),
        reportRevokedBefore(row.payload.formId, row.owner_id),
        resultLinkRevoked(row.payload.formId, row.owner_id, row.payload.submissionId),
    ]);
    if (!submission || !form || submission.owner_id !== row.owner_id || form.owner_id !== row.owner_id || submission.payload.formId !== row.payload.formId)
        return null;
    if (individuallyRevoked || Date.parse(row.payload.createdAt) <= retiredAt)
        return null;
    return row.payload;
}
