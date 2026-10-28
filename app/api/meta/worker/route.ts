import { authorizeScheduler } from "@/lib/integrations/scheduler";
import { dispatchMeta } from "@/lib/meta/service";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(req: Request) {
  if (!await authorizeScheduler(req.headers.get("authorization"))) return Response.json({ error: "Unauthorized." }, { status: 401 });
  try { return Response.json(await dispatchMeta(), { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return Response.json({ error: "Meta delivery will be retried." }, { status: 503 }); }
}
