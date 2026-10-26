import { createHash } from "node:crypto";
import { ServiceUnavailableError } from "./errors";
import { readRecord, writeRecord } from "./records";

type DeletionReceipt = { formId: string; submissionId: string; deletedAt: number };
const receiptId = (formId: string, owner: string, submissionId: string) =>
  createHash("sha256").update(JSON.stringify([owner, formId, submissionId])).digest("hex");

/** A response restored by an interrupted writer must not revive queued delivery. */
export async function submissionDeleted(formId: string, owner: string, submissionId: string) {
  const row = await readRecord<DeletionReceipt>("submission_deletions", receiptId(formId, owner, submissionId));
  if (!row) return false;
  if (row.owner_id !== owner || row.payload?.formId !== formId || row.payload?.submissionId !== submissionId || !Number.isFinite(row.payload?.deletedAt))
    throw new ServiceUnavailableError("Response deletion status is temporarily unavailable.");
  return true;
}

/** Store no contact, answer, token or destination data in the durable receipt. */
export async function recordSubmissionDeletion(formId: string, owner: string, submissionId: string) {
  if (await submissionDeleted(formId, owner, submissionId)) return;
  try {
    await writeRecord("submission_deletions", receiptId(formId, owner, submissionId), owner,
      { formId, submissionId, deletedAt: Date.now() }, 0);
  } catch (error) {
    if (!(await submissionDeleted(formId, owner, submissionId))) throw error;
  }
}
