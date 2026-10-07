"use client";
import { useEffect, useState } from "react";
import { Cloud, Sparkles, ShieldCheck, Lock } from "lucide-react";
export default function Connections() {
  const [data, setData] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    fetch("/api/connections")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({}));
  }, []);
  return (
    <section className="max-w-4xl mx-auto p-8 sm:p-12">
      <p className="text-xs uppercase tracking-wider text-indigo-600 font-semibold mb-3">
        Your connected workspace
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">Connections</h1>
      <p className="text-slate-500 mt-3 mb-9">
        Bring your tools together. Connection status reflects server
        configuration; credentials stay private.
      </p>
      <div className="grid sm:grid-cols-2 gap-5">
        {[
          {
            id: "ai",
            name: "AI quiz generation",
            description:
              "Generate a complete, editable quiz from a topic with Gemini.",
            icon: Sparkles,
          },
          {
            id: "cloud",
            name: "Cloud storage",
            description:
              "Keep quizzes, responses, and files in your Supabase project.",
            icon: Cloud,
          },
          {
            id: "auth",
            name: "Creator accounts",
            description:
              "Sign in securely and keep each creator’s workspace separate.",
            icon: Lock,
          },
          {
            id: "captcha",
            name: "Spam protection",
            description:
              "Verify security challenges with Cloudflare Turnstile.",
            icon: ShieldCheck,
          },
        ].map((c) => (
          <article
            key={c.id}
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <c.icon className="text-indigo-600 mb-5" size={26} />
            <h2 className="font-semibold">{c.name}</h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              {c.description}
            </p>
            <span
              className={`inline-block mt-5 text-xs font-medium rounded-full px-3 py-1 ${data?.[c.id] ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
            >
              {!data
                ? "Checking…"
                : data[c.id]
                  ? "Configured"
                  : "Setup required"}
            </span>
          </article>
        ))}
      </div>
      <p className="text-sm text-slate-500 mt-7">
        Your administrator can connect these services using the included setup
        guide. Local quizzes and attachments work without a cloud account.
      </p>
    </section>
  );
}
