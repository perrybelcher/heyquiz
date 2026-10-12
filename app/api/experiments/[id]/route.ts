import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
import { readRecord, writeRecord } from "@/lib/records";
import type { Experiment } from "@/lib/experiments";
import { z } from "zod";
import { readExperimentBody, ExperimentRequestError } from "@/lib/experiment-plan";
const StatusSchema = z.object({ active: z.boolean() }).strict();
export async function PATCH(req: Request, { params }: { params: Promise<{id:string}> }) {
  try {
    checkOrigin(req);
    const user = await requireUser(), { id } = await params, parsed = StatusSchema.safeParse(await readExperimentBody(req, 256));
    if (!parsed.success) throw new HttpError(400, "Only pause or resume can be changed. Create a new experiment for a different plan or versions.");
    const body = parsed.data;
    const row = await readRecord<Experiment>("experiments", id);
    if (!row || row.owner_id !== user.id) throw new HttpError(404, "Experiment not found.");
    await writeRecord("experiments", id, user.id, { ...row.payload, active: body.active }, row.version);
    return Response.json({ ok: true });
  } catch (e) { return apiError(e instanceof ExperimentRequestError ? new HttpError(e.status, e.message) : e); }
}
