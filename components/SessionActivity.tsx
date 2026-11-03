"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { checkEditorSession, startSessionCoordination } from "@/lib/session-client";
import SessionSignIn from "./SessionSignIn";
import "./QuizAccountPrompt.css";

type State = "checking" | "authenticated" | "reauth_required" | "unavailable" | "mismatch";
const recheckingState = (state: State): State => state === "reauth_required" || state === "mismatch" ? state : "checking";

/** Mounted only around creator surfaces. Keep children mounted during recovery:
 * redirects or router refreshes here would destroy pending editor/panel buffers. */
export default function SessionActivity({ accountKey, children }: { accountKey?: string; children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<State>(accountKey ? "checking" : "authenticated");
  const dialog = useRef<HTMLDialogElement>(null);
  const lastCheck = useRef(0);
  const mounted = useRef(false);
  const currentCheck = useRef<Promise<boolean> | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editor = /^\/(?:editor\/|create\/draft|scorecard-builder)/.test(pathname);
  const check = useCallback((): Promise<boolean> => {
    if (!accountKey) return Promise.resolve(true);
    if (currentCheck.current) return currentCheck.current;
    setState(recheckingState);
    currentCheck.current = (async () => {
      const session = await checkEditorSession();
      const next = session.state === "authenticated" && session.accountKey !== accountKey ? "mismatch" : session.state;
      if (mounted.current) {
        setState(next);
        if (expiryTimer.current) clearTimeout(expiryTimer.current);
        if (session.state === "authenticated" && next === "authenticated") {
          // Check at actual session expiry, never on a background renewal loop.
          // Thirty days exceeds the browser's maximum single timeout duration.
          const atExpiry = () => {
            const remaining = session.expiresAt - Date.now();
            if (remaining > 0) {
              expiryTimer.current = setTimeout(atExpiry, Math.min(remaining + 50, 2147483647));
              return;
            }
            if (document.visibilityState !== "visible") { setState(recheckingState); return; }
            window.dispatchEvent(new Event("pippi-session-check"));
          };
          expiryTimer.current = setTimeout(atExpiry, Math.min(Math.max(100, session.expiresAt - Date.now() + 50), 2147483647));
        }
        // Refresh identity labels from the same verified result, including expiry.
        window.dispatchEvent(new Event("pippi-profile-change"));
      }
      lastCheck.current = Date.now();
      return next === "authenticated";
    })().finally(() => { currentCheck.current = null; });
    return currentCheck.current;
  }, [accountKey]);

  useEffect(() => {
    mounted.current = true;
    if (!accountKey) return () => { mounted.current = false; };
    startSessionCoordination();
    const resume = () => {
      if (document.visibilityState === "visible") void check();
      else setState(recheckingState);
    };
    const activity = () => { if (document.visibilityState === "visible" && Date.now() - lastCheck.current >= 300000) void check(); };
    const notice = (event: StorageEvent) => { if (event.key === "pippi-auth-notice") resume(); };
    void check();
    for (const event of ["focus", "pageshow", "online", "offline", "pippi-auth-change", "pippi-session-check"]) window.addEventListener(event, resume);
    document.addEventListener("visibilitychange", resume);
    // Freeze the stale screen before a sleeping tab becomes interactive again.
    const suspend = () => { setState(recheckingState); };
    window.addEventListener("pagehide", suspend);
    window.addEventListener("storage", notice);
    for (const event of ["pointerdown", "keydown", "input"]) document.addEventListener(event, activity, { passive: true });
    return () => {
      mounted.current = false;
      for (const event of ["focus", "pageshow", "online", "offline", "pippi-auth-change", "pippi-session-check"]) window.removeEventListener(event, resume);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pagehide", suspend);
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
      window.removeEventListener("storage", notice);
      for (const event of ["pointerdown", "keydown", "input"]) document.removeEventListener(event, activity);
    };
  }, [accountKey, pathname, check]);

  // The editor owns its account-bound recovery dialog, export and automatic save.
  const blocked = Boolean(accountKey) && state !== "authenticated" && !(editor && (state === "reauth_required" || state === "mismatch"));
  useEffect(() => {
    const element = dialog.current;
    if (blocked && element && !element.open) element.showModal();
    if (!blocked && element?.open) element.close();
  }, [blocked]);

  return <>
    <div inert={blocked || undefined} data-session-state={accountKey ? state : "guest"}>{children}</div>
    {blocked && <dialog ref={dialog} className="pippi-account-dialog" aria-labelledby="workspace-session-title" aria-describedby="workspace-session-description" onCancel={event => event.preventDefault()}>
      <div className="pippi-account-header">
        <h2 id="workspace-session-title" className="pippi-account-title">{state === "checking" ? "Checking your session…" : state === "unavailable" ? "We couldn’t check your connection" : "Please sign in again"}</h2>
        <p id="workspace-session-description" className="pippi-account-description">{state === "checking" ? "Please wait a moment before continuing." : state === "unavailable" ? "Your page is still here. Check your connection and try again. Keep this tab open if you have pending changes." : state === "mismatch" ? "A different account is signed in. Sign back into the original account to continue. Your pending changes have not been transferred." : "Your session has ended. Sign in to continue. Your current page will stay open."}</p>
      </div>
      <div className="pippi-account-body">
        {state === "checking" ? <p role="status">Checking your session…</p> : state === "unavailable" ? <button type="button" className="pippi-account-primary w-full" onClick={() => void check()}>Try again</button> : <SessionSignIn onAuthenticated={check} />}
      </div>
    </dialog>}
  </>;
}
