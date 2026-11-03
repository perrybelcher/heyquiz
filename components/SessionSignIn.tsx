"use client";

import { useState } from "react";
import { publishAuthChange } from "@/lib/session-client";

/** Stay in this document so pending editor and panel buffers survive sign-in. */
export default function SessionSignIn({ onAuthenticated, busy = false }: { onAuthenticated?: () => Promise<boolean>; busy?: boolean }) {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");
  return <>
    {error && <p role="alert" className="hq-error">{error}</p>}
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      setSigningIn(true); setError("");
      try {
        const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: fields.get("email"), password: fields.get("password") }) });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Sign-in could not be completed. Please try again.");
        await onAuthenticated?.();
        publishAuthChange();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign-in could not be completed. Please try again."); }
      finally { setSigningIn(false); }
    }}>
      <label className="block text-sm">Email<input autoFocus name="email" type="email" autoComplete="username" required className="hq-input mt-2" /></label>
      <label className="block text-sm">Password<input name="password" type="password" autoComplete="current-password" required className="hq-input mt-2" /></label>
      <button type="submit" className="pippi-account-primary w-full" disabled={signingIn || busy}>{signingIn ? "Signing in…" : "Sign in and continue"}</button>
    </form>
    <a href="/forgot-password" target="_blank" rel="noopener noreferrer" className="pippi-account-keep-editing">Forgot password? (opens in a new tab)</a>
  </>;
}
