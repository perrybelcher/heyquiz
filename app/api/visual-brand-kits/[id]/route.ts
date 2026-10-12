import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
import { ConflictError, readRecord, writeRecord } from "@/lib/records";
import { VisualBrandKitDelete, VisualBrandKitRename, VisualBrandKitUpdate, isActiveVisualBrandKit, type StoredVisualBrandKit, type VisualBrandKitData } from "@/lib/visual-brand-kits";
import { z } from "zod";
type Context = {
    params: Promise<{
        id: string;
    }>;
};
const headers = { "Cache-Control": "private, no-store" };
async function owned(id: string, owner: string) {
    if (!z.string().uuid().safeParse(id).success)
        throw new HttpError(404, "Brand kit not found.");
    const row = await readRecord<StoredVisualBrandKit>("visual_brand_kits", id);
    if (!row || row.owner_id !== owner)
        throw new HttpError(404, "Brand kit not found.");
    return row;
}
function changed() { return new HttpError(409, "This brand kit changed in another tab. Refresh kits and review the latest version before trying again."); }
function kitError(error: unknown) { return apiError(error instanceof ConflictError ? changed() : error); }
async function input(req: Request) {
    const raw = await req.text();
    if (raw.length > 16000) throw new HttpError(413, "Brand kit is too large.");
    return JSON.parse(raw);
}
export async function GET(_: Request, { params }: Context) {
    try {
        const user = await requireUser();
        const row = await owned((await params).id, user.id);
        if (!isActiveVisualBrandKit(row.payload)) throw new HttpError(404, "Brand kit not found.");
        return Response.json({ ...row.payload, id: row.id, revision: row.version }, { headers });
    }
    catch (error) {
        return apiError(error);
    }
}
export async function PUT(req: Request, { params }: Context) {
    try {
        checkOrigin(req);
        const user = await requireUser();
        const row = await owned((await params).id, user.id);
        if (!isActiveVisualBrandKit(row.payload)) throw new HttpError(404, "Brand kit not found.");
        const { revision, ...changes } = VisualBrandKitUpdate.parse(await input(req));
        if (revision !== row.version)
            throw changed();
        const updated = await writeRecord<VisualBrandKitData>("visual_brand_kits", row.id, user.id, { ...changes, updatedAt: new Date().toISOString() }, revision);
        return Response.json({ ...updated.payload, id: updated.id, revision: updated.version }, { headers });
    }
    catch (error) {
        return kitError(error);
    }
}
export async function PATCH(req: Request, { params }: Context) {
    try {
        checkOrigin(req);
        const user = await requireUser(), row = await owned((await params).id, user.id);
        if (!isActiveVisualBrandKit(row.payload)) throw new HttpError(404, "Brand kit not found.");
        const { name, revision } = VisualBrandKitRename.parse(await input(req));
        if (revision !== row.version) throw changed();
        // Rename only the saved kit. Never take a theme from the request or editor.
        const updated = await writeRecord<VisualBrandKitData>("visual_brand_kits", row.id, user.id, { ...row.payload, name, updatedAt: new Date().toISOString() }, revision);
        return Response.json({ ...updated.payload, id: updated.id, revision: updated.version }, { headers });
    } catch (error) { return kitError(error); }
}
export async function DELETE(req: Request, { params }: Context) {
    try {
        checkOrigin(req);
        const user = await requireUser(), row = await owned((await params).id, user.id);
        const { revision } = VisualBrandKitDelete.parse(await input(req));
        if (!isActiveVisualBrandKit(row.payload)) {
            // Retry after a lost response is safe only for the revision deleted.
            if (revision !== row.version - 1) throw changed();
            return Response.json({ deleted: true, id: row.id }, { headers });
        }
        if (revision !== row.version) throw changed();
        try {
            await writeRecord<StoredVisualBrandKit>("visual_brand_kits", row.id, user.id, { deletedAt: new Date().toISOString() }, revision);
        } catch (error) {
            const concurrent = await owned(row.id, user.id);
            if (isActiveVisualBrandKit(concurrent.payload) || concurrent.version !== revision + 1) throw error;
        }
        return Response.json({ deleted: true, id: row.id }, { headers });
    } catch (error) { return kitError(error); }
}
