import { createCipheriv, createDecipheriv, hkdfSync, createHmac, randomBytes } from "node:crypto";
import { HttpError, localMode } from "./auth";
/** This batch has no outbound transport. Every gate must be explicitly satisfied. */
export function resultEmailAvailable() {
  if (process.env.HEYQUIZ_RESULT_EMAIL_MODE !== "synthetic" || !localMode() || process.env.VERCEL || process.env.VERCEL_ENV) return false;
  if (["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"].some(name => Boolean(process.env[name]))) return false;
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) return false;
  try { localEmailOrigin(); return true; } catch { return false; }
}
export function localEmailOrigin() {
  const raw = process.env.HEYQUIZ_RESULT_EMAIL_ORIGIN;
  if (!raw) throw new HttpError(503, "Local result email tests are not configured.");
  let url: URL;
  try { url = new URL(raw); } catch { throw new HttpError(503, "Local result email tests are not configured."); }
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new HttpError(503, "Local result email tests require a configured loopback origin.");
  return url.origin;
}
export function requireResultEmailTest(req?: Request) {
  if (!resultEmailAvailable()) throw new HttpError(503, "Result email tests are unavailable. No email has been sent.");
  if (req) {
    const address = new URL(req.url), configured = new URL(localEmailOrigin());
    // NextURL canonicalizes 127.0.0.1 and ::1 to localhost. Validate the actual
    // Host instead of that rewritten hostname; forwarded headers are never used.
    const host = req.headers.get("host") || address.host, origin = req.headers.get("origin");
    if (address.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(address.hostname) || host !== configured.host || (origin !== null && origin !== configured.origin)) {
      throw new HttpError(403, "Use the configured local test address.");
    }
  }
}
function key() {
  requireResultEmailTest();
  return Buffer.from(hkdfSync("sha256", process.env.SESSION_SECRET!, "pippi", "result-email-synthetic-v1", 32));
}
export function recipientDigest(value: string, scope: string) {
  return createHmac("sha256", key()).update(`${scope}:recipient:${value}`).digest("hex");
}
export function sealResultEmail(value: Record<string, string>, scope: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(scope));
  const payload = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), payload.toString("base64url")].join(".");
}
export function openResultEmail(value: string, scope: string): Record<string, string> {
  try {
    const [version, iv, tag, data, extra] = value.split(".");
    if (version !== "v1" || extra) throw Error();
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(scope)); decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8"));
  } catch { throw new Error("The encrypted test copy could not be opened."); }
}
