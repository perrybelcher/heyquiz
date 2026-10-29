import { ValidationError } from "./errors";
import { assertMetaReady } from "./meta/setup";
import { validateMarketing } from "./marketing";
import { validateLanding } from "./landing";
import { resolveResultEmailCopy } from "./result-email-copy";
import { HttpError } from "./auth";
import { revokeFormResultReports } from "./result-reports";
import { recordSubmissionDeletion } from "./submission-lifecycle";
import fs from "node:fs/promises";
import path from "node:path";
import {
  FormSchema,
  type FormSchemaType,
  type QuizSubmissionResult,
} from "./schema";
import { DEFAULT_FORMS } from "./default-forms";
import {
  cloudEnabled,
  listRecords,
  readRecord,
  writeRecord,
  removeRecord,
} from "./records";
import { validateFormReferences, orderedQuestions, choiceQuestionProblems } from "./engine";
export async function seedLocalForms(owner: string) {
  if (owner !== "local" || cloudEnabled() || (await readRecord("meta", "seed")))
    return;
  let forms: FormSchemaType[] = DEFAULT_FORMS;
  try {
    forms = (
      JSON.parse(
        await fs.readFile(path.join(process.cwd(), "data/forms.json"), "utf8"),
      ) as unknown[]
    ).map((value) => FormSchema.parse(value));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error(
        "The legacy form backup could not be imported. It has not been changed.",
      );
  }
  for (const form of forms) {
    if (!(await readRecord("forms", form.id))) {
      await writeRecord("forms", form.id, owner, form);
      await writeRecord("published", form.id, owner, form);
    }
  }
  try {
    const responses = JSON.parse(
      await fs.readFile(
        path.join(process.cwd(), "data/submissions.json"),
        "utf8",
      ),
    ) as QuizSubmissionResult[];
    for (const response of responses) {
      if (response.id && !(await readRecord("submissions", response.id)))
        await writeRecord("submissions", response.id, owner, response);
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error(
        "The legacy response backup could not be imported. It has not been changed.",
      );
  }
  await writeRecord("meta", "seed", owner, { done: true });
}
export async function getAllForms(owner: string): Promise<FormSchemaType[]> {
  await seedLocalForms(owner);
  const published = await listRecords<FormSchemaType>("published", owner);
  return (await listRecords<FormSchemaType>("forms", owner))
    .map((r) => ({
      ...r.payload,
      revision: r.version,
      publishedAt:
        published.find((p) => p.id === r.id)?.payload.publishedAt ||
        (published.some((p) => p.id === r.id)
          ? r.payload.createdAt || "published"
          : undefined),
    }))
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}
export async function getFormById(id: string): Promise<FormSchemaType | null> {
  const r = await readRecord<FormSchemaType>("forms", id);
  return r ? { ...r.payload, revision: r.version } : null;
}
export async function ownedForm(
  id: string,
  owner: string,
): Promise<FormSchemaType | null> {
  const r = await readRecord<FormSchemaType>("forms", id);
  return r?.owner_id === owner ? { ...r.payload, revision: r.version } : null;
}
export async function getPublishedForm(
  id: string,
): Promise<FormSchemaType | null> {
  return (await readRecord<FormSchemaType>("published", id))?.payload || null;
}
export async function saveForm(
  input: FormSchemaType,
  owner: string,
): Promise<FormSchemaType> {
  const form = FormSchema.parse(input);
  const previous = await ownedForm(form.id, owner);
  if (previous && previous.quizType !== form.quizType && (previous.quizType || form.quizType))
    throw new ValidationError("Change quiz type by creating a converted copy. The original quiz type cannot be changed in place.");
  validateFormReferences(form);
  validateMarketing(form);
  const questions = orderedQuestions(form),
    updatedAt = new Date().toISOString();
  const updated = {
    ...form,
    questions,
    updatedAt,
    createdAt: form.createdAt || updatedAt,
    pages: form.pages?.map((p) => ({
      ...p,
      questionIds: questions
        .filter((q) => (q.pageId || form.pages?.[0]?.id) === p.id)
        .map((q) => q.id),
    })),
  };
  const r = await writeRecord(
    "forms",
    form.id,
    owner,
    updated,
    form.revision || 0,
  );
  return { ...updated, revision: r.version };
}
export async function publishForm(form: FormSchemaType, owner: string) {
  await assertMetaReady(owner, form);
  const choiceProblems = choiceQuestionProblems(form);
  if (choiceProblems.length) throw new ValidationError(choiceProblems.map(problem => problem.message).join(" "));
  validateMarketing(form, true);
  validateLanding(form.coverPage, true);
  // A later title/brand edit can make previously valid token-expanded copy too
  // long. Keep the draft editable, but preserve the last valid public snapshot.
  if (form.resultEmailCopy !== undefined) {
    try {
      resolveResultEmailCopy(form.resultEmailCopy, { quizTitle: form.title, brandName: form.theme.brandName });
    } catch {
      throw new HttpError(422, "Review result-email copy before publishing. Its subject, introduction or sign-off is invalid or too long after inserting the quiz title and brand name.");
    }
  }
  if (!form.questions.length)
    throw new ValidationError("Add at least one question before publishing.");
  validateFormReferences(form);
  await writeRecord("published", form.id, owner, {
    ...form,
    publishedAt: new Date().toISOString(),
  });
}
/** Pause new public starts only. Keep drafts, attempts, responses and private reports intact. */
export async function pauseFormPublication(id: string, owner: string) {
  if (!(await ownedForm(id, owner))) return false;
  const published = await readRecord<FormSchemaType>("published", id);
  if (published && published.owner_id !== owner) return false;
  if (!published) return true;
  try { await removeRecord("published", id, owner); }
  catch (error) {
    // Two pause requests may both observe a local file before one removes it.
    if (await readRecord("published", id)) throw error;
  }
  return true;
}
export async function deleteForm(id: string, owner: string) {
  if (!(await ownedForm(id, owner))) return false;
  // Recreating a quiz with the same ID must not restore deleted private reports.
  await revokeFormResultReports(id, owner);
  await removeRecord("published", id, owner);
  return removeRecord("forms", id, owner);
}
export async function getSubmissionsByFormId(
  formId: string,
  owner: string,
): Promise<QuizSubmissionResult[]> {
  return (await listRecords<QuizSubmissionResult>("submissions", owner))
    .map((r) => r.payload)
    .filter((s) => s.formId === formId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
export async function saveSubmission(
  submission: QuizSubmissionResult,
  owner: string,
  id: string,
) {
  const data = { ...submission, id, submittedAt: new Date().toISOString() };
  const old = await readRecord<QuizSubmissionResult>("submissions", id);
  if (old) return old.payload;
  try {
    await writeRecord("submissions", id, owner, data, 0);
    return data;
  } catch (error) {
    const concurrent = await readRecord<QuizSubmissionResult>(
      "submissions",
      id,
    );
    if (concurrent?.owner_id === owner) return concurrent.payload;
    throw error;
  }
}
export async function deleteSubmission(
  id: string,
  formId: string,
  owner: string,
) {
  const s = await readRecord<QuizSubmissionResult>("submissions", id);
  if (!s || s.owner_id !== owner || s.payload.formId !== formId) return false;
  // Record the deletion first: an in-flight submission writer can otherwise
  // recreate the source row and make its old outbound job appear eligible.
  await recordSubmissionDeletion(formId, owner, id);
  return removeRecord("submissions", id, owner);
}
