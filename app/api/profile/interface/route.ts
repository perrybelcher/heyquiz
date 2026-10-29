import { apiError, checkOrigin } from "@/lib/auth";
import { readJsonRequest } from "@/lib/errors";
import { getInterfacePreference, saveInterfacePreference } from "@/lib/interface-preferences";
import { rateLimit } from "@/lib/rate-limit";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try { return Response.json(await getInterfacePreference(), { headers }); }
  catch (error) { const response = apiError(error); response.headers.set("Cache-Control", headers["Cache-Control"]); return response; }
}
export async function PATCH(req: Request) {
  try { checkOrigin(req); rateLimit(req, "interface-save", 30); return Response.json(await saveInterfacePreference(await readJsonRequest(req), req.headers.get("x-pippi-account") || undefined), { headers }); }
  catch (error) { const response = apiError(error); response.headers.set("Cache-Control", headers["Cache-Control"]); return response; }
}
