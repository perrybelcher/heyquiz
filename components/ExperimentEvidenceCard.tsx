"use client";
import { useId } from "react";
import { analyticsFilterLabel } from "@/lib/analytics-filters";
import type { ExperimentEvidence } from "@/lib/experiment-evidence";

/** Aggregate evidence only. Proof transport is deliberately outside the display component. */
export default function ExperimentEvidenceCard({ evidence, frozen = false }: { evidence: ExperimentEvidence; frozen?: boolean }) {
  const headingId = useId(), count = evidence.counts, missing = count.reached - count.measured;
  return <section aria-labelledby={headingId} className="min-w-0 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 sm:p-5">
    <h4 id={headingId} className="text-base font-semibold text-indigo-950">{frozen ? "Supporting evidence recorded before launch" : "Supporting evidence for your review"}</h4>
    <p className="mt-2 break-words text-sm font-semibold text-slate-900">{evidence.quizTitle}</p>
    <blockquote className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">“{evidence.questionTitle}”</blockquote>
    {evidence.publicationNarrowed && <p className="mt-3 text-xs leading-relaxed text-indigo-950"><strong>Publication selection narrowed.</strong> Counts were recalculated for this published Version A; the broader Results view may differ.</p>}
    <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{([["Reached this step", count.reached], ["Instrumented here", count.measured], ["Quiet here", count.quiet], ["Finished quiz", count.completed]] as const).map(([label, value]) => <div key={label}><dt className="text-xs font-medium text-slate-600">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value.toLocaleString()}</dd></div>)}</dl>
    <p className="mt-3 text-xs leading-relaxed text-slate-700">{missing} reached {missing === 1 ? "session lacks" : "sessions lack"} detailed tracking. Quiet counts use {count.measured} instrumented {count.measured === 1 ? "session" : "sessions"}.</p>
    <p className="mt-3 break-words text-xs leading-relaxed text-slate-700"><strong>Started-session cohort:</strong> {evidence.cohort.range === "all" ? "All retained start dates" : `Last ${evidence.cohort.range} calendar days`} · {analyticsFilterLabel("source", evidence.cohort.filters.source)} · {analyticsFilterLabel("campaign", evidence.cohort.filters.campaign)}</p>
    <p className="mt-3 text-xs leading-relaxed text-slate-700">Quiet means unfinished with no activity for at least 30 minutes. People may return; this is not proof the question caused an exit.</p>
    <details className="mt-4 border-t border-indigo-200 pt-3 text-xs leading-relaxed text-slate-700">
      <summary className="cursor-pointer rounded font-semibold text-indigo-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-800">Observation details</summary>
      <dl className="mt-3 space-y-2">
        <div><dt className="font-semibold">Start-date cutoff</dt><dd className="break-words">{evidence.cutoffAt ? `${evidence.cutoffAt} (UTC)` : "All retained start dates"}</dd></div>
        <div><dt className="font-semibold">Published Version A</dt><dd className="break-words">{evidence.publishedAt} (UTC)</dd></div>
        <div><dt className="font-semibold">Observed at</dt><dd className="break-words">{evidence.observedAt} (UTC){frozen ? " · fixed observation, not live results" : " · refresh explicitly to use a newer observation"}</dd></div>
      </dl>
      <p className="mt-3">These counts describe quiz sessions, not unique people, confirmed abandonments or the experiment’s assigned-browser denominator. Finished quiz counts completions among sessions that reached this step. The observation does not establish a cause or predict improvement.</p>
    </details>
  </section>;
}
