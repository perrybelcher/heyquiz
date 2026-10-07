import { z } from "zod";
import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  connections,
  deliveryAllowed,
  integrationView,
  requireForm,
} from "@/lib/integrations/service";
import { finishHubspot, startHubspot } from "@/lib/integrations/nango";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("finish"), attemptId: z.string().uuid() }),
]);
export async function POST(req: Request, { params }: Context) {
  try {
    checkOrigin(req);
    const user = await requireUser(),
      { id } = await params;
    await requireForm(id, user.id);
    if (!deliveryAllowed())
      throw new HttpError(
        409,
        "HubSpot authorization is disabled on preview deployments.",
      );
    const action = Action.parse(await req.json());
    rateLimit(
      req,
      `hubspot-${action.action}:${user.id}`,
      action.action === "start" ? 10 : 60,
    );
    if (
      action.action === "start" &&
      (await connections(id, user.id)).length >= 10
    )
      throw new HttpError(422, "A quiz can have up to 10 connections.");
    const body =
      action.action === "start"
        ? await startHubspot(id, user.id)
        : await finishHubspot(id, user.id, action.attemptId).then((row) => ({
            connected: Boolean(row),
            connection: row ? integrationView(row) : undefined,
          }));
    return Response.json(body, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
