import { createCipheriv, createDecipheriv, hkdfSync, createHmac, randomBytes } from "node:crypto";
import { HttpError, localMode } from "./auth";
import { cloudEnabled } from "./records";
export type ResultEmailMode = "synthetic" | "resend";
export function resultEmailAvailable() {
  return resultEmailMode() !== null;
}
export function resultEmailMode(): ResultEmailMode | null {
  if (process.env.HEYQUIZ_RESULT_EMAIL_MODE === "resend") {
    try { liveResultEmailSettings(); return "resend"; } catch { return null; }
  }
  return syntheticResultEmailAvailable() ? "synthetic" : null;
}
function syntheticResultEmailAvailable() {
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
  if (!syntheticResultEmailAvailable()) throw new HttpError(503, "Result email tests are unavailable. No email has been sent.");
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
/** One plain ASCII mailbox, never a display-name/list/header. Reject controls before trimming. */
export function resultEmailAddress(value: unknown) {
  if (typeof value !== "string" || /[\x00-\x20\x7f,;<>"()\\]/.test(value.trim()) || /[\r\n\x00-\x1f\x7f]/.test(value)) throw new HttpError(400, "Enter one valid email address.");
  const email = value.trim().toLowerCase(), parts = email.split("@");
  if (email.length > 254 || parts.length !== 2 || !parts[0] || parts[0].length > 64 || !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(parts[0]) || /(^\.|\.$|\.\.)/.test(parts[0]) || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(parts[1])) throw new HttpError(400, "Enter one valid email address.");
  return email;
}
export function liveResultEmailSettings() {
  const unavailable = () => new HttpError(503, "Result email delivery is unavailable. Your private result link is still available.");
  if (process.env.HEYQUIZ_RESULT_EMAIL_MODE !== "resend" || localMode() || process.env.HEYQUIZ_LOCAL_MODE === "1" || !cloudEnabled() || (process.env.VERCEL && process.env.VERCEL_ENV !== "production") || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32 || !process.env.RESEND_API_KEY) throw unavailable();
  let origin: URL;
  try { origin = new URL(process.env.APP_URL || ""); } catch { throw unavailable(); }
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || origin.port || ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) throw unavailable();
  const from = process.env.RESULT_EMAIL_FROM || "";
  const match = /^([A-Za-z0-9 ._-]{1,80}) <([^<>]+)>$/.exec(from);
  try { if (match) resultEmailAddress(match[2]); else if (from !== resultEmailAddress(from)) throw unavailable(); } catch { throw unavailable(); }
  return { apiKey: process.env.RESEND_API_KEY, from, origin: origin.origin };
}
export function requireResultEmail(req?: Request): ResultEmailMode {
  const mode = resultEmailMode();
  if (!mode) throw new HttpError(503, "Result email delivery is unavailable. Your private result link is still available.");
  if (mode === "synthetic") requireResultEmailTest(req);
  // Browser actions are same-origin; webhook/worker authorization is separate.
  if (req && mode === "resend") {
    const origin = req.headers.get("origin"), url = new URL(req.url), host = req.headers.get("host") || url.host;
    if (origin && origin !== `${url.protocol}//${host}`) throw new HttpError(403, "This request came from another site.");
  }
  return mode;
}
function liveKey() {
  liveResultEmailSettings();
  return Buffer.from(hkdfSync("sha256", process.env.SESSION_SECRET!, "pippi", "result-email-resend-v2", 32));
}
export function liveRecipientDigest(value: string, scope: string) {
  return createHmac("sha256", liveKey()).update(`${scope}:recipient:${value}`).digest("hex");
}
export function sealLiveResultEmail(value: unknown, scope: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", liveKey(), iv);
  cipher.setAAD(Buffer.from(scope));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v2", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), bytes.toString("base64url")].join(".");
}
export function openLiveResultEmail(value: string, scope: string): unknown {
  try {
    const [version, iv, tag, bytes, extra] = value.split(".");
    if (version !== "v2" || extra) throw Error();
    const decipher = createDecipheriv("aes-256-gcm", liveKey(), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(scope)); decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(bytes, "base64url")), decipher.final()]).toString("utf8"));
  } catch { throw new HttpError(503, "The saved delivery request could not be opened."); }
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
