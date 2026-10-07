import {
  ownedForm,
  getSubmissionsByFormId,
  deleteSubmission,
} from "@/lib/storage";
import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
import { listRecords } from "@/lib/records";
import type { Attempt } from "@/lib/attempts";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) {
  try {
    const u = await requireUser(),
      { id } = await params,
      f = await ownedForm(id, u.id);
    if (!f) throw new HttpError(404, "Quiz not found.");
    const submissions = await getSubmissionsByFormId(id, u.id),
      total = submissions.length,
      passedCount = submissions.filter((s) => s.passed).length;
    const tierDistribution: Record<string, number> = {};
    for (const s of submissions) {
      const key = s.marketing?.title || s.matchedTier?.title || "Completed";
      tierDistribution[key] = (tierDistribution[key] || 0) + 1;
    }
    const attempts = (await listRecords<Attempt>("attempts", u.id))
      .map((r) => r.payload)
      .filter((a) => a.form.id === id && !a.preview);
    const funnel = f.questions.map((q) => ({
      id: q.id,
      title: q.title,
      viewed: attempts.filter((a) => a.reached.includes(q.id)).length,
    }));
    return Response.json({
      formId: id,
      submissions,
      stats: {
        total,
        passedCount,
        failedCount: total - passedCount,
        passRate: total ? Math.round((passedCount / total) * 100) : 0,
        averageScore: total
          ? Math.round(
              submissions.reduce((n, s) => n + s.percentageScore, 0) / total,
            )
          : 0,
        tierDistribution,
        starts: attempts.length,
        completionRate: attempts.length
          ? Math.round(
              (attempts.filter((a) => a.completed).length / attempts.length) *
                100,
            )
          : 0,
        funnel,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(req: Request, { params }: Context) {
  try {
    checkOrigin(req);
    const u = await requireUser(),
      { id } = await params;
    if (!(await ownedForm(id, u.id)))
      throw new HttpError(404, "Quiz not found.");
    const sub = new URL(req.url).searchParams.get("submissionId");
    if (!sub || !(await deleteSubmission(sub, id, u.id)))
      throw new HttpError(404, "Response not found.");
    return Response.json({ success: true });
  } catch (e) {
    return apiError(e);
  }
}
