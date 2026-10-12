/** Start-session attribution only. Never store URLs, query strings, click IDs or IP addresses. */
export interface StartAttribution {
  version: 1;
  source?: string;
  medium?: string;
  campaign?: string;
  referrerHost?: string;
}
const label = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  // Accept short campaign labels; drop obvious emails, telephone numbers and URLs.
  if (!trimmed || trimmed.length > 80 || !/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(trimmed) || /(?:\d[ ._-]*){7,}/.test(trimmed)) return undefined;
  return trimmed;
};
const host = (value: unknown): string | undefined => {
  if (typeof value !== "string" || value.length > 253 || !/^[a-z0-9.-]+$/i.test(value)) return undefined;
  const normalized = value.toLowerCase();
  if (!normalized.includes(".") || /^\d+(?:\.\d+){3}$/.test(normalized) || normalized.endsWith(".localhost") || normalized.endsWith(".local")) return undefined;
  try { const parsed = new URL(`https://${normalized}`); return parsed.hostname === normalized && !parsed.port ? normalized : undefined; }
  catch { return undefined; }
};
/** Run on the server even when the browser used collectStartAttribution. Unknown keys are dropped. */
export function sanitizeStartAttribution(value: unknown): StartAttribution | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value) || (value as Record<string, unknown>).version !== 1) return undefined;
  const input = value as Record<string, unknown>;
  const source = label(input.source), medium = label(input.medium), campaign = label(input.campaign), referrerHost = host(input.referrerHost);
  return { version: 1, ...(source ? { source } : {}), ...(medium ? { medium } : {}), ...(campaign ? { campaign } : {}), ...(referrerHost ? { referrerHost } : {}) };
}
/** Pure browser helper: callers supply URL/referrer, but only the small allowlisted object is sent. */
export function collectStartAttribution(pageUrl: string, referrer: string): StartAttribution {
  let current: URL | undefined;
  try { current = new URL(pageUrl); } catch { /* Invalid navigation has no attribution. */ }
  let referrerHost: string | undefined;
  try { const previous = new URL(referrer); if (["http:", "https:"].includes(previous.protocol) && previous.hostname !== current?.hostname) referrerHost = previous.hostname; } catch { /* Direct visits and privacy restrictions often omit a referrer. */ }
  return sanitizeStartAttribution({ version: 1, source: current?.searchParams.get("utm_source"), medium: current?.searchParams.get("utm_medium"), campaign: current?.searchParams.get("utm_campaign"), referrerHost })!;
}
