import { apiError, checkOrigin } from "@/lib/auth";
import { getAttempt } from "@/lib/attempts";
import { writeRecord } from "@/lib/records";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(req);
    const { id } = await params,
      b = await req.json(),
      r = await getAttempt(b.token, id);
    const reached =
      typeof b.questionId === "string" &&
      r.payload.form.questions.some((q) => q.id === b.questionId)
        ? [...new Set([...r.payload.reached, b.questionId])]
        : r.payload.reached;
    await writeRecord(
      "attempts",
      r.id,
      r.owner_id,
      { ...r.payload, reached },
      r.version,
    );
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
