import { randomUUID } from "node:crypto";
import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
import { listRecords, writeRecord } from "@/lib/records";
import { BrandProfileInput, type BrandProfileData } from "@/lib/brand-profiles";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await listRecords<BrandProfileData>("brand_profiles", user.id);
    return Response.json({ profiles: rows.map(r => ({ ...r.payload, id: r.id, revision: r.version })).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)) }, { headers });
  } catch (error) { return apiError(error); }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await requireUser();
    const input = BrandProfileInput.parse(await req.json());
    if ((await listRecords("brand_profiles", user.id)).length >= 50) throw new HttpError(400, "You can save up to 50 profiles.");
    const row = await writeRecord<BrandProfileData>("brand_profiles", randomUUID(), user.id, { ...input, updatedAt: new Date().toISOString() }, 0);
    return Response.json({ ...row.payload, id: row.id, revision: row.version }, { status: 201, headers });
  } catch (error) { return apiError(error); }
}
