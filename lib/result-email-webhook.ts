import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "./auth";
/** Resend uses Svix's versioned HMAC contract over the untouched UTF-8 body. */
export function verifyResultEmailWebhook(raw: string, headers: Headers, now = Date.now()): unknown {
  const secret = process.env.RESEND_WEBHOOK_SECRET || "", id = headers.get("svix-id") || "", timestamp = headers.get("svix-timestamp") || "", signatures = headers.get("svix-signature") || "";
  if (!/^whsec_[A-Za-z0-9+/]+=*$/.test(secret)) throw new HttpError(503, "Delivery callbacks are not configured.");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !/^\d{1,12}$/.test(timestamp) || Math.abs(Number(timestamp) * 1000 - now) > 300000 || signatures.length > 2048) throw new HttpError(400, "Invalid delivery signature.");
  const key = Buffer.from(secret.slice(6), "base64");
  if (key.length < 16 || key.length > 128) throw new HttpError(503, "Delivery callbacks are not configured.");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${raw}`).digest();
  const valid = signatures.split(" ").some(item => { const [version, encoded, extra] = item.split(","); if (version !== "v1" || extra || !/^[A-Za-z0-9+/]+=*$/.test(encoded || "")) return false; const actual = Buffer.from(encoded, "base64"); return actual.length === expected.length && timingSafeEqual(actual, expected); });
  if (!valid) throw new HttpError(400, "Invalid delivery signature.");
  try { return JSON.parse(raw); } catch { throw new HttpError(400, "Invalid delivery event."); }
}
export async function readResultEmailWebhook(req: Request) {
  const max = 65536;
  if (Number(req.headers.get("content-length")) > max) throw new HttpError(413, "Delivery event is too large.");
  const reader = req.body?.getReader(); if (!reader) throw new HttpError(400, "Invalid delivery event.");
  let size = 0; const chunks: Uint8Array[] = [];
  try { for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > max) { void reader.cancel().catch(() => {}); throw new HttpError(413, "Delivery event is too large."); } chunks.push(next.value); } }
  finally { reader.releaseLock(); }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)); } catch { throw new HttpError(400, "Invalid delivery event."); }
}
