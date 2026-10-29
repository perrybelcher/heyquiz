"use client";

import { useState } from "react";
import { useInterfaceVersion } from "./v2/InterfaceContext";
import "./v2/data.css";
import Link from "next/link";
import { Search, ArrowUpRight, BarChart3 } from "lucide-react";

export type ReportQuizSummary = { id: string; title: string; updatedAt?: string; publishedAt?: string; responseCount?: number; latestResponseAt?: string };

export default function ReportsOverview({ quizzes }: { quizzes: ReportQuizSummary[] }) {
  const v2 = useInterfaceVersion() === "v2";
  const [query, setQuery] = useState("");
  const filtered = quizzes.filter(quiz => quiz.title.toLowerCase().includes(query.trim().toLowerCase()));
  return <main className={v2 ? "v2-data-page" : "max-w-5xl mx-auto px-5 py-7 sm:px-10 sm:py-10"}>
    <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
    <p className="mt-2 text-sm text-slate-500">Choose a quiz to view its responses and results.</p>
    {quizzes.length > 0 && <label className="relative block mt-7 mb-5 sm:max-w-sm"><span className="sr-only">Search quiz reports</span><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input className="hq-input pl-10" type="search" placeholder="Search quizzes…" value={query} onChange={event => setQuery(event.target.value)} /></label>}
    {quizzes.length === 0 ? <section className="mt-7 rounded-2xl border border-[#e4e5de] bg-white p-8 text-center"><BarChart3 className="mx-auto mb-3 text-slate-400" size={28} /><h2 className="font-semibold">No quiz reports yet</h2><p className="mt-2 text-sm text-slate-500">Create a quiz to start collecting responses.</p><Link href="/" className="hq-primary inline-flex mt-5">Go to my quizzes</Link></section>
      : filtered.length === 0 ? <p role="status" className="rounded-2xl border border-[#e4e5de] bg-white p-8 text-sm text-slate-500">No quizzes match your search.</p>
      : v2 ? <div className="v2-data-table-scroll" role="region" aria-label="Quiz reports" tabIndex={0}><table className="v2-data-table"><thead><tr><th scope="col">Quiz</th><th scope="col">Status</th><th scope="col">Responses</th><th scope="col">Latest response</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map(quiz => <tr key={quiz.id}><th scope="row"><Link href={`/reports/${encodeURIComponent(quiz.id)}`} className="v2-data-title">{quiz.title}</Link>{quiz.updatedAt && Number.isFinite(Date.parse(quiz.updatedAt)) && <span className="v2-data-detail">Updated {new Date(quiz.updatedAt).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" })}</span>}</th><td><span className={`v2-data-status ${quiz.publishedAt ? "is-published" : ""}`}>{quiz.publishedAt ? "Published" : "Draft"}</span></td><td className="tabular-nums">{quiz.responseCount ?? "Unavailable"}</td><td>{quiz.latestResponseAt && Number.isFinite(Date.parse(quiz.latestResponseAt)) ? new Date(quiz.latestResponseAt).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }) : "—"}</td><td><Link href={`/reports/${encodeURIComponent(quiz.id)}`} className="v2-data-action" aria-label={`View report for ${quiz.title}`}>View report <ArrowUpRight size={15} aria-hidden="true" /></Link></td></tr>)}</tbody></table></div>
      : <ul className="space-y-3">{filtered.map(quiz => <li key={quiz.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#e4e5de] bg-white px-5 py-5"><div className="min-w-0"><h2 className="font-medium break-words">{quiz.title}</h2><p className="mt-1 text-xs text-slate-500">{quiz.publishedAt ? "Published" : "Draft"}{quiz.updatedAt && Number.isFinite(Date.parse(quiz.updatedAt)) ? ` · Updated ${new Date(quiz.updatedAt).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" })}` : ""}</p><p className="mt-2 text-sm text-slate-600">{quiz.responseCount === undefined ? "Response activity unavailable" : quiz.responseCount === 0 ? "No responses yet" : `${quiz.responseCount} ${quiz.responseCount === 1 ? "response" : "responses"}`}{quiz.latestResponseAt && Number.isFinite(Date.parse(quiz.latestResponseAt)) ? ` · Latest response ${new Date(quiz.latestResponseAt).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" })}` : ""}</p></div><Link href={`/reports/${encodeURIComponent(quiz.id)}`} className="hq-secondary inline-flex items-center gap-2 shrink-0 self-start">View report <ArrowUpRight size={16} /></Link></li>)}</ul>}
  </main>;
}
