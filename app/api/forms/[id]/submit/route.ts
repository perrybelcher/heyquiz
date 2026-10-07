import type { QuizSubmissionResult } from "@/lib/schema";
import { parseContact } from "@/lib/contacts";
import { evaluateMarketing } from "@/lib/marketing";
import { apiError, checkOrigin, HttpError } from "@/lib/auth";
import { getAttempt, publicResult } from "@/lib/attempts";
import { saveSubmission } from "@/lib/storage";
import { writeRecord, readRecord } from "@/lib/records";
import { gradeQuizSubmission } from "@/lib/scoring";
import {
  record,
  resolvePath,
  validationError,
  type Answers,
} from "@/lib/engine";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(req);
    const { id } = await params,
      b = await req.json(),
      r = await getAttempt(b.token, id),
      a = r.payload,
      form = a.form;
    if (a.result) {
      const stored = !a.preview ? await readRecord<QuizSubmissionResult>("submissions", r.id) : null;
      return Response.json(publicResult(stored?.owner_id === r.owner_id ? stored.payload : a.result, form));
    }
    const contact = form.capture?.placement === "before_results" ? parseContact(form.capture, b.contact, form.revision) : undefined;
    const answers: Answers = record(b.answers);
    const path = resolvePath(form, answers);
    const timedOut = Boolean(
      form.settings.timerMinutes &&
        Date.now() - a.startedAt >= form.settings.timerMinutes * 60000,
    );
    const clean: Answers = {};
    for (const q of path.questions) {
      const value = answers[q.id];
      const error = validationError(q, value);
      if (error && !timedOut) throw new HttpError(422, `${q.title}: ${error}`);
      if (
        ["file_upload", "image_upload", "audio_recorder"].includes(q.type) &&
        value
      ) {
        const upload = await readRecord<{
          attemptId?: string;
          size: number;
          mime: string;
        }>("uploads", String(record(value).id));
        if (!upload || upload.payload.attemptId !== r.id)
          throw new HttpError(
            422,
            "The attachment does not belong to this response.",
          );
        if (
          upload.payload.size >
          Math.min(q.maxFileSizeMB || 10, 10) * 1024 * 1024
        )
          throw new HttpError(
            422,
            "The attachment exceeds this field’s size limit.",
          );
        if (
          q.type === "image_upload" &&
          !upload.payload.mime.startsWith("image/")
        )
          throw new HttpError(422, "This field requires an image.");
        if (
          q.type === "audio_recorder" &&
          !upload.payload.mime.startsWith("audio/")
        )
          throw new HttpError(422, "This field requires audio.");
      }
      if (q.type === "captcha" && !timedOut) {
        if (!process.env.TURNSTILE_SECRET_KEY)
          throw new HttpError(503, "Security verification is not configured.");
        const verification = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            body: new URLSearchParams({
              secret: process.env.TURNSTILE_SECRET_KEY,
              response: String(value || ""),
            }),
          },
        );
        const checked = await verification.json();
        if (!checked.success)
          throw new HttpError(
            422,
            "Please complete the security challenge again.",
          );
      }
      if (q.type !== "password") clean[q.id] = value;
    }
    const result = gradeQuizSubmission(form, clean);
    result.answers = clean;
    if (!a.preview) result.contact = contact;
    result.contactCaptured = Boolean(contact);
    result.marketing = evaluateMarketing(form, clean);
    const name = path.questions.find(
      (q) => q.type === "full_name" || q.type === "email",
    );
    if (name)
      result.respondentName = result.grading.find(
        (g) => g.questionId === name.id,
      )?.userAnswer;
    const saved = a.preview
      ? result
      : await saveSubmission(result, r.owner_id, r.id);
    await writeRecord("attempts", r.id, r.owner_id, {
      ...a,
      completed: true,
      result: saved,
    });
    return Response.json(publicResult(saved, form));
  } catch (e) {
    return apiError(e);
  }
}
