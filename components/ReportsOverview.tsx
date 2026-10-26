"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ArrowUpRight, BarChart3 } from "lucide-react";

export type ReportQuizSummary = { id: string; title: string; updatedAt?: string; publishedAt?: string };

export default function ReportsOverview({ quizzes }: { quizzes: ReportQuizSummary[] }) {
  const [query, setQuery] = useState("");
  const filtered = quizzes.filter(quiz => quiz.title.toLowerCase().includes(query.trim().toLowerCase()));
  return <main className="max-w-5xl mx-auto px-5 py-7 sm:px-10 sm:py-10">
    <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
    <p className="mt-2 text-sm text-slate-500">Choose a quiz to view its responses and results.</p>
    {quizzes.length > 0 && <label className="relative block mt-7 mb-5 sm:max-w-sm"><span className="sr-only">Search quiz reports</span><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input className="hq-input pl-10" type="search" placeholder="Search quizzes…" value={query} onChange={event => setQuery(event.target.value)} /></label>}
    {quizzes.length === 0 ? <section className="mt-7 rounded-2xl border border-[#e4e5de] bg-white p-8 text-center"><BarChart3 className="mx-auto mb-3 text-slate-400" size={28} /><h2 className="font-semibold">No quiz reports yet</h2><p className="mt-2 text-sm text-slate-500">Create a quiz to start collecting responses.</p><Link href="/" className="hq-primary inline-flex mt-5">Go to my quizzes</Link></section>
      : filtered.length === 0 ? <p role="status" className="rounded-2xl border border-[#e4e5de] bg-white p-8 text-sm text-slate-500">No quizzes match your search.</p>
      : <ul className="space-y-3">{filtered.map(quiz => <li key={quiz.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#e4e5de] bg-white px-5 py-5"><div className="min-w-0"><h2 className="font-medium break-words">{quiz.title}</h2><p className="mt-1 text-xs text-slate-500">{quiz.publishedAt ? "Published" : "Draft"}{quiz.updatedAt && Number.isFinite(Date.parse(quiz.updatedAt)) ? ` · Updated ${new Date(quiz.updatedAt).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" })}` : ""}</p></div><Link href={`/editor/${encodeURIComponent(quiz.id)}?section=results`} className="hq-secondary inline-flex items-center gap-2 shrink-0 self-start">View report <ArrowUpRight size={16} /></Link></li>)}</ul>}
  </main>;
}
