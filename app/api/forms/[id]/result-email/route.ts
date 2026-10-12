import { apiError, checkOrigin, HttpError } from "@/lib/auth";
import { readResultEmailBody } from "@/lib/result-email-request";
import { rateLimit } from "@/lib/rate-limit";
import { requireResultEmailTest } from "@/lib/result-email-config";
import { authorizeResultEmail, prepareResultEmail, requestResultEmail, resultEmailJobId, resultEmailStatus, retryResultEmail } from "@/lib/result-email";
export const runtime = "nodejs";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireResultEmailTest(req); checkOrigin(req); rateLimit(req, "result-email", 30);
    const parsed = await readResultEmailBody(req);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new HttpError(400, "Choose a valid test request.");
    const body = parsed as Record<string, unknown>;
    if (typeof body.action !== "string" || !["request", "status", "prepare", "retry"].includes(body.action)) throw new HttpError(400, "Choose a valid test action.");
    const { id } = await params, attempt = await authorizeResultEmail(body.token, id);
    rateLimit(req, `result-email-owner:${attempt.owner_id}`, 60);
    let job;
    if (body.action === "request") job = await requestResultEmail(attempt, body.email, body.requested);
    else if (body.action === "prepare") job = await prepareResultEmail(resultEmailJobId(attempt.owner_id, id, attempt.id), attempt.owner_id);
    else if (body.action === "retry") job = await retryResultEmail(attempt);
    else job = await resultEmailStatus(attempt);
    return Response.json({ job, mode: "synthetic", sent: false }, { status: body.action === "request" ? 202 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
