import { HttpError } from "@/lib/auth";
import { applyLiveResultEmailEvent } from "@/lib/result-email-live";
import { readResultEmailWebhook, verifyResultEmailWebhook } from "@/lib/result-email-webhook";
export const runtime = "nodejs";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store" };
export async function POST(req: Request) {
  try {
    const raw = await readResultEmailWebhook(req);
    await applyLiveResultEmailEvent(verifyResultEmailWebhook(raw, req.headers));
    return Response.json({ received: true }, { headers });
  } catch (error) {
    // Payloads contain recipient data. Neither signatures nor raw events are logged.
    const status = error instanceof HttpError && [400, 413].includes(error.status) ? error.status : 503;
    return Response.json({ error: status === 503 ? "Delivery confirmation could not be recorded." : "Invalid delivery callback." }, { status, headers });
  }
}
