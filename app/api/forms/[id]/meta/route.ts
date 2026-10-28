import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
import { readJsonRequest } from "@/lib/errors";
import { ownedForm } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { MetaSchema } from "@/lib/meta/schema";
import { getMetaSetup, prepareMeta, testMeta } from "@/lib/meta/setup";
import { metaHistory } from "@/lib/meta/service";
import { metaDeliveryAllowed } from "@/lib/meta/graph";
type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(_req: Request, { params }: Context) {
  try {
    const user = await requireUser(), { id } = await params;
    if (!await ownedForm(id, user.id)) throw new HttpError(404, "Quiz not found.");
    return Response.json({ setup: (await getMetaSetup(user.id, id))?.payload || null, deliveries: await metaHistory(user.id, id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(req: Request, { params }: Context) {
  try {
    checkOrigin(req); const user = await requireUser(), { id } = await params; rateLimit(req, `meta-setup:${user.id}`, 12);
    if (!metaDeliveryAllowed()) throw new HttpError(409, "Meta is unavailable on this deployment.");
    const form = await ownedForm(id, user.id); if (!form) throw new HttpError(404, "Quiz not found.");
    const body = await readJsonRequest(req);
    if (body.action === "prepare") return Response.json({ setup: await prepareMeta(user.id, { ...form, meta: MetaSchema.parse(body.config) }) });
    if (body.action === "test") return Response.json({ setup: await testMeta(user.id, form, req, String(body.testCode || "")), message: "Meta accepted the test request. Confirm it in Test Events; this does not confirm attribution." });
    throw new HttpError(400, "Choose a Meta setup action.");
  } catch (error) { return apiError(error); }
}
