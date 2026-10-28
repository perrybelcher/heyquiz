import { after } from "next/server";
import { apiError, checkOrigin, HttpError } from "@/lib/auth";
import { readJsonRequest } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { getAttempt } from "@/lib/attempts";
import { readRecord } from "@/lib/records";
import type { FormSchemaType } from "@/lib/schema";
import { resolveExperiment } from "@/lib/experiments";
import { captureMetaAttempt, createMetaVisit, dispatchMeta, registerMetaAttempt, revokeMeta } from "@/lib/meta/service";
export const runtime = "nodejs";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(req); rateLimit(req, "meta-events", 90);
    if (Number(req.headers.get("content-length")) > 16000) throw new HttpError(413, "Tracking request is too large.");
    const { id } = await params, body = await readJsonRequest(req);
    const published = await readRecord<FormSchemaType>("published", id);
    if (!published) throw new HttpError(404, "Quiz not published.");
    const owner = published.owner_id;
    if (body.action === "revoke") { await revokeMeta(body.metaToken, owner, id); return Response.json({ revoked: true }); }
    let response: unknown;
    if (body.action === "visit") {
      if (body.consent !== true) throw new HttpError(422, "Advertising tracking consent is required.");
      const experiment = body.experimentToken ? await resolveExperiment(body.experimentToken) : undefined;
      if (experiment && (experiment.row.owner_id !== owner || experiment.form.id !== id)) throw new HttpError(403, "Invalid experiment.");
      response = await createMetaVisit(owner, experiment?.form || published.payload, req, String(body.viewKey || ""), body.context);
    } else if (body.action === "sync") {
      const attempt = await getAttempt(body.attemptToken, id);
      if (attempt.owner_id !== owner || attempt.payload.preview) throw new HttpError(403, "Invalid tracking attempt.");
      await registerMetaAttempt(attempt, body.metaToken, req, body.metaContext || body.context);
      response = await captureMetaAttempt(owner, attempt.id) || { pending: true };
    } else throw new HttpError(400, "Choose a tracking action.");
    after(async () => { try { await dispatchMeta(owner); } catch { console.error("Meta worker retry required."); } });
    return Response.json(response, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
