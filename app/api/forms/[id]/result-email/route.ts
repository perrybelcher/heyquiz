import { apiError, checkOrigin, HttpError } from "@/lib/auth";
import { readResultEmailBody } from "@/lib/result-email-request";
import { rateLimit } from "@/lib/rate-limit";
import { requireResultEmail } from "@/lib/result-email-config";
import { after } from "next/server";
import { authorizeLiveResultEmail, liveResultEmailJobId, liveResultEmailStatus, processLiveResultEmail, requestLiveResultEmail, retryLiveResultEmail, runLiveResultEmail } from "@/lib/result-email-live";
import { authorizeResultEmail, prepareResultEmail, requestResultEmail, resultEmailJobId, resultEmailStatus, retryResultEmail } from "@/lib/result-email";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const mode = requireResultEmail(req); checkOrigin(req); rateLimit(req, "result-email", 30);
    const parsed = await readResultEmailBody(req);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new HttpError(400, "Choose a valid test request.");
    const body = parsed as Record<string, unknown>;
    if (typeof body.action !== "string" || !["request", "status", "prepare", "retry"].includes(body.action)) throw new HttpError(400, "Choose a valid test action.");
    const { id } = await params;
    if (mode === "resend") {
      const allowed = body.action === "request" ? ["action", "token", "email", "requested"] : ["action", "token"];
      if (Object.keys(body).some(key => !allowed.includes(key))) throw new HttpError(400, "Choose a valid email request.");
      const attempt = await authorizeLiveResultEmail(body.token, id);
      rateLimit(req, `result-email-owner:${attempt.owner_id}`, 60);
      const jobId = liveResultEmailJobId(attempt.owner_id, id, attempt.id);
      let job;
      if (body.action === "request") job = await requestLiveResultEmail(attempt, body.email, body.requested);
      else if (body.action === "prepare") job = await processLiveResultEmail(jobId, attempt.owner_id);
      else if (body.action === "retry") job = await retryLiveResultEmail(attempt);
      else job = await liveResultEmailStatus(attempt, { refresh: true });
      if ((body.action === "request" || body.action === "retry") && job?.state === "queued") after(async () => { try { await runLiveResultEmail(jobId, attempt.owner_id); } catch { /* Durable job remains available to the worker. Never log message/recipient/token. */ } });
      return Response.json({ job, mode, sent: Boolean(job?.acceptedAt) }, { status: body.action === "request" ? 202 : 200, headers: { "Cache-Control": "private, no-store" } });
    }
    const attempt = await authorizeResultEmail(body.token, id);
    rateLimit(req, `result-email-owner:${attempt.owner_id}`, 60);
    let job;
    if (body.action === "request") job = await requestResultEmail(attempt, body.email, body.requested);
    else if (body.action === "prepare") job = await prepareResultEmail(resultEmailJobId(attempt.owner_id, id, attempt.id), attempt.owner_id);
    else if (body.action === "retry") job = await retryResultEmail(attempt);
    else job = await resultEmailStatus(attempt);
    return Response.json({ job, mode: "synthetic", sent: false }, { status: body.action === "request" ? 202 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { const response = apiError(error); response.headers.set("Cache-Control", "private, no-store"); return response; }
}
