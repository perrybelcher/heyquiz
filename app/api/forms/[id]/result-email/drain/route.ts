import { apiError, checkOrigin, HttpError, requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { requireResultEmailTest } from "@/lib/result-email-config";
import { drainResultEmails } from "@/lib/result-email";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireResultEmailTest(req); checkOrigin(req); rateLimit(req, "result-email-drain", 10);
    const user = await requireUser(), { id } = await params;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new HttpError(400, "Choose a valid quiz.");
    // Filtering by verified owner allows cancellation even if the quiz was deleted.
    return Response.json(await drainResultEmails(user.id, id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
