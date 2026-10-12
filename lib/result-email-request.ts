import { HttpError } from "./auth";
const MAX_BYTES = 4096;
/** Bound bytes while reading, including chunked bodies and multibyte UTF-8. */
export async function readResultEmailBody(req: Request): Promise<unknown> {
  if (Number(req.headers.get("content-length")) > MAX_BYTES) throw new HttpError(413, "The email request is too large.");
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "Choose a valid email request.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { void reader.cancel().catch(() => {}); throw new HttpError(413, "The email request is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new HttpError(400, "Choose a valid UTF-8 JSON email request."); }
}
