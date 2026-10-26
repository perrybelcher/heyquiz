"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { QuizSubmissionResult } from "@/lib/schema";
import { reportOutcome, reportScore } from "@/lib/submission-reporting";

function timestamp(value: string) {
  return Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) : "Date unavailable";
}

export default function ReportResponses({ submissions, formId }: { submissions: QuizSubmissionResult[]; formId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const filtered = submissions.filter(submission => `${submission.respondentName || ""} ${reportOutcome(submission)} ${(submission.grading || []).map(answer => `${answer.questionTitle} ${answer.userAnswer}`).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section aria-labelledby="response-records-title" className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="response-records-title" className="text-xl font-semibold">All-time responses</h2><p className="mt-1 text-sm text-slate-500">{submissions.length} {submissions.length === 1 ? "response" : "responses"} · Dates in UTC · Independent of the analytics date filter</p></div>
      <div className="flex flex-wrap gap-3"><button className="hq-secondary" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? "Refreshing…" : "Refresh responses"}</button><Link className="hq-secondary" href={`/editor/${encodeURIComponent(formId)}?section=results`}>Manage responses & export</Link></div>
    </div>
    {submissions.length > 0 ? <>
      <label className="mt-5 block sm:max-w-sm"><span className="sr-only">Search responses</span><input type="search" className="hq-input" placeholder="Search responses…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <p className="mt-3 text-xs text-slate-500" role="status">Showing {filtered.length} of {submissions.length} responses</p>
      <ul className="mt-4 divide-y divide-stone-100">{filtered.map((submission, index) => <li key={submission.id || `${submission.submittedAt}-${index}`} className="py-4">
        <details><summary className="cursor-pointer rounded-lg [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#922c3b]"><span className="font-medium">{submission.respondentName || "Response"} · {timestamp(submission.submittedAt)}</span><span className="ml-3 text-sm text-slate-500">{reportOutcome(submission) || "Completed"}{reportScore(submission) === null ? "" : ` · ${reportScore(submission)}%`}</span><span className="ml-3 text-sm text-[#922c3b]">View answers</span></summary>
          {!submission.grading?.length && <p className="mt-4 text-sm text-slate-500">Detailed answers are unavailable for this response.</p>}
          <dl className="mt-4 space-y-4 rounded-xl bg-stone-50 p-4">{(submission.grading || []).map(answer => <div key={answer.questionId}><dt className="text-sm font-medium">{answer.questionTitle}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{answer.userAnswer || "No answer recorded"}</dd></div>)}</dl>
        </details>
      </li>)}</ul>
    </> : <div className="py-10 text-center"><h3 className="font-medium">No responses yet</h3><p className="mt-2 text-sm text-slate-500">Publish and share your quiz to start collecting responses. Preview runs do not count.</p><Link href={`/editor/${encodeURIComponent(formId)}?section=share`} className="hq-secondary mt-4 inline-flex">Open sharing options</Link></div>}
  </section>;
}
