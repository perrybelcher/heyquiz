"use client";
import { AlignVerticalJustifyStart, ChartNoAxesCombined, ListChecks } from "lucide-react";
import type { MarketingConfig, ResultPresentation } from "@/lib/marketing";

const layouts = [
  { value: "stacked", title: "Stacked", description: "A clear story: introduction, scores, priorities and supporting details.", icon: AlignVerticalJustifyStart },
  { value: "score_overview", title: "Score overview", description: "Every category together at a glance, followed by priorities and the full detail.", icon: ChartNoAxesCombined },
  { value: "action_plan", title: "Action plan", description: "Practical advice and a next step first, with the evidence directly below.", icon: ListChecks },
] as const;

export default function ResultLayoutEditor({ marketing, onChange }: { marketing: MarketingConfig; onChange: (presentation: ResultPresentation) => void }) {
  const selected = marketing.presentation?.layout ?? "stacked";
  return <section aria-label="Result presentation" className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
    <div><h2 className="text-lg font-semibold">Choose how the result unfolds</h2><p className="mt-2 text-sm text-slate-600">Arrange the same result around what your audience needs first.</p></div>
    <fieldset className="space-y-3">
      <legend className="sr-only">Result layout</legend>
      {layouts.map(({ value, title, description, icon: Icon }) => <label key={value} className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${selected === value ? "border-red-800 bg-red-50/50" : "border-slate-200 hover:border-slate-400"}`}>
        <input type="radio" name="result-layout" value={value} checked={selected === value} onChange={() => onChange({ layout: value })} className="mt-1 shrink-0 accent-red-800" />
        <Icon className="mt-0.5 text-slate-500 shrink-0" size={18} aria-hidden="true" />
        <span><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-sm leading-relaxed text-slate-600">{description}</span></span>
      </label>)}
    </fieldset>
    <p className="text-xs leading-relaxed text-slate-500">Layouts never change scores, result rules or answer coverage. All categories remain visible. Use the answer-combination simulator to see this draft with real calculated results.</p>
    {marketing.kind !== "scorecard" && <p className="text-xs leading-relaxed text-slate-500">For recommendations, Score overview leads with the matching reasons. It does not add scores or categories to your result.</p>}
  </section>;
}
