import { recordFailure } from "./diagnostics";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HttpError, ServiceUnavailableError } from "./errors";
import { ACCOUNT_SESSION_COOKIE, accountKeyForUser, resolveAccountSession } from "./account-session";
import { safeAuthReturn } from "./auth-return-path";
export { HttpError } from "./errors";
export const localMode = () => process.env.HEYQUIZ_LOCAL_MODE === "1" && process.env.VERCEL !== "1";
function secret() {
  const v = process.env.SESSION_SECRET;
  if (!v || v.length < 32)
    throw new HttpError(503, "Set a SESSION_SECRET of at least 32 characters.");
  return v;
}
export function signToken(data: Record<string, unknown>) {
  const p = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${p}.${createHmac("sha256", secret()).update(p).digest("base64url")}`;
}
export function verifyToken(token: string): Record<string, unknown> | null {
  const [p, s] = token.split(".");
  if (!p || !s) return null;
  const expected = createHmac("sha256", secret()).update(p).digest(),
    actual = Buffer.from(s, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return null;
  try {
    const d = JSON.parse(Buffer.from(p, "base64url").toString());
    return typeof d.exp === "number" && d.exp > Date.now() ? d : null;
  } catch {
    return null;
  }
}
export async function currentUser(): Promise<{ id: string; accountKey: string; expiresAt?: number } | null> {
  const jar = await cookies(),
    local = jar.get("hq_local")?.value;
  if (localMode() && local) {
    const claims = verifyToken(local);
    if (claims?.role === "local") return { id: "local", accountKey: accountKeyForUser("local"), expiresAt: Number(claims.exp) };
  }
  // An invalid/revoked renewable session must never fall back to an older token.
  if (jar.get(ACCOUNT_SESSION_COOKIE)?.value) return resolveAccountSession();
  const access = jar.get("hq_access")?.value;
  if (!access || !process.env.SUPABASE_URL || !(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY))
    return null;
  let res: Response;
  try { res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY)!,
      Authorization: `Bearer ${access}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  }); } catch { throw new ServiceUnavailableError("Account service is temporarily unavailable. Your draft has been kept."); }
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new ServiceUnavailableError("Account service is temporarily unavailable. Your draft has been kept.");
  const user: { id?: string } = await res.json().catch(() => ({}));
  if (!user.id) throw new ServiceUnavailableError("Account service returned an invalid response. Please try again.");
  // Metadata only: the token has already been authenticated by Supabase above.
  let expiresAt: number | undefined;
  try { const exp = JSON.parse(Buffer.from(access.split(".")[1], "base64url").toString()).exp; if (Number.isFinite(exp)) expiresAt = exp * 1000; } catch { /* Legacy opaque tokens remain usable until provider rejection. */ }
  return { id: user.id, accountKey: accountKeyForUser(user.id), expiresAt };
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in to manage your quizzes.");
  return user;
}
export async function requirePageUser(returnTo?: string) {
  const user = await currentUser();
  if (!user) redirect(safeAuthReturn(returnTo) ? `/login?next=${encodeURIComponent(returnTo!)}` : "/login");
  return user;
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  // NextURL may canonicalize loopback hosts. Preserve the actual Host while
  // comparing the complete origin, including its scheme and port.
  const url = new URL(req.url);
  const expected = `${url.protocol}//${req.headers.get("host") || url.host}`;
  if (origin && origin !== expected)
    throw new HttpError(403, "This request came from another site.");
}
export function apiError(e: unknown) {
  const validation = e instanceof Error && e.name === "ZodError";
  const status =
    e instanceof HttpError
      ? e.status
      : validation ? 400 : 500;
  const message = status >= 500
    ? (status === 503 ? "Service is temporarily unavailable. Your changes have not been confirmed saved. Please retry." : "Something interrupted this request. Please retry or contact support with the reference.")
    : e instanceof Error ? e.message : "Request failed.";
  // Expected validation/auth failures stay quiet. Record unexpected failures and
  // service outages without logging messages, credentials or submitted answers.
  const reference = status >= 500 ? recordFailure("api", status) : undefined;
  return Response.json({ error: message, ...(reference ? { reference } : {}) },
    { status, headers: { "Cache-Control": "no-store", ...(reference ? { "X-Pippi-Reference": reference } : {}), ...(e instanceof HttpError && e.retryAfterSeconds !== undefined ? { "Retry-After": String(e.retryAfterSeconds) } : {}) } });
}
