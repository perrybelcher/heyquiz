"use client";
import Link from "next/link";
import Image from "next/image";

import { useEffect, useState } from "react";
import { ArrowRight, Check, FilePenLine } from "lucide-react";
import CreationPaths from "./CreationPaths";
import { readGuestDraft } from "@/lib/guest-draft";

export default function CreationStart() {
  const [draft, setDraft] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => {
    // The chooser must always remain visible, including for returning visitors.
    // Resume is a separate action; reading storage here never creates a quiz.
    try {
      const saved = readGuestDraft(localStorage, sessionStorage);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Read device-only recovery metadata after hydration.
      if (saved) setDraft({ id: saved.id, title: saved.title });
    } catch {}
  }, []);

  return <main className="min-h-screen bg-[#faf8f4] px-5 py-7 text-slate-900 sm:px-8 sm:py-10">
    <div className="mx-auto max-w-6xl">
      <nav aria-label="Creation navigation" className="mb-12 flex items-center justify-between gap-4">
        <Link prefetch={false} href="/welcome" aria-label="Pippi home"><Image width={144} height={48} src="/pippi-logo.svg" alt="Pippi" className="w-36" /></Link>
        <Link prefetch={false} href="/" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-red-800">My workspace</Link>
      </nav>
      <header className="mb-8 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-800">YOUR QUIZ. YOUR WAY.</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">How would you like to start?</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">Write every question yourself, make a template your own, follow the wizard, or let AI draft it. You can edit everything along the way.</p>
      </header>
      <CreationPaths />
      <p className="mt-6 flex items-start gap-2 text-sm leading-relaxed text-slate-600"><Check aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-red-800" /><span>All accounts are free. Start blank, use a template, or try the wizard without signing up. Create a free account to save, publish, or use AI. No credit card.</span></p>
      {draft && <section aria-label="Continue your draft" className="mt-9 flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3"><FilePenLine size={22} aria-hidden="true" className="shrink-0 text-red-800" /><div className="min-w-0"><h2 className="text-sm font-semibold">Pick up where you left off</h2><p className="mt-1 break-words text-sm text-slate-600">{draft.title || "Untitled quiz"} <span className="text-slate-500">· Saved on this device</span></p></div></div>
        <Link prefetch={false} href="/create/draft" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-red-800 focus-visible:outline-2 focus-visible:outline-red-800">Continue editing<ArrowRight size={16} aria-hidden="true" /></Link>
      </section>}
    </div>
  </main>;
}
