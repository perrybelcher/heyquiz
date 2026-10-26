"use client";
import Link from "next/link";
import { ArrowRight, GitBranch, Plus } from "lucide-react";
import type { MarketingConfig } from "@/lib/marketing";
import CreationPaths from "./CreationPaths";

export default function WorkspaceWelcome({ busy, onCreate, onAI, projectCount, publishedCount, recentQuiz }: {
  busy: boolean;
  onCreate: (kind?: MarketingConfig["kind"]) => void;
  onAI: () => void;
  projectCount: number;
  publishedCount: number;
  recentQuiz?: { id: string; title: string };
}) {
  return <>
    <section aria-label="Welcome to pippi" className="pb-7 pt-2">
      <p className="pippi-eyebrow">YOUR WORKSPACE</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{projectCount ? <>Pick up where <span className="text-[#9c3041]">you left off.</span></> : <>Your next quiz <span className="text-[#9c3041]">starts here.</span></>}</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">{projectCount ? "Continue editing a recent quiz or check your latest responses." : "Write it yourself, use a head start, or get help along the way. Choose how you want to create."}</p>
      {recentQuiz && <Link href={`/editor/${encodeURIComponent(recentQuiz.id)}`} className="hq-primary mt-5 inline-flex max-w-full"><span className="min-w-0 [overflow-wrap:anywhere]">Continue editing: {recentQuiz.title}</span><ArrowRight size={16} className="shrink-0" aria-hidden="true" /></Link>}
    </section>
    {!projectCount && <section id="quiz-starters" aria-labelledby="creation-paths-title" className="mb-8 scroll-mt-8">
      <h2 id="creation-paths-title" className="mb-4 text-lg font-semibold tracking-tight">Four ways to start</h2>
      <CreationPaths busy={busy} onBlank={() => onCreate()} onAI={onAI} />
    </section>}
    <div className="mb-9 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-[#f1eee8] px-5 py-4">
      <dl aria-label="Workspace overview" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
        <div className="flex items-baseline gap-1.5"><dt className="order-2">Total quizzes</dt><dd className="order-1 font-semibold tabular-nums text-slate-900">{projectCount}</dd></div>
        <div className="flex items-baseline gap-1.5"><dt className="order-2">Published</dt><dd className="order-1 font-semibold tabular-nums text-slate-900">{publishedCount}</dd></div>
        <div className="flex items-baseline gap-1.5"><dt className="order-2">In progress</dt><dd className="order-1 font-semibold tabular-nums text-slate-900">{Math.max(0, projectCount - publishedCount)}</dd></div>
      </dl>
      <Link href="/experiments" className="inline-flex items-center gap-2 rounded text-sm font-medium text-[#922c3b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a92335]"><GitBranch size={17} aria-hidden="true" />Compare quiz versions<ArrowRight size={15} aria-hidden="true" /></Link>
    </div>
    <div id="your-quizzes" className="mb-6 flex scroll-mt-8 flex-wrap items-end justify-between gap-4">
      <div><p className="pippi-eyebrow mb-2">YOUR LIBRARY</p><h2 className="text-2xl font-semibold tracking-tight">Your quizzes</h2></div>
      <Link href="/create" className="hq-secondary"><Plus size={16} aria-hidden="true" />Create a quiz</Link>
    </div>
  </>;
}
