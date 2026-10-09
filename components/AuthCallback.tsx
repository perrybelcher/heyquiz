"use client";
import { useEffect, useRef, useState } from "react";
import "./AccountForm.css";
export default function AuthCallback() {
  const started = useRef(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search),
      code = params.get("code");
    // Remove authorization data from the address bar before rendering any other navigation.
    window.history.replaceState(null, "", "/auth/callback");
    if (!code) {
      setError(
        "This email link is missing or has expired. Please request a new one.",
      );
      return;
    }
    void fetch("/api/auth/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "exchange", code }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        window.location.replace(data.next);
      })
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : "We couldn’t confirm your email. Please try again.",
        ),
      );
  }, []);
  return (
    <main className="account-page">
      <section className="account-card">
        <img
          src="/pippi-logo.svg"
          alt="pippi"
          width="150"
          height="50"
        />
        <h1>
          {error ? "Let’s get you back to pippi" : "Confirming your email…"}
        </h1>
        {error ? (
          <>
            <p className="account-error" role="alert">
              {error}
            </p>
            {/* Verification can succeed before the browser-bound session exchange.
                Do not claim confirmation failed, or promise it succeeded. */}
            <p className="account-intro">
              Your email may already be confirmed, especially if you opened the
              link in another browser. Try signing in with your email and password
              to finish.
            </p>
            <a className="account-submit" href="/login">
              Sign in to finish
            </a>
            <p className="account-footer">
              If sign-in says your email still needs confirmation, request a new
              confirmation link. If you were resetting your password, request a
              new reset link and open it in the same browser.
            </p>
            <p className="account-footer">
              <a href="/resend-confirmation">Resend confirmation</a> ·{" "}
              <a href="/forgot-password">Reset password</a>
            </p>
          </>
        ) : (
          <p role="status" className="account-intro">
            Please keep this page open for a moment.
          </p>
        )}
      </section>
    </main>
  );
}
