"use client";
import WorkspaceHeader from "./WorkspaceHeader";
import Link from "next/link";

import { useEffect, useState } from "react";
import { ArrowRight, Check, FilePenLine } from "lucide-react";
import QuizTypeChooser from "./QuizTypeChooser";
import type { QuizType } from "@/lib/quiz-types";
import CreationPaths from "./CreationPaths";
import { readGuestDraft } from "@/lib/guest-draft";
import { useInterfaceVersion } from "./v2/InterfaceContext";
import "./v2/creation.css";

export default function CreationStart() {
  const v2 = useInterfaceVersion() === "v2";
  const [quizType,setQuizType]=useState<QuizType>();
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

  return <><WorkspaceHeader active="overview" /><main className={`${v2 ? "v2-creation-start " : ""}min-h-screen bg-[#faf8f4] px-5 pt-7 pb-24 text-slate-900 sm:px-8 sm:pt-10 sm:pb-24`}>
    <div className="mx-auto max-w-6xl">

      <header className="mb-8 max-w-3xl sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-800">{v2 ? "CREATE A QUIZ" : "YOUR QUIZ. YOUR WAY."}</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">What should people discover?</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">Choose the result your quiz should deliver. Then choose how to build it. Appearance can be customized throughout.</p>
      </header>
      <QuizTypeChooser selected={quizType} onSelect={setQuizType}/>{quizType&&<section className="mt-8"><h2 className="mb-4 text-xl font-semibold">How would you like to start?</h2><CreationPaths quizType={quizType}/></section>}<p className="mt-4 text-sm leading-relaxed text-slate-600">{v2 ? "Choose a starting point, then shape your questions, results, and design in the editor." : "New quizzes open in Basic mode: five simple steps to publish. Switch to Advanced mode whenever you want more control, without starting over."}</p>
      <Link href="/help/first-quiz" className="mt-6 inline-block text-sm font-semibold text-red-800 underline">New to Pippi? Follow the first-quiz guide →</Link>
      <p className="mt-6 flex items-start gap-2 text-sm leading-relaxed text-slate-600"><Check aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-red-800" /><span>All accounts are free. Start blank, use a template, or try the wizard without signing up. Create a free account to save, publish, or use AI. No credit card.</span></p>
      {draft && <section aria-label="Continue your draft" className="mt-9 flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3"><FilePenLine size={22} aria-hidden="true" className="shrink-0 text-red-800" /><div className="min-w-0"><h2 className="text-sm font-semibold">Pick up where you left off</h2><p className="mt-1 break-words text-sm text-slate-600">{draft.title || "Untitled quiz"} <span className="text-slate-500">· Saved on this device</span></p></div></div>
        <Link prefetch={false} href="/create/draft" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-red-800 focus-visible:outline-2 focus-visible:outline-red-800">Continue editing<ArrowRight size={16} aria-hidden="true" /></Link>
      </section>}
    </div>
  </main></>;
}
