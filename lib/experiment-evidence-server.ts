import { createHash } from "node:crypto";
import { z } from "zod";
import { HttpError, signToken, verifyToken } from "./auth";
import { listRecords, readRecord, type StoredRecord } from "./records";
import { analyticsWordingKey, summarizeAnalytics } from "./analytics";
import { experimentSnapshotJson } from "./experiment-plan";
import { EXPERIMENT_EVIDENCE_LIFETIME, EXPERIMENT_EVIDENCE_PROOF_LIMIT, ExperimentEvidenceSchema, parseExperimentEvidence, parseExperimentEvidenceSelector, type ExperimentEvidence } from "./experiment-evidence";
import type { Attempt } from "./attempts";
import type { FormSchemaType, QuizSubmissionResult } from "./schema";

const purpose = "experiment-evidence-v1";
const unavailable = () => new HttpError(503, "Experiment evidence is temporarily unavailable. Refresh it or continue with a manual test plan.");
const changed = () => new HttpError(409, "The published source changed or the evidence expired. Refresh evidence and review the test again; your plan text is unchanged.");
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const wrapper = (row: StoredRecord<unknown>, kind: string, id: string, owner: string) => row.kind === kind && row.id === id && row.owner_id === owner && Number.isSafeInteger(row.version) && row.version >= 1;
export const experimentEvidenceSnapshot = (form: FormSchemaType) => createHash("sha256").update(experimentSnapshotJson(form)).digest("hex");

async function source(formId: string, owner: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(formId)) throw new HttpError(404, "Published source quiz not found.");
  const [draft, published] = await Promise.all([readRecord<FormSchemaType>("forms", formId), readRecord<FormSchemaType>("published", formId)]);
  if (!draft || !published || draft.owner_id !== owner || published.owner_id !== owner) throw new HttpError(404, "Publish the source quiz in your account before reviewing evidence.");
  if (!wrapper(draft, "forms", formId, owner) || !wrapper(published, "published", formId, owner) || !object(draft.payload) || draft.payload.id !== formId || !object(published.payload) || published.payload.id !== formId || !Array.isArray(published.payload.questions)) throw unavailable();
  const receiptId = createHash("sha256").update(JSON.stringify([owner, formId])).digest("hex");
  const retired = await readRecord<unknown>("result_report_revocations", receiptId);
  if (retired) {
    if (!wrapper(retired, "result_report_revocations", receiptId, owner) || !object(retired.payload) || Object.keys(retired.payload).length !== 1 || !Number.isSafeInteger(retired.payload.retiredAt) || (retired.payload.retiredAt as number) < 0) throw unavailable();
    throw new HttpError(410, "This source quiz ID was previously deleted. Use a new quiz ID for evidence-backed tests.");
  }
  return { form: published.payload, snapshot: experimentEvidenceSnapshot(published.payload) };
}
async function safely<T>(fn: () => Promise<T>) {
  try { return await fn(); } catch (error) { if (error instanceof HttpError) throw error; throw unavailable(); }
}
const proofSchema = z.object({ purpose: z.literal(purpose), owner: z.string().min(1).max(256), lifecycle: z.literal("never-retired"), issuedAt: z.number().int().nonnegative(), exp: z.number().int().nonnegative(), evidence: ExperimentEvidenceSchema }).strict();

