"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, MailCheck } from "lucide-react";
import "./AccountForm.css";
type Mode = "signup" | "recover" | "reset" | "resend";
const copy = {
  signup: [
    "Create your pippi account",
    "All accounts are free. No charges. No credit card required.",
    "Create account",
  ],
  recover: [
    "Forgot your password?",
    "We’ll email you a secure link to choose a new one.",
    "Send reset link",
  ],
  reset: [
    "Choose a new password",
    "Make it unique to your pippi account.",
    "Save new password",
  ],
  resend: [
    "Confirm your email",
    "Enter your registration details to request a fresh confirmation link.",
    "Resend confirmation",
  ],
};
export default function AccountForm({ mode }: { mode: Mode }) {
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  const passwordRequired = mode !== "recover";
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    const fields = new FormData(e.currentTarget);
    if (
      (mode === "signup" || mode === "reset") &&
      fields.get("password") !== fields.get("confirmation")
    ) {
      setError("Your passwords don’t match. Please try again.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          email: fields.get("email"),
          password: fields.get("password"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Please try again.");
      if (data.next) {
        window.location.assign(data.next);
        return;
      }
      setMessage(data.message);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We couldn’t connect. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-page">
      <section className="account-card">
        <a href="/welcome" aria-label="pippi home">
          <img
            src="/pippi-logo.svg"
            alt="pippi"
            width="150"
            height="50"
          />
        </a>
        <p className="account-eyebrow">
          A little curiosity. A lot of possibility.
        </p>
        <h1>{message ? "Check your inbox" : copy[mode][0]}</h1>
        <p className="account-intro">
          {message
            ? "You’re one email away from your next step."
            : copy[mode][1]}
        </p>
        {error && (
          <p className="account-error" role="alert">
            {error}
          </p>
        )}
        {message ? (
          <div className="account-success" role="status">
            <MailCheck size={28} />
            <p>{message}</p>
            <button className="account-text" onClick={() => setMessage("")}>
              Use a different email or try again
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            {mode !== "reset" && (
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  placeholder="you@company.com"
                />
              </label>
            )}
            {passwordRequired && (
              <>
                <label htmlFor="account-password">
                  {mode === "reset" ? "New password" : "Password"}
                </label>
                <div className="account-password">
                  <input
                    id="account-password"
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete={
                      mode === "resend" ? "current-password" : "new-password"
                    }
                    minLength={12}
                    maxLength={128}
                    required
                    aria-describedby="password-hint"
                  />
                  <button
                    type="button"
                    aria-label={show ? "Hide password" : "Show password"}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
                <p id="password-hint" className="account-hint">
                  At least 12 characters. A memorable phrase works well.
                </p>
              </>
            )}
            {(mode === "signup" || mode === "reset") && (
              <label>
                Confirm password
                <input
                  name="confirmation"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
            )}
            <button className="account-submit" disabled={busy}>
              {busy ? "Please wait…" : copy[mode][2]}
              <ArrowRight size={18} />
            </button>
            {mode === "signup" && (
              <p className="account-hint">
                We’ll send a confirmation email. Open it in this browser to
                finish.
              </p>
            )}
          </form>
        )}
        <p className="account-footer">
          {mode === "signup"
            ? "Already have an account? "
            : "Ready to return? "}
          <a href="/login">Sign in</a>
        </p>
        <a className="account-back" href="/welcome">
          <ArrowLeft size={15} /> Back to pippi
        </a>
      </section>
    </main>
  );
}
