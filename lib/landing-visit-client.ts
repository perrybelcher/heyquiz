import { LANDING_VISIT_WINDOW_MS } from "./landing-visit";
interface VisitCache { viewKey: string; expiresAt: number; token?: string }
interface VisitRequest { formId: string; embed: boolean; experimentId?: string; experimentToken?: string }
interface Dependencies { storage: Pick<Storage, "getItem" | "setItem">; fetch: typeof fetch; now: () => number; uuid: () => string }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
/** One fixed window per quiz/context/tab. No cookie, cross-tab ID, URL or personal data is stored. */
export function createLandingVisitClient(deps: Dependencies) {
  const pending = new Map<string, Promise<string | undefined>>(), memory = new Map<string, VisitCache>();
  const save = (key: string, value: VisitCache) => {
    if (memory.size >= 64 && !memory.has(key)) memory.delete(memory.keys().next().value!);
    memory.set(key, value);
    try { deps.storage.setItem(key, JSON.stringify(value)); } catch { /* Blocked storage: best-effort in-page deduplication only. */ }
  };
  return {
    record(input: VisitRequest): Promise<string | undefined> {
      const key = `pippi:landing-visit:${input.formId}:${input.experimentId || "direct"}`;
      if (pending.has(key)) return pending.get(key)!;
      const work = async () => {
        let cached = memory.get(key);
        if (!cached) try {
          const raw = deps.storage.getItem(key);
          if (raw && raw.length < 2048) cached = JSON.parse(raw);
        } catch { /* No local storage is required to take a quiz. */ }
        if (!cached || !uuid.test(cached.viewKey) || !Number.isFinite(cached.expiresAt) || cached.expiresAt <= deps.now() || cached.expiresAt > deps.now() + LANDING_VISIT_WINDOW_MS) cached = undefined;
        if (cached?.token && typeof cached.token === "string" && cached.token.length <= 1024) return cached.token;
        for (let retry = 0; retry < 2; retry++) {
          cached ||= { viewKey: deps.uuid(), expiresAt: deps.now() + LANDING_VISIT_WINDOW_MS };
          // Persist before fetching: reloads and duplicate mount effects reuse the same nonce.
          save(key, cached);
          const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 2000);
          try {
            const response = await deps.fetch(`/api/forms/${encodeURIComponent(input.formId)}/visit`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ viewKey: cached.viewKey, embed: input.embed, ...(input.experimentToken ? { experimentToken: input.experimentToken } : {}) }) });
            if (response.status === 409 && !retry) { cached = undefined; continue; }
            if (!response.ok) return;
            const result = await response.json();
            if (typeof result.token !== "string" || result.token.length > 1024 || !Number.isFinite(result.remainingMs) || result.remainingMs <= 0 || result.remainingMs > LANDING_VISIT_WINDOW_MS) return;
            save(key, { ...cached, token: result.token, expiresAt: deps.now() + result.remainingMs });
            return result.token as string;
          } finally { clearTimeout(timeout); }
        }
      };
      const promise = work().catch(() => undefined).finally(() => pending.delete(key));
      pending.set(key, promise);
      return promise;
    },
  };
}
let client: ReturnType<typeof createLandingVisitClient> | undefined;
export function recordBrowserLanding(input: VisitRequest) {
  client ||= createLandingVisitClient({ storage: { getItem: key => sessionStorage.getItem(key), setItem: (key, value) => sessionStorage.setItem(key, value) }, fetch: (...args) => fetch(...args), now: Date.now, uuid: () => crypto.randomUUID() });
  return client.record(input);
}
/** A missing/slow analytics response must never hold the Start button hostage. */
export async function boundedLandingToken(pending: Promise<string | undefined>, waitMs = 300): Promise<string | undefined> {
  let timeout: ReturnType<typeof setTimeout> | number | undefined;
  try { return await Promise.race([pending.catch(() => undefined), new Promise<undefined>(resolve => { timeout = setTimeout(resolve, waitMs); })]); }
  finally { clearTimeout(timeout); }
}
