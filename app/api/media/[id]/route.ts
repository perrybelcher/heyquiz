import fs from "node:fs/promises";
import path from "node:path";
import { apiError, currentUser, HttpError, verifyToken } from "@/lib/auth";
import {
  cloudEnabled,
  dataDirectory,
  readRecord,
  supabaseFetch,
} from "@/lib/records";
import type { Upload } from "../route";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params,
      row = await readRecord<Upload>("uploads", id);
    if (!row) throw new HttpError(404, "File not found.");
    const file = row.payload,
      token = new URL(req.url).searchParams.get("token");
    if (!file.public && (!token || verifyToken(token)?.uploadId !== id)) {
      const user = await currentUser();
      if (user?.id !== row.owner_id)
        throw new HttpError(401, "Sign in to download this attachment.");
    }
    const bytes = cloudEnabled()
      ? await (
          await supabaseFetch(`/storage/v1/object/heyquiz/${file.storagePath}`)
        ).arrayBuffer()
      : await fs.readFile(path.join(dataDirectory(), "files", file.owner, id));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": file.mime,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": file.public
          ? "public, max-age=3600"
          : "private, no-store",
        "Content-Disposition": `${file.mime.startsWith("image/") || file.mime.startsWith("audio/") || file.mime === "video/webm" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
