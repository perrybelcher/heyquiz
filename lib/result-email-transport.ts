import { readRecord, writeRecord } from "./records";
import { requireResultEmailTest, sealResultEmail } from "./result-email-config";
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
