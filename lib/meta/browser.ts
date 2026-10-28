import { defaultTracking } from "../tracking";
import { trackerConsent } from "../browser-tracking";
import type { MetaBrowserContext } from "./schema";
interface PixelEvent { name: "PageView" | "Qualified" | "Disqualified"; id: string; data: Record<string, string | number> }
const parents = new Map<string, Partial<MetaBrowserContext>>();
export function rememberMetaParent(formId: string, context: Partial<MetaBrowserContext>) { parents.set(formId, Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined))); }
export function freshMetaContext(formId: string) { if (!tokens.has(formId)) return; return { ...actualBrowserContext(), ...(parents.get(formId) || {}) }; }
const tokens = new Map<string, string>(), pending = new Map<string, Promise<unknown>>();
export function setMetaToken(formId: string, token?: string) { if (token) tokens.set(formId, token); else tokens.delete(formId); }
export async function metaTokenFor(formId: string) {
  const work = pending.get(formId);
  if (work) { let timer: ReturnType<typeof setTimeout> | undefined; try { await Promise.race([work, new Promise(resolve => { timer = setTimeout(resolve, 400); })]); } finally { clearTimeout(timer); } }
  return tokens.get(formId);
}
export function pendingMeta(formId: string, work: Promise<unknown>) { pending.set(formId, work); void work.finally(() => { if (pending.get(formId) === work) pending.delete(formId); }); }
export function metaPixelConsent(datasetId: string, allowed: boolean) { trackerConsent({ ...defaultTracking, enabled: true, metaPixelId: datasetId }, allowed); }
export function pixelEvent(datasetId: string, event: PixelEvent) {
  const key = `pippi:meta:event:${datasetId}:${event.id}`, memory = sent;
  try { if (sessionStorage.getItem(key)) return; } catch { }
  if (memory.has(key)) return;
  const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
  if (!fbq) return;
  fbq(event.name === "PageView" ? "trackSingle" : "trackSingleCustom", datasetId, event.name, event.data, { eventID: event.id });
  memory.add(key); try { sessionStorage.setItem(key, "1"); } catch { }
}
const sent = new Set<string>();
function cookie(name: string) { return document.cookie.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1); }
export function actualBrowserContext(): MetaBrowserContext {
  const url = new URL(window.location.href);
  return { url: url.origin + url.pathname, fbp: cookie("_fbp"), fbc: cookie("_fbc"), fbclid: url.searchParams.get("fbclid") || undefined, screen_width: screen.width, screen_height: screen.height, viewport_width: innerWidth, viewport_height: innerHeight, pixel_ratio: devicePixelRatio, language: navigator.language };
}
export async function parentBrowserContext(): Promise<Partial<MetaBrowserContext>> {
  if (window.parent === window) return {};
  return new Promise(resolve => {
    const nonce = crypto.randomUUID(); let parentOrigin = ""; let channel = "";
    const timer = setTimeout(() => finish({}), 350);
    function finish(value: Partial<MetaBrowserContext>) { clearTimeout(timer); window.removeEventListener("message", receive); resolve(value); }
    function receive(event: MessageEvent) {
      const data = event.data;
      if (event.source !== window.parent || !/^https?:\/\//.test(event.origin) || !data || typeof data !== "object") return;
      if (data.type === "pippi:embed:init" && data.version === 1 && typeof data.channel === "string" && /^[a-f0-9]{32}$/.test(data.channel)) {
        parentOrigin = event.origin; channel = data.channel;
        window.parent.postMessage({ type: "pippi:meta:context", version: 1, channel, nonce, consent: true }, parentOrigin);
      }
      if (data.type === "pippi:meta:context-result" && event.origin === parentOrigin && data.channel === channel && data.nonce === nonce && data.context && typeof data.context === "object") {
        // Parent URL must belong to the browser-authenticated sending origin.
        try { if (new URL(data.context.url).origin !== parentOrigin) return; } catch { return; }
        finish(data.context);
      }
    }
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "pippi:embed:ready", version: 1 }, "*");
  });
}
export async function postMeta(formId: string, body: Record<string, unknown>, keepalive = false) {
  const response = await fetch(`/api/forms/${encodeURIComponent(formId)}/meta/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Meta tracking request was not accepted.");
  return response.json();
}
