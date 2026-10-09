import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
import { readRecord, writeRecord } from "@/lib/records";
import { BrandProfileUpdate, type BrandProfileData } from "@/lib/brand-profiles";
import { z } from "zod";
type Context = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "private, no-store" };
async function owned(id: string, owner: string) {
  if (!z.string().uuid().safeParse(id).success) throw new HttpError(404, "Profile not found.");
  const row = await readRecord<BrandProfileData>("brand_profiles", id);
  if (!row || row.owner_id !== owner) throw new HttpError(404, "Profile not found.");
  return row;
}
export async function GET(_: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const row = await owned((await params).id, user.id);
    return Response.json({ ...row.payload, id: row.id, revision: row.version }, { headers });
  } catch (error) { return apiError(error); }
}
export async function PUT(req: Request, { params }: Context) {
  try {
    checkOrigin(req);
    const user = await requireUser();
    const row = await owned((await params).id, user.id);
    const { revision, ...input } = BrandProfileUpdate.parse(await req.json());
    if (revision !== row.version) throw new HttpError(409, "This profile changed in another tab. Refresh profiles before updating it.");
    const updated = await writeRecord<BrandProfileData>("brand_profiles", row.id, user.id, { ...input, updatedAt: new Date().toISOString() }, revision);
    return Response.json({ ...updated.payload, id: updated.id, revision: updated.version }, { headers });
  } catch (error) { return apiError(error); }
}
