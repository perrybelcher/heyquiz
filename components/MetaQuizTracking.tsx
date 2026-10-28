"use client";
import { useEffect, useRef } from "react";
import type { MetaConfig } from "@/lib/meta/schema";
import { actualBrowserContext, parentBrowserContext, rememberMetaParent, freshMetaContext, metaPixelConsent, pendingMeta, pixelEvent, postMeta, setMetaToken } from "@/lib/meta/browser";
export default function MetaQuizTracking({ formId, config, consent, preview, attemptToken, completed, leadCaptured, experimentToken }: { formId: string; config?: MetaConfig; consent: boolean | null; preview: boolean; attemptToken?: string; completed: boolean; leadCaptured: boolean; experimentToken?: string }) {
  const token = useRef<string | undefined>(undefined), generation = useRef(0), finishedAttempt = useRef<string | undefined>(undefined);
  const enabled = Boolean(config?.enabled && config.datasetId && !preview), datasetId = config?.datasetId || "";
  useEffect(() => {
    if (!enabled) return;
    const current = ++generation.current;
    metaPixelConsent(datasetId, consent === true);
    if (consent !== true) { setMetaToken(formId); return; }
    let cancelled = false;
    const work = (async () => {
      let key: string;
      const storageKey = `pippi:meta:visit:${formId}:${datasetId}`;
      try { const cached = JSON.parse(sessionStorage.getItem(storageKey) || "null"); key = cached && cached.until > Date.now() ? cached.id : crypto.randomUUID(); sessionStorage.setItem(storageKey, JSON.stringify({ id: key, until: cached?.id === key ? cached.until : Date.now() + 86400000 })); } catch { key = crypto.randomUUID(); }
      const parent = await parentBrowserContext();
      if (cancelled || generation.current !== current) return;
      rememberMetaParent(formId, parent);
      const result = await postMeta(formId, { action: "visit", consent: true, viewKey: key, context: { ...actualBrowserContext(), ...parent }, ...(experimentToken ? { experimentToken } : {}) });
      if (cancelled || generation.current !== current) { if (result.token) await postMeta(formId, { action: "revoke", metaToken: result.token }, true).catch(() => {}); return; }
      token.current = result.token; setMetaToken(formId, result.token);
      pixelEvent(result.datasetId, result.event);
      window.dispatchEvent(new CustomEvent("pippi:meta:ready", { detail: formId }));
    })().catch(() => {});
    pendingMeta(formId, work);
    return () => { cancelled = true; metaPixelConsent(datasetId, false); setMetaToken(formId); };
  }, [enabled, datasetId, consent, formId, experimentToken]);
  useEffect(() => {
    if (consent === true || !token.current) return;
    const prior = token.current; token.current = undefined; setMetaToken(formId);
    try { sessionStorage.removeItem(`pippi:meta:visit:${formId}:${datasetId}`); } catch { }
    void postMeta(formId, { action: "revoke", metaToken: prior }, true).catch(() => {});
  }, [consent, formId, datasetId]);
  useEffect(() => {
    if (!enabled || consent !== true || !attemptToken) return;
    let stopped = false;
    async function sync() {
      if (!token.current || stopped || finishedAttempt.current === attemptToken) return;
      try { const result = await postMeta(formId, { action: "sync", attemptToken, metaToken: token.current, context: freshMetaContext(formId) }); if (!stopped && result.event) { pixelEvent(result.datasetId, result.event); finishedAttempt.current = attemptToken; } else if (result.decision?.status === "unclassified") finishedAttempt.current = attemptToken; } catch { /* Durable server jobs do not depend on the browser remaining open. */ }
    }
    void sync();
    const ready = (event: Event) => { if ((event as CustomEvent).detail === formId) void sync(); };
    window.addEventListener("pippi:meta:ready", ready);
    const retry = setInterval(() => void sync(), completed && leadCaptured ? 5000 : 30000);
    return () => { stopped = true; clearInterval(retry); window.removeEventListener("pippi:meta:ready", ready); };
  }, [enabled, consent, attemptToken, completed, leadCaptured, formId]);
  return null;
}
