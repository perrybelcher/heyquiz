import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { FormSchemaType, QuizSubmissionResult } from "../schema";
import type { MetaBrowserContext, MetaEvent, MetaEventName } from "./schema";
export const hashMeta = (value: string) => createHash("sha256").update(value).digest("hex");
export function safePageUrl(value: unknown): string | undefined {
  try { const url = new URL(String(value)); if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.pathname.length > 1500) return; return url.origin + url.pathname; } catch { return; }
}
export function browserContext(input: unknown): MetaBrowserContext | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return;
  const raw = input as Record<string, unknown>, url = safePageUrl(raw.url);
  if (!url) return;
  const context: MetaBrowserContext = { url };
  for (const field of ["fbp", "fbc"] as const) {
    const pattern = field === "fbp" ? /^fb\.\d{1,2}\.\d{13}\.\d{1,20}$/ : /^fb\.\d{1,2}\.\d{13}\.[A-Za-z0-9_-]{1,500}$/;
    if (typeof raw[field] === "string" && pattern.test(raw[field])) context[field] = raw[field];
  }
  if (!context.fbc && typeof raw.fbclid === "string" && /^[A-Za-z0-9_-]{8,500}$/.test(raw.fbclid)) context.fbc = `fb.1.${Date.now()}.${raw.fbclid}`;
  for (const field of ["screen_width", "screen_height", "viewport_width", "viewport_height", "pixel_ratio"] as const) {
    const value = raw[field]; if (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= (field === "pixel_ratio" ? 20 : 30000)) context[field] = value;
  }
  if (typeof raw.language === "string" && /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8}){0,3}$/.test(raw.language)) context.language = raw.language;
  return context;
}
export function requestIdentity(req: Request) {
  // Only deployment-trusted proxy headers may supply a visitor IP. Never accept it from JSON.
  const header = process.env.VERCEL === "1" ? "x-vercel-forwarded-for" : process.env.META_TRUST_PROXY === "1" ? "x-forwarded-for" : "";
  const ip = header ? req.headers.get(header)?.split(",")[0].trim() : undefined;
  return { ...(ip && isIP(ip) ? { client_ip_address: ip } : {}), ...(req.headers.get("user-agent") ? { client_user_agent: req.headers.get("user-agent")!.slice(0, 2000) } : {}) };
}
function normalized(field: string, value: string): string | undefined {
  const text = value.trim().toLowerCase();
  if (!text || text.length > 250) return;
  if (field === "em") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : undefined;
  if (field === "ph") { if (!/^\+[\d ()-]+$/.test(text)) return; const digits = text.replace(/\D/g, ""); return /^[1-9]\d{7,14}$/.test(digits) ? digits : undefined; }
  if (field === "country") return /^[a-z]{2}$/.test(text) ? text : undefined;
  if (field === "zp") return text.replace(/[\s-]/g, "");
  if (field === "ct") return text.replace(/[\s\p{P}\p{S}]/gu, "");
  if (field === "st") return /^[a-z]{2}$/.test(text) ? text : undefined;
  return text.replace(/[\p{P}\p{S}\d]/gu, "").trim() || undefined;
}
export function buildMetaEvent(input: { owner: string; form: FormSchemaType; name: MetaEventName; id: string; time: number; context: MetaBrowserContext; identity: Record<string, string>; result?: QuizSubmissionResult; ruleVersion?: string }): MetaEvent {
  const { owner, form, name, id, time, context, identity, result } = input;
  const user_data: MetaEvent["user_data"] = { ...identity };
  for (const key of ["fbp", "fbc"] as const) if (context[key]) user_data[key] = context[key]!;
  if (result?.contact && result.id) {
    user_data.external_id = [hashMeta(`${owner}:${form.id}:${result.id}`)];
    const values: Record<string, string | undefined> = { em: result.contact.email, ph: result.contact.phone };
    for (const mapping of form.meta?.mappings || []) {
      const answer = result.answers?.[mapping.questionId], question = form.questions.find(q => q.id === mapping.questionId);
      if (typeof answer === "string") values[mapping.field] = question?.options?.find(o => o.id === answer)?.label || answer;
    }
    for (const [field, raw] of Object.entries(values)) { const value = raw && normalized(field, raw); if (value) user_data[field] = [hashMeta(value)]; }
  }
  const custom_data: MetaEvent["custom_data"] = { quiz_id: form.id, ...(input.ruleVersion ? { qualification_rule_version: input.ruleVersion } : {}) };
  for (const key of ["screen_width", "screen_height", "viewport_width", "viewport_height", "pixel_ratio", "language"] as const) if (context[key] !== undefined) custom_data[key] = context[key]!;
  return { event_name: name, event_time: Math.floor(time / 1000), event_id: id, action_source: "website", event_source_url: context.url, user_data, custom_data };
}
