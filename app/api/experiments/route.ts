import { createHash, randomUUID } from "node:crypto";
import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
import { listRecords, readRecord, writeRecord, removeRecord } from "@/lib/records";
import { experimentStats, type Experiment } from "@/lib/experiments";
import type { Attempt } from "@/lib/attempts";
import type { FormSchemaType, QuizSubmissionResult } from "@/lib/schema";
import { ExperimentLaunchSchema, experimentSnapshotJson, readExperimentBody, ExperimentRequestError, assertExperimentEvidencePlan } from "@/lib/experiment-plan";
import { EXPERIMENT_EVIDENCE_HEADER, ExperimentEvidenceSchema } from "@/lib/experiment-evidence";
import { verifyExperimentEvidence } from "@/lib/experiment-evidence-server";
const snapshotKey = (form: FormSchemaType) => createHash("sha256").update(experimentSnapshotJson(form)).digest("hex");
export async function GET() {
  try {
    const user = await requireUser();
    const [experiments, forms, attempts, submissions] = await Promise.all([listRecords<Experiment>("experiments", user.id), listRecords<FormSchemaType>("published", user.id), listRecords<Attempt>("attempts", user.id), listRecords<QuizSubmissionResult>("submissions", user.id)]);
    const saved = new Map(submissions.map(s => [s.id, s.payload]));
    const measured = attempts.map(a => ({ ...a.payload, completed: Boolean(a.payload.completed || saved.has(a.id)), result: saved.get(a.id) }));
    return Response.json({ forms: forms.map(r => ({ id: r.id, title: r.payload.title, captureEnabled: r.payload.capture?.enabled === true, snapshotKey: snapshotKey(r.payload) })), experiments: experiments.map(r => {
      const evidence = ExperimentEvidenceSchema.safeParse(r.payload.evidence);
      return { id: r.id, name: r.payload.name, active: r.payload.active, createdAt: r.payload.createdAt, ...(r.payload.plan ? { plan: r.payload.plan } : {}), ...(evidence.success ? { evidence: evidence.data } : {}), titles: r.payload.variants.map(f => f.title), stats: experimentStats(r.id, measured) };
    }).sort((a,b) => b.createdAt-a.createdAt) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { const response = apiError(e instanceof ExperimentRequestError ? new HttpError(e.status, e.message) : e); response.headers.set("Cache-Control", "private, no-store"); return response; }
}
export async function POST(req: Request) {
  try {
    try { checkOrigin(req); } catch { throw new HttpError(403, "This request came from another site."); }
    const user = await requireUser(), parsed = ExperimentLaunchSchema.safeParse(await readExperimentBody(req));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || "Check your experiment plan.");
    const body = parsed.data;
    const proof = req.headers.get(EXPERIMENT_EVIDENCE_HEADER);
    assertExperimentEvidencePlan(body, proof !== null);
    if (proof !== null) {
      const origin = req.headers.get("origin");
      if (origin && (new URL(origin).origin !== origin || new URL(origin).protocol !== new URL(req.url).protocol)) throw new HttpError(403, "This request came from another site.");
    }
    const forms = await Promise.all([body.a, body.b].map(id => readRecord<FormSchemaType>("published", id)));
    if (forms.some(f => !f || f.owner_id !== user.id)) throw new HttpError(404, "Publish both of your quizzes before creating a test.");
    if (body.plan) {
      if (forms.some((form, index) => snapshotKey(form!.payload) !== body.reviewedSnapshots![index])) throw new HttpError(409, "A published version changed. Refresh the versions and review your plan again; your inputs have been kept.");
      if (body.plan.primaryMetric === "leads" && forms.some(form => form!.payload.capture?.enabled !== true)) throw new HttpError(400, "Captured-contact rate needs contact capture enabled in both published versions. Choose completion rate or update and republish your quizzes.");
    }
    const evidence = proof === null ? undefined : await verifyExperimentEvidence(proof, user.id, body.a, snapshotKey(forms[0]!.payload));
    const id = randomUUID();
    await writeRecord<Experiment>("experiments", id, user.id, { name: body.name, createdAt: Date.now(), active: true, variants: [forms[0]!.payload, forms[1]!.payload], ...(body.plan ? { plan: body.plan } : {}), ...(evidence ? { evidence } : {}) }, 0);
    if (proof !== null) {
      try { await verifyExperimentEvidence(proof, user.id, body.a, snapshotKey(forms[0]!.payload)); }
      catch (error) {
        // Best-effort compensation, not a cross-record transaction. Remove only
        // this newly generated record if publication/lifecycle changed in flight.
        try {
          const fresh = await readRecord<Experiment>("experiments", id);
          if (!fresh || fresh.id !== id || fresh.kind !== "experiments" || fresh.owner_id !== user.id || fresh.version !== 1 || !await removeRecord("experiments", id, user.id)) throw Error();
        } catch { throw new HttpError(503, "The source changed while the test was being created and cleanup could not be confirmed. Reload your tests before trying again."); }
        throw error;
      }
    }
    return Response.json({ id }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { const response = apiError(e instanceof ExperimentRequestError ? new HttpError(e.status, e.message) : e); response.headers.set("Cache-Control", "private, no-store"); return response; }
}
