import { createHash, timingSafeEqual } from "node:crypto";
import { drainLiveResultEmails } from "@/lib/result-email-live";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  const secret = process.env.RESULT_EMAIL_WORKER_SECRET || process.env.CRON_SECRET;
  const supplied = /^Bearer ([^\s]{32,512})$/.exec(req.headers.get("authorization") || "")?.[1];
  if (!secret || secret.length < 32 || !supplied || !timingSafeEqual(createHash("sha256").update(secret).digest(), createHash("sha256").update(supplied).digest())) return Response.json({ error: "Unauthorized." }, { status: 401, headers });
  try { const result = await drainLiveResultEmails(); return Response.json({ processed: result.processed, checked: result.checked }, { headers }); }
  catch { return Response.json({ error: "Email processing is temporarily unavailable." }, { status: 503, headers }); }
}
