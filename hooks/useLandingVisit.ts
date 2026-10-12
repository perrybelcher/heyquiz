"use client";
import { useCallback, useEffect, type RefObject } from "react";
import { boundedLandingToken, recordBrowserLanding } from "@/lib/landing-visit-client";
export function useLandingVisit({ target, formId, preview, embed, experimentId, experimentToken, landingVisible, resumeStorageKey }: { target: RefObject<HTMLDivElement | null>; formId: string; preview: boolean; embed: boolean; experimentId?: string; experimentToken?: string; landingVisible: boolean; resumeStorageKey?: string }) {
  const record = useCallback(() => recordBrowserLanding({ formId, embed, experimentId, experimentToken }), [formId, embed, experimentId, experimentToken]);
  useEffect(() => {
    if (preview || !landingVisible) return;
    const landing = target.current?.querySelector("[data-landing-layout]");
    if (!landing) return;
    let intersecting = false;
    const visible = () => {
      if (!intersecting || document.visibilityState !== "visible") return;
      // Hydration can precede React's saved-session snapshot. Recheck at the observer callback.
      if (resumeStorageKey) try { const raw = sessionStorage.getItem(resumeStorageKey); if (raw && JSON.parse(raw).startedAt + 86400000 > Date.now()) return; } catch { /* Storage is optional. */ }
      void record();
    };
    const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => { intersecting = entries.some(entry => entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0); visible(); }) : null;
    observer?.observe(landing);
    // A direct page can use viewport bounds. An embed without intersection support is unknown.
    if (!observer && !embed) { const rect = landing.getBoundingClientRect(); intersecting = rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth; visible(); }
    document.addEventListener("visibilitychange", visible);
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", visible); };
  }, [preview, landingVisible, target, embed, record, resumeStorageKey]);
  return useCallback(() => preview || document.visibilityState !== "visible" ? Promise.resolve(undefined) : boundedLandingToken(record()), [preview, record]);
}
