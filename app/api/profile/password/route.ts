import { apiError, checkOrigin } from "@/lib/auth";
import { readJsonRequest } from "@/lib/errors";
import { changeProfilePassword } from "@/lib/profile";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export const maxDuration = 90;
const headers = { "Cache-Control": "private, no-store" };
export async function POST(req: Request) {
  try { checkOrigin(req); rateLimit(req, "profile-password", 6); return Response.json(await changeProfilePassword(await readJsonRequest(req), req.headers.get("x-pippi-account") || undefined), { headers }); }
  catch (error) { const response = apiError(error); response.headers.set("Cache-Control", headers["Cache-Control"]); return response; }
}
