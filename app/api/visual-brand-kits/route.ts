import { randomUUID } from "node:crypto";
import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
import { listRecords, writeRecord } from "@/lib/records";
import { VisualBrandKitInput, isActiveVisualBrandKit, type StoredVisualBrandKit, type VisualBrandKitData } from "@/lib/visual-brand-kits";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
    try {
        const user = await requireUser();
        const rows = await listRecords<StoredVisualBrandKit>("visual_brand_kits", user.id);
        return Response.json({ kits: rows.flatMap(r => isActiveVisualBrandKit(r.payload) ? [{ ...r.payload, id: r.id, revision: r.version }] : []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }, { headers });
    }
    catch (error) {
        return apiError(error);
    }
}
export async function POST(req: Request) {
    try {
        checkOrigin(req);
        const user = await requireUser();
        const raw = await req.text();
        if (raw.length > 16000)
            throw new HttpError(413, "Brand kit is too large.");
        const input = VisualBrandKitInput.parse(JSON.parse(raw));
        if ((await listRecords<StoredVisualBrandKit>("visual_brand_kits", user.id)).filter(row => isActiveVisualBrandKit(row.payload)).length >= 50)
            throw new HttpError(400, "You can save up to 50 kits.");
        const row = await writeRecord<VisualBrandKitData>("visual_brand_kits", randomUUID(), user.id, { ...input, updatedAt: new Date().toISOString() }, 0);
        return Response.json({ ...row.payload, id: row.id, revision: row.version }, { status: 201, headers });
    }
    catch (error) {
        return apiError(error);
    }
}
