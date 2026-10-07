import { dispatch } from "@/lib/integrations/service";
import { authorizeScheduler } from "@/lib/integrations/scheduler";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(req: Request) {
  try {
    if (!(await authorizeScheduler(req.headers.get("authorization"))))
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    return Response.json(await dispatch(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Delivery processing failed. Stored jobs will be retried." },
      { status: 503 },
    );
  }
}
