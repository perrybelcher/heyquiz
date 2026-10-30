import { readJsonRequest } from "@/lib/errors";
import { registerMetaAttempt } from "@/lib/meta/service";
import { verifiedLandingVisit } from "@/lib/landing-visits";
import { resolveExperiment } from "@/lib/experiments";
import { rateLimit } from "@/lib/rate-limit";
import { currentUser, apiError, checkOrigin, HttpError } from "@/lib/auth";
import { ownedForm } from "@/lib/storage";
import { readRecord } from "@/lib/records";
import { createAttempt } from "@/lib/attempts";
import { publicForm } from "@/lib/engine";
import { sanitizeStartAttribution } from "@/lib/attribution";
import type { FormSchemaType } from "@/lib/schema";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(req);
    rateLimit(req, "start", 40);
    const { id } = await params,
      body = await readJsonRequest(req);
    const preview = body.preview === true,
      user = preview ? await currentUser() : null;
    const published = await readRecord<FormSchemaType>("published", id);
    const experiment = body.experimentToken ? await resolveExperiment(body.experimentToken) : null;
    if (experiment && (preview || experiment.form.id !== id)) throw new HttpError(400, "Invalid experiment session.");
    const form = experiment?.form || (
      preview && user
        ? await ownedForm(id, user.id)
        : !preview
          ? published?.payload
          : null);
    if (!form) throw new HttpError(404, "This quiz is not published.");
    const owner = experiment ? experiment.row.owner_id : preview && user ? user.id : published!.owner_id;
    const shuffled = {
      ...form,
      questions: form.questions.map((q) => ({
        ...q,
        options: q.shuffleOptions
          ? q.options
              ?.map((o) => ({ o, r: Math.random() }))
              .sort((a, b) => a.r - b.r)
              .map((x) => x.o)
          : q.options,
      })),
    };
    if (!form.routing && form.settings.shuffleQuestions && !form.logicRules?.length)
      shuffled.questions = shuffled.questions
        .map((q) => ({ q, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .map((x) => x.q);
    const visitId = preview ? undefined : await verifiedLandingVisit(body.visitToken, id, owner, experiment?.assignment);
    const { token, attempt } = await createAttempt(shuffled, owner, preview, experiment?.assignment, preview ? undefined : sanitizeStartAttribution(body.attribution), visitId);
    if (!preview && shuffled.meta?.enabled) {
      try { const row = await import("@/lib/attempts").then(m => m.getAttempt(token, id)); await registerMetaAttempt(row, body.metaToken, req); }
      catch { console.error("Meta tracking registration will need a visitor retry."); }
    }
    return Response.json({
      token,
      form: publicForm(shuffled),
      startedAt: attempt.startedAt,
    });
  } catch (e) {
    return apiError(e);
  }
}
