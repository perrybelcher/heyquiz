"use client";
import { useState } from "react";
export default function Login({ local }: { local: boolean }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function login(data: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      window.location.assign("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <section className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-9 shadow-sm">
        <img src="/logo.png" alt="HeyQuiz" className="h-9 mb-9" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome to your workspace
        </h1>
        <p className="text-slate-500 mt-2 mb-7">
          Thoughtful questions. Meaningful answers.
        </p>
        {error && (
          <p role="alert" className="hq-error">
            {error}
          </p>
        )}
        {local ? (
          <>
            <p className="text-sm text-slate-500 mb-6">
              This workspace runs privately on this computer.
            </p>
            <button
              className="hq-primary w-full"
              disabled={busy}
              onClick={() => login({ local: true })}
            >
              {busy ? "Opening…" : "Open local workspace"}
            </button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              void login({
                email: d.get("email"),
                password: d.get("password"),
              });
            }}
            className="space-y-4"
          >
            <label className="block text-sm">
              Email
              <input
                className="hq-input mt-2"
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label className="block text-sm">
              Password
              <input
                className="hq-input mt-2"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="hq-primary w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
