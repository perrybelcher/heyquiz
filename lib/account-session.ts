import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { ConflictError, HttpError, ServiceUnavailableError } from "./errors";
import { cloudEnabled, readRecord, writeRecord, type StoredRecord } from "./records";

export const ACCOUNT_SESSION_COOKIE = "hq_session";
export const ACCOUNT_SESSION_LIFETIME = 30 * 24 * 60 * 60 * 1000;
const ACTIVITY_INTERVAL = 5 * 60 * 1000, REFRESH_AHEAD = 60000, LEASE_LIFETIME = 60000;
type Credentials = { accessToken: string; refreshToken: string; accessExpiresAt: number };
type Session = {
  version: 1; credentialBox?: string; expiresAt: number; lastActivityAt: number;
  revokedAt?: number; lease?: { claim: string; until: number };
};
type SessionRow = StoredRecord<Session>;
export type AccountSessionIdentity = { id: string; accountKey: string; expiresAt: number };
type ProviderSession = { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; user?: { id?: unknown } };
const unavailable = () => new ServiceUnavailableError("Account service is temporarily unavailable. Your draft has been kept.", 2);
const cookieOptions = () => ({ httpOnly: true, secure: !(process.env.HEYQUIZ_LOCAL_MODE === "1" && process.env.VERCEL !== "1"), sameSite: "lax" as const, path: "/" });
function key(purpose: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw unavailable();
  return Buffer.from(hkdfSync("sha256", secret, "pippi", purpose, 32));
}
export function accountKeyForUser(id: string) {
  return createHmac("sha256", key("account-draft-owner-v1")).update(id).digest("hex");
}
const recordId = (handle: string) => createHash("sha256").update(handle).digest("hex");
function checked(row: StoredRecord<unknown> | null): SessionRow | null {
  if (!row) return null;
  const p = row.payload as Session;
  if (!p || p.version !== 1 || !Number.isSafeInteger(p.expiresAt) || !Number.isSafeInteger(p.lastActivityAt)
    || (p.revokedAt !== undefined && !Number.isSafeInteger(p.revokedAt))
    || (!p.revokedAt && (typeof p.credentialBox !== "string" || p.credentialBox.length > 100000))
    || (p.lease && (typeof p.lease.claim !== "string" || !Number.isSafeInteger(p.lease.until)))) {
    throw new Error("Stored sign-in data could not be read.");
  }
  return row as SessionRow;
}
const active = (row: SessionRow | null): row is SessionRow => Boolean(row && !row.payload.revokedAt && row.payload.expiresAt > Date.now());
const read = async (id: string) => checked(await readRecord<unknown>("account_sessions", id));
function seal(credentials: Credentials, id: string, owner: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key("account-session-credentials-v1"), iv);
  cipher.setAAD(Buffer.from(`${id}:${owner}:v1`));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), bytes.toString("base64url")].join(".");
}
function open(row: SessionRow): Credentials {
  try {
    const [version, iv, tag, bytes, extra] = row.payload.credentialBox!.split(".");
    if (version !== "v1" || extra) throw Error();
    const cipher = createDecipheriv("aes-256-gcm", key("account-session-credentials-v1"), Buffer.from(iv, "base64url"));
    cipher.setAAD(Buffer.from(`${row.id}:${row.owner_id}:v1`)); cipher.setAuthTag(Buffer.from(tag, "base64url"));
    const value: Credentials = JSON.parse(Buffer.concat([cipher.update(Buffer.from(bytes, "base64url")), cipher.final()]).toString("utf8"));
    if (!value || typeof value.accessToken !== "string" || typeof value.refreshToken !== "string" || !Number.isSafeInteger(value.accessExpiresAt)) throw Error();
    return value;
  } catch { throw new Error("Stored sign-in data could not be opened."); }
}
function credentials(data: ProviderSession): Credentials {
  if (typeof data.access_token !== "string" || !data.access_token || data.access_token.length > 32768
    || typeof data.refresh_token !== "string" || !data.refresh_token || data.refresh_token.length > 32768
    || typeof data.expires_in !== "number" || !Number.isFinite(data.expires_in) || data.expires_in <= 0) {
    throw new HttpError(502, "Account service returned an invalid session.");
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token, accessExpiresAt: Date.now() + Math.floor(Math.min(data.expires_in, 86400) * 1000) };
}
function providerSettings() {
  const url = process.env.SUPABASE_URL, apiKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !apiKey) throw unavailable();
  return { url, apiKey };
}
async function provider(path: string, access?: string, body?: unknown, timeout = 15000) {
  const { url, apiKey } = providerSettings();
  try {
    return await fetch(`${url}/auth/v1/${path}`, {
      method: body === undefined ? "GET" : "POST", redirect: "error", cache: "no-store",
      headers: { apikey: apiKey, "Content-Type": "application/json", ...(access ? { Authorization: `Bearer ${access}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(timeout),
    });
  } catch { throw unavailable(); }
}
async function userFor(access: string): Promise<string | null> {
  const response = await provider("user", access);
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw unavailable();
  const data = await response.json().catch(() => null);
  if (!data || typeof data.id !== "string" || !data.id || data.id.length > 128) throw unavailable();
  return data.id as string;
}
async function revokeRow(row: SessionRow) {
  for (let n = 0; n < 5; n++) {
    if (row.payload.revokedAt) return;
    try {
      await writeRecord("account_sessions", row.id, row.owner_id, { ...row.payload, revokedAt: Date.now(), credentialBox: undefined, lease: undefined }, row.version);
      return;
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      const latest = await read(row.id); if (!latest) return; row = latest;
    }
  }
  throw unavailable();
}
/** An expired worker cannot invalidate credentials committed by a newer claim. */
async function invalidateRefresh(row: SessionRow): Promise<SessionRow | null> {
  try {
    await writeRecord("account_sessions", row.id, row.owner_id, { ...row.payload, revokedAt: Date.now(), credentialBox: undefined, lease: undefined }, row.version);
    return null;
  } catch (error) {
    if (!(error instanceof ConflictError)) throw error;
    const latest = await read(row.id);
    if (!active(latest)) return null;
    if (!latest.payload.lease && latest.payload.credentialBox !== row.payload.credentialBox) return latest;
    throw unavailable();
  }
}

/** Only login/callback routes call this: cookies are never mutated during a page render. */
export async function createAccountSession(data: ProviderSession): Promise<void> {
  // Filesystem sessions are useful for isolated tests and self-hosting, but not Vercel functions.
  if (process.env.VERCEL === "1" && !cloudEnabled()) throw unavailable();
  const token = credentials(data), owner = await userFor(token.accessToken);
  if (!owner || (data.user?.id !== undefined && data.user.id !== owner)) throw new HttpError(502, "Account service returned an invalid session.");
  const handle = randomBytes(32).toString("base64url"), id = recordId(handle), now = Date.now();
  const payload: Session = { version: 1, credentialBox: seal(token, id, owner), expiresAt: now + ACCOUNT_SESSION_LIFETIME, lastActivityAt: now };
  await writeRecord("account_sessions", id, owner, payload, 0);
  const jar = await cookies(), previous = jar.get(ACCOUNT_SESSION_COOKIE)?.value;
  if (previous && /^[A-Za-z0-9_-]{43}$/.test(previous)) {
    const old = await read(recordId(previous)); if (old) await revokeRow(old);
  }
  jar.set(ACCOUNT_SESSION_COOKIE, handle, { ...cookieOptions(), maxAge: ACCOUNT_SESSION_LIFETIME / 1000 });
  jar.delete("hq_access"); jar.delete("hq_local");
}

async function refreshed(initial: SessionRow): Promise<SessionRow | null> {
  let row = initial; const waitUntil = Date.now() + 2000;
  for (;;) {
    if (!active(row)) return null;
    if (!row.payload.lease && row.payload.credentialBox !== initial.payload.credentialBox) return row;
    if (row.payload.lease && row.payload.lease.until > Date.now()) {
      if (Date.now() >= waitUntil) throw unavailable();
      await new Promise(resolve => setTimeout(resolve, 50));
      const latest = await read(row.id); if (!latest) return null;
      // Another worker persisted a newer credential set. Use that exact receipt.
      if (!latest.payload.lease && latest.payload.credentialBox !== initial.payload.credentialBox) return active(latest) ? latest : null;
      row = latest; continue;
    }
    const claim = randomUUID(); let claimed: SessionRow;
    try { claimed = await writeRecord("account_sessions", row.id, row.owner_id, { ...row.payload, lease: { claim, until: Date.now() + LEASE_LIFETIME } }, row.version); }
    catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      if (Date.now() >= waitUntil) throw unavailable();
      const latest = await read(row.id); if (!latest) return null; row = latest; continue;
    }
    try {
      const old = open(claimed), response = await provider("token?grant_type=refresh_token", undefined, { refresh_token: old.refreshToken });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        // Unknown 4xx/configuration failures are outages, not proof the user signed out.
        if ([400, 401, 403].includes(response.status) && ["refresh_token_not_found", "refresh_token_already_used", "invalid_grant", "session_not_found", "session_expired", "user_banned", "user_not_found"].includes(body?.error_code || body?.code || body?.error)) {
          return await invalidateRefresh(claimed);
        }
        throw unavailable();
      }
      const next = credentials(body || {}), owner = await userFor(next.accessToken);
      if (owner !== claimed.owner_id || (body?.user?.id !== undefined && body.user.id !== owner)) return await invalidateRefresh(claimed);
      const credentialBox = seal(next, row.id, row.owner_id);
      try { return await writeRecord("account_sessions", row.id, row.owner_id, { ...claimed.payload, credentialBox, lease: undefined }, claimed.version); }
      catch (error) {
        const latest = await read(row.id);
        if (!active(latest)) return null;
        if (latest.payload.credentialBox === credentialBox && !latest.payload.lease) return latest;
        // A logout or another lease owner wins. Never overwrite it with stale credentials.
        if (error instanceof ConflictError) throw unavailable();
        throw error;
      }
    } catch (error) {
      // Release only this exact claim. A logout tombstone or newer rotation is authoritative.
      try { await writeRecord("account_sessions", claimed.id, claimed.owner_id, { ...claimed.payload, lease: undefined }, claimed.version); } catch { /* Recoverable lease expires after 60 seconds. */ }
      throw error;
    }
  }
}

/** Stable opaque handles allow server components and APIs to renew without Set-Cookie. */
export async function resolveAccountSession(options: { touch?: boolean } = {}): Promise<AccountSessionIdentity | null> {
  const jar = await cookies(), handle = jar.get(ACCOUNT_SESSION_COOKIE)?.value;
  if (!handle || !/^[A-Za-z0-9_-]{43}$/.test(handle)) return null;
  let row = await read(recordId(handle)); if (!active(row)) return null;
  let token = open(row), refreshedOnce = false;
  if (token.accessExpiresAt <= Date.now() + REFRESH_AHEAD) {
    row = await refreshed(row); if (!active(row)) return null;
    token = open(row); refreshedOnce = true;
  }
  let owner = await userFor(token.accessToken);
  if (!owner && !refreshedOnce) {
    row = await refreshed(row); if (!active(row)) return null;
    owner = await userFor(open(row).accessToken);
  }
  if (owner !== row.owner_id) { await revokeRow(row); return null; }
  // Re-read after provider I/O so a concurrent sign-out cannot restore an authenticated view.
  let latest = await read(row.id); if (!active(latest)) return null; row = latest;
  if (options.touch && Date.now() - row.payload.lastActivityAt >= ACTIVITY_INTERVAL) {
    for (let n = 0; n < 5; n++) {
      if (!active(row)) return null;
      if (row.payload.lease && row.payload.lease.until > Date.now()) throw unavailable();
      if (Date.now() - row.payload.lastActivityAt < ACTIVITY_INTERVAL) break;
      try {
        const now = Date.now();
        row = await writeRecord("account_sessions", row.id, row.owner_id, { ...row.payload, lastActivityAt: now, expiresAt: now + ACCOUNT_SESSION_LIFETIME }, row.version);
        jar.set(ACCOUNT_SESSION_COOKIE, handle, { ...cookieOptions(), maxAge: ACCOUNT_SESSION_LIFETIME / 1000 }); break;
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error;
        latest = await read(row.id); if (!active(latest)) return null; row = latest;
        if (n === 4) throw unavailable();
      }
    }
  }
  return { id: row.owner_id, accountKey: accountKeyForUser(row.owner_id), expiresAt: row.payload.expiresAt };
}

export async function revokeAccountSession(): Promise<void> {
  const jar = await cookies(), handle = jar.get(ACCOUNT_SESSION_COOKIE)?.value;
  let access: string | undefined;
  if (handle && /^[A-Za-z0-9_-]{43}$/.test(handle)) {
    const row = await read(recordId(handle));
    if (row && !row.payload.revokedAt) {
      try { access = open(row).accessToken; } catch { /* Corruption must not prevent revoking a known handle. */ }
      await revokeRow(row);
    }
  }
  if (handle) jar.delete(ACCOUNT_SESSION_COOKIE);
  if (access) {
    try { await provider("logout?scope=local", access, {}, 5000); } catch { /* Durable local revocation already denies every future use of this handle. */ }
  }
}