/** Owner-scoped observation. No attempt IDs, answers, contact fields or proof appear in the display DTO. */
export async function prepareExperimentEvidence(formId: string, owner: string, input: unknown, now = Date.now()): Promise<{ evidence: ExperimentEvidence; proof: string }> {
  return safely(async () => {
    let selector;
    try { selector = parseExperimentEvidenceSelector(input); } catch (error) { throw new HttpError(400, (error as Error).message); }
    if (!Number.isSafeInteger(now) || now < 0) throw unavailable();
    const selected = await source(formId, owner), form = selected.form;
    const publishedAt = form.publishedAt;
    if (!publishedAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(publishedAt) || new Date(publishedAt).toISOString() !== publishedAt || Date.parse(publishedAt) > now) throw new HttpError(409, "Republish the source quiz before reviewing its publication-specific evidence.");
    const version = `published:${publishedAt}`;
    if (selector.filters.version && selector.filters.version !== version) throw new HttpError(409, "This cohort belongs to another or unknown publication. Select the current published version in Results, or remove evidence to set up a manual test.");
    const questions = form.questions.filter(q => q.id === selector.questionId);
    if (questions.length !== 1 || questions[0].type === "hidden" || analyticsWordingKey(questions[0]) !== selector.wordingKey) throw new HttpError(409, "The selected wording is not in the current published source quiz. Choose its measured published wording or remove the evidence.");
    const [attemptRows, submissionRows] = await Promise.all([listRecords<Attempt>("attempts", owner), listRecords<QuizSubmissionResult>("submissions", owner)]);
    const exactAttempts = attemptRows.filter(row => {
      if (row.owner_id !== owner || row.payload?.form?.id !== formId || row.payload.preview) return false;
      if (!wrapper(row, "attempts", row.id, owner)) throw unavailable();
      return experimentEvidenceSnapshot(row.payload.form) === selected.snapshot;
    });
    const submissions = submissionRows.filter(row => row.owner_id === owner && row.payload?.formId === formId).map(row => {
      if (!wrapper(row, "submissions", row.id, owner) || row.payload.id !== row.id) throw unavailable();
      return row.payload;
    });
    const effective = { ...selector.filters, version };
    const report = summarizeAnalytics(form, exactAttempts, submissions, selector.range, now, [], effective);
    const step = report.questions.find(q => q.questionId === selector.questionId && q.wordingKey === selector.wordingKey);
    if (!step || step.quiet < 1) throw new HttpError(409, "This exact published step has no quiet sessions in the selected cohort. Keep reviewing the data or create a manual test plan.");
    const evidence = parseExperimentEvidence({
      version: 1, formId, quizTitle: form.title, questionId: questions[0].id, questionTitle: questions[0].title, questionType: questions[0].type, wordingKey: selector.wordingKey,
      sourceSnapshot: selected.snapshot, publishedAt, requested: { range: selector.range, filters: selector.filters }, cohort: { range: selector.range, filters: effective },
      observedAt: new Date(now).toISOString(), cutoffAt: selector.range === "all" ? null : new Date(Date.parse(new Date(now).toISOString().slice(0, 10)) - (Number(selector.range) - 1) * 86400000).toISOString(),
      quietThresholdMinutes: 30, publicationNarrowed: !selector.filters.version,
      counts: { reached: step.reached, measured: step.measured, quiet: step.quiet, completed: step.completed },
    });
    // Publication and lifecycle may change during a full owner scan. Never sign a stale observation.
    if ((await source(formId, owner)).snapshot !== selected.snapshot) throw changed();
    const proof = signToken({ purpose, owner, lifecycle: "never-retired", issuedAt: now, exp: now + EXPERIMENT_EVIDENCE_LIFETIME, evidence });
    if (proof.length > EXPERIMENT_EVIDENCE_PROOF_LIMIT) throw new HttpError(422, "This step's wording or cohort labels are too large for portable test evidence. Use a manual test plan.");
    return { evidence, proof };
  });
}

/** Verify the reviewed observation; new traffic never substitutes new counts at launch. */
export async function verifyExperimentEvidence(proof: unknown, owner: string, sourceFormId: string, sourceSnapshot: string, now = Date.now()): Promise<ExperimentEvidence> {
  return safely(async () => {
    if (typeof proof !== "string" || proof.length > EXPERIMENT_EVIDENCE_PROOF_LIMIT || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(proof)) throw changed();
    const claims = proofSchema.safeParse(verifyToken(proof));
    if (!claims.success) throw changed();
    const value = claims.data;
    if (value.owner !== owner || value.evidence.formId !== sourceFormId || value.evidence.sourceSnapshot !== sourceSnapshot || value.issuedAt > now || value.exp <= now || value.exp !== value.issuedAt + EXPERIMENT_EVIDENCE_LIFETIME || value.evidence.observedAt !== new Date(value.issuedAt).toISOString()) throw changed();
    const current = await source(sourceFormId, owner);
    if (current.snapshot !== sourceSnapshot) throw changed();
    return parseExperimentEvidence(value.evidence);
  });
}
