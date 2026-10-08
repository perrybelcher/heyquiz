import { randomUUID } from "node:crypto";
import { HttpError, signToken, verifyToken } from "./auth";
import { readRecord, writeRecord } from "./records";
import type { FormSchemaType, QuizSubmissionResult } from "./schema";
export interface Attempt {
  form: FormSchemaType;
  startedAt: number;
  expiresAt: number;
  preview: boolean;
  reached: string[];
  analyticsVersion?: 1;
  lastSeenAt?: number;
  lastQuestionId?: string;
  completedAt?: number;
  resultViewedAt?: number;
  offerClickedAt?: number;
  completed?: boolean;
  uploadCount?: number;
  result?: QuizSubmissionResult;
}
export async function createAttempt(
  form: FormSchemaType,
  owner: string,
  preview: boolean,
) {
  const id = randomUUID(),
    now = Date.now();
  const expiresAt = now + 24 * 3600000;
  const attempt: Attempt = {
    form,
    startedAt: now,
    expiresAt,
    preview,
    reached: [],
    analyticsVersion: 1,
    lastSeenAt: now,
  };
  await writeRecord("attempts", id, owner, attempt, 0);
  return { token: signToken({ id, formId: form.id, exp: expiresAt }), attempt };
}
export async function getAttempt(token: unknown, formId?: string) {
  if (typeof token !== "string")
    throw new HttpError(401, "Start the quiz before submitting.");
  const claims = verifyToken(token);
  if (
    !claims ||
    typeof claims.id !== "string" ||
    (formId && claims.formId !== formId)
  )
    throw new HttpError(401, "This quiz session has expired. Start again.");
  const row = await readRecord<Attempt>("attempts", claims.id);
  if (!row || row.payload.expiresAt < Date.now())
    throw new HttpError(401, "This quiz session has expired.");
  return row;
}
export function publicResult(
  result: QuizSubmissionResult,
  form: FormSchemaType,
): QuizSubmissionResult {
  return {
    ...result,
    answers: undefined,
    contact: undefined,
    contactCaptured: Boolean(result.contact || result.contactCaptured),
    grading: result.grading.map((g) =>
      form.settings.showAnswerKeyOnFinish
        ? g
        : { ...g, correctAnswer: "", explanation: undefined },
    ),
  };
}
