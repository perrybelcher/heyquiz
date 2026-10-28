import { apiError, requireUser } from "@/lib/auth";
import { finishMetaConnect } from "@/lib/meta/connection";
import { metaEnvironment } from "@/lib/meta/graph";
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    const user = await requireUser(), params = new URL(req.url).searchParams;
    const origin = new URL(metaEnvironment().redirect).origin;
    if (params.has("error")) return Response.redirect(`${origin}/?meta=cancelled`, 303);
    const formId = await finishMetaConnect(user.id, params.get("state") || "", params.get("code") || "");
    return Response.redirect(`${origin}/editor/${encodeURIComponent(formId)}?section=integrate&meta=connected`, 303);
  } catch (error) { return apiError(error); }
}
