import { rateLimit } from "@/lib/rate-limit";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  apiError,
  checkOrigin,
  currentUser,
  HttpError,
  signToken,
} from "@/lib/auth";
import { getAttempt } from "@/lib/attempts";
import {
  cloudEnabled,
  dataDirectory,
  supabaseFetch,
  writeRecord,
} from "@/lib/records";
export interface Upload {
  owner: string;
  attemptId?: string;
  name: string;
  mime: string;
  size: number;
  public: boolean;
  storagePath: string;
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    rateLimit(req, "upload", 40);
    if (Number(req.headers.get("content-length") || 0) > 11 * 1024 * 1024)
      throw new HttpError(413, "Files must be 10 MB or smaller.");
    const data = await req.formData(),
      file = data.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Choose a file.");
    if (file.size > 10 * 1024 * 1024 || file.size === 0)
      throw new HttpError(413, "Choose a nonempty file up to 10 MB.");
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
      "text/plain",
      "text/csv",
      "audio/webm",
      "audio/ogg",
      "audio/wav",
      "audio/mpeg",
      "audio/mp4",
      "video/webm",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const mime = file.type.split(";")[0];
    if (!allowed.includes(mime))
      throw new HttpError(
        415,
        "This file type is not supported. Use an image, PDF, document, or audio file.",
      );
    const user = await currentUser(),
      attempt = data.get("token") ? await getAttempt(data.get("token")) : null;
    if (!user && !attempt)
      throw new HttpError(401, "Sign in or start a quiz before uploading.");
    if (attempt?.payload.completed)
      throw new HttpError(409, "This quiz has already been submitted.");
    if (attempt && (attempt.payload.uploadCount || 0) >= 25)
      throw new HttpError(429, "This response has reached its upload limit.");
    const owner = attempt?.owner_id || user!.id,
      id = randomUUID(),
      storagePath = `${owner}/${id}`;
    const publicImage = Boolean(user && !attempt && mime.startsWith("image/"));
    const metadata: Upload = {
      owner,
      attemptId: attempt?.id,
      name: file.name.replace(/[\r\n"\\]/g, "_").slice(0, 180),
      mime,
      size: file.size,
      public: publicImage,
      storagePath,
    };
    const bytes = await file.arrayBuffer();
    if (cloudEnabled())
      await supabaseFetch(`/storage/v1/object/heyquiz/${storagePath}`, {
        method: "POST",
        headers: { "Content-Type": mime },
        body: bytes,
      });
    else {
      const dir = path.join(dataDirectory(), "files", owner);
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
      await fs.writeFile(path.join(dir, id), Buffer.from(bytes), {
        mode: 0o600,
        flag: "wx",
      });
    }
    await writeRecord("uploads", id, owner, metadata, 0);
    if (attempt)
      await writeRecord(
        "attempts",
        attempt.id,
        owner,
        {
          ...attempt.payload,
          uploadCount: (attempt.payload.uploadCount || 0) + 1,
        },
        attempt.version,
      );
    const link = publicImage
      ? `/api/media/${id}`
      : `/api/media/${id}?token=${signToken({ uploadId: id, exp: Date.now() + 86400000 })}`;
    return Response.json({
      id,
      name: metadata.name,
      url: link,
      size: file.size,
      mime,
    });
  } catch (e) {
    return apiError(e);
  }
}
