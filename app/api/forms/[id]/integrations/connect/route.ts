import { nangoProviders } from "@/lib/integrations/providers";
import { z } from "zod";
import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  connections,
  deliveryAllowed,
  integrationView,
  requireForm,
} from "@/lib/integrations/service";
import { finishProvider, startProvider } from "@/lib/integrations/nango";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), provider: z.enum(nangoProviders) }),
  z.object({ action: z.literal("finish"), provider: z.enum(nangoProviders), attemptId: z.string().uuid() }),
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
        "CRM authorization is disabled on preview deployments.",
      );
    const action = Action.parse(await req.json());
    rateLimit(
      req,
      `crm-connect-${action.action}:${user.id}`,
      action.action === "start" ? 10 : 60,
    );
    if (
      action.action === "start" &&
      (await connections(id, user.id)).length >= 10
    )
      throw new HttpError(422, "A quiz can have up to 10 connections.");
    const body =
      action.action === "start"
        ? await startProvider(action.provider, id, user.id)
        : await finishProvider(action.provider, id, user.id, action.attemptId).then((row) => ({
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
