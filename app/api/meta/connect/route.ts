import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
import { readJsonRequest } from "@/lib/errors";
import { ownedForm } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { beginMetaConnect, connectionView, disconnectMeta, getMetaConnection, metaAssets, selectMetaAssets } from "@/lib/meta/connection";
import { metaConfigured, metaDeliveryAllowed } from "@/lib/meta/graph";
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    const user = await requireUser(), row = await getMetaConnection(user.id);
    rateLimit(req, `meta-assets:${user.id}`, 60);
    const assets = new URL(req.url).searchParams.get("assets") === "1" && row && metaDeliveryAllowed() ? await metaAssets(user.id) : undefined;
    return Response.json({ configured: metaConfigured(), allowed: metaDeliveryAllowed(), connection: connectionView(row?.payload), assets }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req); const user = await requireUser(); rateLimit(req, `meta-connect:${user.id}`, 12);
    const body = await readJsonRequest(req);
    if (body.action === "disconnect") { await disconnectMeta(user.id); return Response.json({ disconnected: true }); }
    if (!metaDeliveryAllowed()) throw new HttpError(409, "Meta app setup is unavailable on this deployment.");
    if (body.action === "assets") return Response.json({ connection: await selectMetaAssets(user.id, String(body.adAccountId || ""), String(body.datasetId || "")) });
    const formId = String(body.formId || "");
    if (!await ownedForm(formId, user.id)) throw new HttpError(404, "Quiz not found.");
    return Response.json({ url: await beginMetaConnect(user.id, formId) });
  } catch (error) { return apiError(error); }
}
