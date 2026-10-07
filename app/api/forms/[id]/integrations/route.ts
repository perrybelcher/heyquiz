import { nangoProviders } from "@/lib/integrations/providers";
import { schedulerStatus } from "@/lib/integrations/scheduler";
import { nangoConfigured } from "@/lib/integrations/nango";
import { after } from "next/server";
import { z } from "zod";
import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  connections,
  integrationView,
  saveConnection,
  requireForm,
  deliveryHistory,
  createTest,
  retryDelivery,
  dispatch,
  deliveryAllowed,
} from "@/lib/integrations/service";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
export async function GET(_req: Request, { params }: Context) {
  try {
    const user = await requireUser(),
      { id } = await params;
    await requireForm(id, user.id);
    const scheduler = await schedulerStatus();
    return Response.json(
      {
        connections: (await connections(id, user.id)).map(integrationView),
        deliveries: await deliveryHistory(id, user.id),
        schedulerConfigured: scheduler.configured,
        schedulerCadence: scheduler.cadence,
        deliveryAllowed: deliveryAllowed(),
        nangoConfigured: nangoConfigured(),
        configuredProviders: nangoProviders.filter(p => nangoConfigured(p)),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function PUT(req: Request, { params }: Context) {
  try {
    checkOrigin(req);
    if (!deliveryAllowed())
      throw new HttpError(
        409,
        "Configure and test integrations on production or locally. Preview delivery is disabled.",
      );
    const user = await requireUser(),
      { id } = await params;
    rateLimit(req, `integration-save:${user.id}`, 30);
    const saved = await saveConnection(id, user.id, await req.json());
    return Response.json(saved, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return apiError(e);
  }
}
const Action = z.object({
  action: z.enum(["test", "retry", "dispatch"]),
  id: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,128}$/)
    .optional(),
});
export async function POST(req: Request, { params }: Context) {
  try {
    checkOrigin(req);
    if (!deliveryAllowed())
      throw new HttpError(
        409,
        "Configure and test integrations on production or locally. Preview delivery is disabled.",
      );
    const user = await requireUser(),
      { id } = await params;
    await requireForm(id, user.id);
    rateLimit(req, `integration-action:${user.id}`, 15);
    const body = Action.parse(await req.json());
    if ((body.action === "test" || body.action === "retry") && !body.id)
      throw new Error("Select a connection or delivery.");
    let deliveryId: string | undefined;
    if (body.action === "test")
      deliveryId = await createTest(id, user.id, body.id!);
    if (body.action === "retry") await retryDelivery(id, user.id, body.id!);
    after(async () => {
      try {
        await dispatch(user.id, id);
      } catch {
        console.error(
          "Integration dispatch failed; saved delivery records can be retried.",
        );
      }
    });
    return Response.json({ queued: true, deliveryId }, { status: 202 });
  } catch (e) {
    return apiError(e);
  }
}
