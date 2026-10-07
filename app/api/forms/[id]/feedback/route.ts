import { apiError, checkOrigin, HttpError } from "@/lib/auth";
import { getAttempt } from "@/lib/attempts";
import { gradeQuizSubmission } from "@/lib/scoring";
import { record, validationError } from "@/lib/engine";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(req);
    const { id } = await params,
      b = await req.json(),
      r = await getAttempt(b.token, id),
      form = r.payload.form;
    if (form.settings.feedbackMode !== "immediate")
      throw new HttpError(403, "Feedback is available after submission.");
    const q = form.questions.find((q) => q.id === b.questionId);
    if (!q) throw new HttpError(404, "Question not found.");
    const answer = record(b.answers)[q.id],
      error = validationError(q, answer);
    if (error) throw new HttpError(422, error);
    const grade = gradeQuizSubmission(
      { ...form, questions: [q], pages: undefined, logicRules: [] },
      { [q.id]: answer },
    );
    return Response.json(grade.grading[0] || null);
  } catch (e) {
    return apiError(e);
  }
}
