"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { QuizSubmissionResult } from "@/lib/schema";
import { reportIdentity, reportOutcome, reportScore } from "@/lib/submission-reporting";
import { filterResponses, responseFilterError, responsePage, responsesCsv, type ResponseFilters } from "@/lib/report-responses";

function timestamp(value: string) {
  return Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) : "Date unavailable";
}

export default function ReportResponses({ submissions, formId }: { submissions: QuizSubmissionResult[]; formId: string }) {
  const router = useRouter();
  const [filters, setFilters] = useState<ResponseFilters>({ query: "", from: "", to: "" });
  const [requestedPage, setRequestedPage] = useState(1);
  const [scope, setScope] = useState<"matching" | "all">("matching");
  const [exportError, setExportError] = useState("");
  const [pending, startTransition] = useTransition();
  const error = responseFilterError(filters);
  const filtered = filterResponses(submissions, filters);
  const page = responsePage(filtered, requestedPage);
  const activeFilters = Boolean(filters.query || filters.from || filters.to);
  const exportRows = scope === "all" ? submissions : filtered;
  function change(patch: Partial<ResponseFilters>) { setFilters(current => ({ ...current, ...patch })); setRequestedPage(1); setExportError(""); }
  function download() {
    if (pending || !exportRows.length || scope === "matching" && error) return;
    let url = "";
    try {
      setExportError("");
      url = URL.createObjectURL(new Blob(["\uFEFF", responsesCsv(exportRows)], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `pippi-${formId}-responses-${scope}.csv`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
    } catch { setExportError("The CSV export could not be prepared. Please try again."); }
    finally { if (url) URL.revokeObjectURL(url); }
  }
  return <section aria-labelledby="response-records-title" className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="response-records-title" className="text-xl font-semibold">Responses</h2><p className="mt-1 text-sm text-slate-500">{submissions.length} total {submissions.length === 1 ? "response" : "responses"} · Submitted dates in UTC</p></div>
      <div className="flex flex-wrap gap-3"><button className="hq-secondary" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? "Refreshing…" : "Refresh responses"}</button><Link className="hq-secondary" href={`/editor/${encodeURIComponent(formId)}?section=results`}>Manage responses</Link></div>
    </div>
    <p className="mt-3 text-xs text-slate-500">These filters apply to response submission dates. Analytics uses its own session date range and filters.</p>
    {submissions.length > 0 ? <>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium">Search responses<input type="search" className="hq-input mt-2 w-full" placeholder="Names, emails, or answers…" value={filters.query} onChange={event => change({ query: event.target.value })} /></label>
        <label className="block text-sm font-medium">Submitted from (UTC)<input type="date" className="hq-input mt-2 w-full min-w-0" aria-invalid={Boolean(error)} aria-describedby={error ? "response-filter-error" : undefined} value={filters.from} onChange={event => change({ from: event.target.value })} /></label>
        <label className="block text-sm font-medium">Submitted through (UTC)<input type="date" className="hq-input mt-2 w-full min-w-0" aria-invalid={Boolean(error)} aria-describedby={error ? "response-filter-error" : undefined} value={filters.to} onChange={event => change({ to: event.target.value })} /></label>
      </div>
      {(filters.from || filters.to) && <p className="mt-2 text-xs text-slate-500">Both selected dates are included. Responses without a known date are excluded from date-filtered results.</p>}
      {error && <p id="response-filter-error" role="alert" className="hq-error mt-3">{error}</p>}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>{!error && <p className="text-xs text-slate-500" role="status">Showing {page.start}–{page.end} of {filtered.length} matching responses · {submissions.length} total</p>}{activeFilters && <button className="mt-2 text-sm font-medium text-[#922c3b] underline" onClick={() => change({ query: "", from: "", to: "" })}>Clear response filters</button>}</div>
        <div className="flex flex-wrap items-end gap-3"><label className="block text-sm font-medium">CSV export<select className="hq-input mt-2" value={scope} onChange={event => { setScope(event.target.value as "matching" | "all"); setExportError(""); }}><option value="matching">Matching responses ({error ? "check dates" : filtered.length})</option><option value="all">All responses ({submissions.length})</option></select></label><button className="hq-secondary disabled:opacity-40" disabled={pending || !exportRows.length || scope === "matching" && Boolean(error)} onClick={download}>Export CSV</button></div>
      </div>
      <p className="mt-2 text-xs text-slate-500">{scope === "matching" ? "Exports all matching responses across every page." : "Exports all responses, ignoring the response search and date filters."}</p>
      {exportError && <p role="alert" className="hq-error mt-3">{exportError}</p>}
      {!error && !filtered.length && <div className="py-8 text-center"><h3 className="font-medium">No responses match these filters</h3><p className="mt-2 text-sm text-slate-500">Try another search or a wider date range.</p></div>}
      {!error && <ul className="mt-4 divide-y divide-stone-100">{page.rows.map((submission, index) => {
        const identity = reportIdentity(submission);
        return <li key={submission.id || `${submission.submittedAt}-${index}`} className="py-4">
          <details><summary className="cursor-pointer rounded-lg [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#922c3b]"><span className="font-medium">{identity.label} · {timestamp(submission.submittedAt)}</span>{identity.email && identity.email !== identity.label && <span className="ml-3 text-sm text-slate-600 [overflow-wrap:anywhere]">{identity.email}</span>}<span className="ml-3 text-sm text-slate-500">{reportOutcome(submission) || "Completed"}{reportScore(submission) === null ? "" : ` · ${reportScore(submission)}%`}</span><span className="ml-3 text-sm text-[#922c3b]">View answers</span></summary>
            {!submission.grading?.length && <p className="mt-4 text-sm text-slate-500">Detailed answers are unavailable for this response.</p>}
            <dl className="mt-4 space-y-4 rounded-xl bg-stone-50 p-4">{(submission.grading || []).map(answer => <div key={answer.questionId}><dt className="text-sm font-medium">{answer.questionTitle}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{answer.userAnswer || "No answer recorded"}</dd></div>)}</dl>
          </details>
        </li>;
      })}</ul>}
      {!error && filtered.length > 0 && <nav aria-label="Response pages" className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4"><p className="text-xs text-slate-500">Page {page.page} of {page.pages} · 25 per page</p><div className="flex gap-3"><button className="hq-secondary disabled:opacity-40" disabled={page.page <= 1} onClick={() => setRequestedPage(page.page - 1)}>Previous</button><button className="hq-secondary disabled:opacity-40" disabled={page.page >= page.pages} onClick={() => setRequestedPage(page.page + 1)}>Next</button></div></nav>}
    </> : <div className="py-10 text-center"><h3 className="font-medium">No responses yet</h3><p className="mt-2 text-sm text-slate-500">Publish and share your quiz to start collecting responses. Preview runs do not count.</p><Link href={`/editor/${encodeURIComponent(formId)}?section=share`} className="hq-secondary mt-4 inline-flex">Open sharing options</Link></div>}
  </section>;
}
