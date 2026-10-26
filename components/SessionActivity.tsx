"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { checkEditorSession } from "@/lib/session-client";

/** Extend existing account sessions through foreground creator use. The editor
 * coordinates its own checks with draft saving; public players/reports never
 * participate. No interval keeps a hidden or unattended page signed in. */
export default function SessionActivity() {
  const pathname = usePathname();
  const lastCheck = useRef(0);
  useEffect(() => {
    if (!(pathname === "/" || pathname === "/reports" || pathname === "/profile" || /^\/(?:create|templates|help|experiments)(?:\/|$)/.test(pathname))) return;
    let disposed = false, checking = false;
    const check = async (force = false) => {
      if (checking || document.visibilityState !== "visible" || !navigator.onLine || (!force && Date.now() - lastCheck.current < 300000)) return;
      checking = true;
      lastCheck.current = Date.now();
      try {
        // Anonymous visitors should not repeatedly hit the renewal endpoint.
        const response = await fetch("/api/auth", { cache: "no-store", signal: AbortSignal.timeout(20000) });
        const status = response.ok ? await response.json() : null;
        if (!disposed && status?.signedIn && document.visibilityState === "visible") await checkEditorSession();
      } catch { /* An outage does not sign users out or interrupt the page. */ }
      finally { checking = false; }
    };
    const activity = () => { void check(); };
    const resume = () => { void check(true); };
    void check(true);
    for (const event of ["pointerdown", "keydown", "input"]) document.addEventListener(event, activity, { passive: true });
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    return () => {
      disposed = true;
      for (const event of ["pointerdown", "keydown", "input"]) document.removeEventListener(event, activity);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
    };
  }, [pathname]);
  return null;
}
