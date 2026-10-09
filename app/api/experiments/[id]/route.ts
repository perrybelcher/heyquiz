import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
import { readRecord, writeRecord } from "@/lib/records";
import type { Experiment } from "@/lib/experiments";
export async function PATCH(req: Request, { params }: { params: Promise<{id:string}> }) {
  try {
    checkOrigin(req);
    const user = await requireUser(), { id } = await params, body = await req.json();
    if (typeof body.active !== "boolean") throw new HttpError(400, "Choose an experiment status.");
    const row = await readRecord<Experiment>("experiments", id);
    if (!row || row.owner_id !== user.id) throw new HttpError(404, "Experiment not found.");
    await writeRecord("experiments", id, user.id, { ...row.payload, active: body.active }, row.version);
    return Response.json({ ok: true });
  } catch (e) { return apiError(e); }
}
