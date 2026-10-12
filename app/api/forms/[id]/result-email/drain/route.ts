import { apiError, checkOrigin, HttpError, requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { requireResultEmail, resultEmailMode } from "@/lib/result-email-config";
import { drainLiveResultEmails, listLiveResultEmails } from "@/lib/result-email-live";
import { drainResultEmails } from "@/lib/result-email";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const mode = requireResultEmail(req); checkOrigin(req); rateLimit(req, "result-email-drain", 10);
    const user = await requireUser(), { id } = await params;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new HttpError(400, "Choose a valid quiz.");
    // Filtering by verified owner allows cancellation even if the quiz was deleted.
    return Response.json(mode === "resend" ? await drainLiveResultEmails(user.id, id) : await drainResultEmails(user.id, id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { const response = apiError(error); response.headers.set("Cache-Control", "private, no-store"); return response; }
}
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (resultEmailMode() !== "resend") return Response.json({ error: "Live delivery status is unavailable.", code: "RESULT_EMAIL_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    requireResultEmail(req);
    const user = await requireUser(), { id } = await params;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new HttpError(400, "Choose a valid quiz.");
    return Response.json(await listLiveResultEmails(user.id, id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { const response = apiError(error instanceof HttpError ? error : new HttpError(503, "Delivery status is temporarily unavailable. Please try again.")); response.headers.set("Cache-Control", "private, no-store"); return response; }
}
