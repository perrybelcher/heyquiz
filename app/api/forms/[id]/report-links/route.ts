import { readJsonRequest } from "@/lib/errors";
import { apiError, checkOrigin, requireUser } from "@/lib/auth";
import { listResultLinks, revokeResultLink } from "@/lib/report-management";

type Context = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request, { params }: Context) {
  try {
    checkOrigin(req);
    const user = await requireUser(), { id } = await params;
    return Response.json(await listResultLinks(id, user.id, Number(new URL(req.url).searchParams.get("page") || 1), new URL(req.url).searchParams.get("responseId") || ""), { headers });
  } catch (error) { return apiError(error); }
}
export async function DELETE(req: Request, { params }: Context) {
  try {
    checkOrigin(req);
    const user = await requireUser(), { id } = await params, body = await readJsonRequest(req);
    return Response.json(await revokeResultLink(id, user.id, body?.responseId), { headers });
  } catch (error) { return apiError(error); }
}
