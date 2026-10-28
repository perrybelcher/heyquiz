import { createHmac } from "node:crypto";
import { HttpError } from "../errors";
export class MetaApiError extends HttpError {
  constructor(public readonly code: number, public readonly retryable: boolean) {
    super(code === 190 ? 409 : code === 10 || code === 200 ? 422 : 502, code === 190 ? "Meta authorization expired or was revoked. Reconnect Meta." : code === 10 || code === 200 ? "Meta permission is missing. Reconnect with access to the selected assets." : "Meta could not complete the request. Review asset access and try again.");
  }
}
export function metaEnvironment() {
  const { META_APP_ID: appId, META_APP_SECRET: secret, META_LOGIN_CONFIG_ID: configId, META_GRAPH_VERSION: version, META_REDIRECT_URI: redirect } = process.env;
  if (!appId || !/^\d+$/.test(appId) || !secret || !configId || !/^\d+$/.test(configId) || !version || !/^v\d+\.\d+$/.test(version) || !redirect || !/^https:\/\//.test(redirect) && !(process.env.VERCEL !== "1" && /^http:\/\/localhost[:/]/.test(redirect))) throw new HttpError(503, "Meta connection is not configured. Ask your workspace administrator to finish Meta app setup.");
  return { appId, secret, configId, version, redirect };
}
export function metaConfigured() { try { metaEnvironment(); return process.env.META_ENABLED === "1"; } catch { return false; } }
export function metaDeliveryAllowed() { return metaConfigured() && (process.env.VERCEL !== "1" || process.env.VERCEL_ENV === "production"); }
export async function graph<T>(path: string, token: string, values: Record<string, string> = {}, method = "GET", proof = true): Promise<T> {
  const env = metaEnvironment();
  if (!/^[a-zA-Z0-9_/-]+$/.test(path)) throw new Error("Invalid Meta resource.");
  const params = new URLSearchParams(values);
  if (proof) params.set("appsecret_proof", createHmac("sha256", env.secret).update(token).digest("hex"));
  const url = `https://graph.facebook.com/${env.version}/${path}${method === "GET" && params.size ? `?${params}` : ""}`;
  let response: Response;
  try { response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(method !== "GET" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, ...(method !== "GET" ? { body: params } : {}), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) }); }
  catch { throw new MetaApiError(0, true); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) { const code = Number(body.error?.code) || 0; throw new MetaApiError(code, response.status === 429 || response.status >= 500 || [1, 2, 4, 17, 32, 613].includes(code) || body.error?.is_transient === true); }
  return body as T;
}
export async function graphList<T>(path: string, token: string, fields: string, max = 500): Promise<T[]> {
  const all: T[] = []; let after = "";
  for (let pages = 0; pages < 20; pages++) {
    const page = await graph<{ data: T[]; paging?: { next?: string; cursors?: { after?: string } } }>(path, token, { fields, limit: "100", ...(after ? { after } : {}) });
    if (!Array.isArray(page.data)) throw new MetaApiError(0, false);
    all.push(...page.data);
    if (!page.paging?.next) return all;
    const cursor = page.paging.cursors?.after;
    if (!cursor || cursor === after || all.length >= max) throw new HttpError(422, "This Meta account has too many assets to list safely. Use a business with fewer assigned assets.");
    after = cursor;
  }
  throw new HttpError(422, "Meta asset pagination did not complete.");
}
