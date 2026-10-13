/** Creator-only behavior analytics. Never pass content, contact details or IDs to events. */
export const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || "ywmhuufnta";
export const CLARITY_CONSENT_KEY = "pippi-behavior-consent-v1";
export const clarityEvents = ["create_blank", "create_template", "create_guided", "create_ai", "scoring_help", "answer_example", "setup_next", "preview_requested", "publish_requested", "account_prompt", "draft_saved", "save_failed", "save_auth_required", "publish_succeeded", "publish_failed", "publish_unconfirmed"] as const;
export type ClarityEvent = typeof clarityEvents[number];
type Clarity = ((...args: unknown[]) => void) & { q?: unknown[][] };
declare global { interface Window { clarity?: Clarity; } }

// Exclude token URLs, query strings, respondent pages, authentication and reports.
export function clarityLocationAllowed(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && ["www.pippiapp.com", "pippiapp.com"].includes(url.hostname)
      && !url.search && !url.hash
      && (/^\/(?:create(?:\/(?:blank|guided|ai|marketing))?|templates)\/?$/.test(url.pathname)
        || /^\/editor\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname));
  } catch { return false; }
}
export function readClarityConsent(): "granted" | "denied" | null {
  try {
    const stored = JSON.parse(localStorage.getItem(CLARITY_CONSENT_KEY) || "null");
    return stored && ["granted", "denied"].includes(stored.value) && Number.isFinite(stored.expires)
      && stored.expires > Date.now() ? stored.value : null;
  } catch { return null; }
}
let started = false, stopped = false;
export function clarityEvent(event: ClarityEvent) {
  // Observability must never interrupt saving or publishing.
  try { if (started && !stopped && clarityEvents.includes(event) && readClarityConsent() === "granted") window.clarity?.("event", event); } catch {}
}
/** Stop before private content or a token-bearing URL is rendered. Resume only on a fresh document. */
export function stopClarity() {
  if (!started || stopped) return;
  stopped = true;
  window.clarity?.("consentv2", { analytics_Storage: "denied", ad_Storage: "denied" });
  window.clarity?.("stop");
}
export function startClarity(): boolean {
  if (started || stopped || process.env.NEXT_PUBLIC_CLARITY_ENABLED === "false"
    || !/^[a-z0-9]+$/.test(CLARITY_PROJECT_ID) || !clarityLocationAllowed(location.href)
    || readClarityConsent() !== "granted" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return false;
  // Do not send an authentication/private-result referrer to the analytics provider.
  if (document.referrer) {
    try { const ref = new URL(document.referrer); if (ref.search || ref.hash || /^\/(?:auth|result|reset-password)(\/|$)/.test(ref.pathname)) return false; }
    catch { return false; }
  }
  started = true;
  document.documentElement.setAttribute("data-clarity-mask", "true");
  window.clarity = window.clarity || Object.assign((...args: unknown[]) => { window.clarity!.q!.push(args); }, { q: [] as unknown[][] });
  window.clarity("consentv2", { analytics_Storage: "granted", ad_Storage: "denied" });
  window.clarity("set", "surface", "quiz_creator");
  // Protect SPA transitions before history exposes the destination URL. Keep the
  // wrappers for the document lifetime; stopping does not alter app navigation.
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method].bind(history);
    history[method] = (data, unused, url) => {
      if (url != null && !clarityLocationAllowed(new URL(String(url), location.href).href)) stopClarity();
      original(data, unused, url);
    };
  }
  window.addEventListener("popstate", stopClarity);
  window.addEventListener("hashchange", stopClarity);
  document.addEventListener("click", event => {
    const element = event.target instanceof Element ? event.target : null;
    const name = element?.closest("[data-clarity-event]")?.getAttribute("data-clarity-event");
    if (name && clarityEvents.includes(name as ClarityEvent)) clarityEvent(name as ClarityEvent);
    const link = element?.closest<HTMLAnchorElement>("a[href]");
    if (link && link.target !== "_blank" && !clarityLocationAllowed(link.href)) stopClarity();
  }, true);
  const script = document.createElement("script");
  script.id = "pippi-clarity";
  script.async = true;
  script.referrerPolicy = "no-referrer";
  script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
  // A navigation/withdrawal may happen while the vendor script is in flight.
  script.onload = () => { if (stopped || readClarityConsent() !== "granted" || !clarityLocationAllowed(location.href)) { window.clarity?.("stop"); } };
  script.onerror = () => { stopped = true; };
  document.head.appendChild(script);
  return true;
}
