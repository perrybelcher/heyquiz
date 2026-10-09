"use client";
import { useState } from "react";
import { nanoid } from "nanoid";
import { ArrowRight, BarChart3, ShoppingBag, Users } from "lucide-react";
import { launchTemplate, launchTemplates, type LaunchTemplateId } from "@/lib/launch-templates";
import type { FormSchemaType } from "@/lib/schema";
import EditorStudio from "./EditorStudio";

export default function TemplateLibrary() {
  const [selected, setSelected] = useState<LaunchTemplateId>("product_finder");
  const [form, setForm] = useState<FormSchemaType | null>(null);
  const [error, setError] = useState("");
  const sample = launchTemplate(selected, "template-preview");
  function start() {
    const draft = launchTemplate(selected, `quiz-${nanoid(10)}`);
    try {
      // Keep earlier drafts under their own IDs; never replace their contents.
      localStorage.setItem(`heyquiz-draft:${draft.id}`, JSON.stringify(draft));
      localStorage.setItem("pippi-guest-draft", draft.id);
      setForm(draft);
    } catch { setError("Your browser could not store this draft. Enable site storage before starting so your work can be recovered."); }
  }
  if (form) return <EditorStudio initialForm={form} guest />;
  const icons = [ShoppingBag, BarChart3, Users];
  return <main className="min-h-screen bg-[#faf8f4] px-5 py-10 text-slate-900"><div className="mx-auto max-w-6xl">
    <nav className="mb-12 flex items-center justify-between gap-4"><a href="/welcome"><img src="/pippi-logo.svg" alt="Pippi home" className="w-36" /></a><a href="/create" className="text-sm underline">Return to my draft</a></nav>
    <p className="text-sm font-semibold uppercase tracking-widest text-red-800">A thoughtful starting point</p><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Skip the blank page.<br />Keep your own voice.</h1><p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">Complete question flows, answer scoring, optional contact capture, and useful results. Choose a starting point, then make it your own.</p>
    <p className="mt-6"><a href="/create/blank" className="hq-secondary">Start blank — open the full editor →</a></p>
    <div className="mt-9 grid gap-4 md:grid-cols-3">{launchTemplates.map((template, index) => { const Icon = icons[index]; return <button key={template.id} aria-pressed={selected === template.id} onClick={() => { setSelected(template.id); setError(""); }} className={`rounded-2xl border bg-white p-6 text-left focus-visible:outline-2 focus-visible:outline-red-800 ${selected === template.id ? "border-red-800 ring-1 ring-red-800" : "border-stone-200"}`}><Icon size={26} className="text-red-800" aria-hidden="true" /><h2 className="mt-5 text-xl font-semibold">{template.name}</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">{template.summary}</p><p className="mt-5 text-xs font-medium text-red-800">{template.detail}</p></button>; })}</div>
    <section aria-label="Template details" className="mt-8 grid gap-8 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 lg:grid-cols-2"><div><h2 className="text-2xl font-semibold">{sample.title}</h2><ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-600">{sample.questions.map(q => <li key={q.id}>{q.title}</li>)}</ol><h3 className="mt-6 font-semibold">Personalized results</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{sample.marketing?.kind === "scorecard" ? "Three category scores, an overall readiness score when enough answers are available, and practical next actions." : sample.marketing?.outcomes.map(o => o.title).join(" · ")}</p></div><div className="rounded-xl bg-[#faf8f4] p-6"><h3 className="text-lg font-semibold">Make it yours before publishing</h3><ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-relaxed text-slate-600"><li>Replace fictional products, services, and advice with your own.</li><li>Add real destination links to your result buttons in Marketing.</li><li>Review contact capture and add your privacy policy.</li><li>Test every result using Preview, then publish when ready.</li></ul><p className="mt-5 text-sm text-slate-600">Starting creates a new editable draft. Free account required to save and publish. Earlier drafts stay in this browser’s storage; save your current work first for easy access.</p><button onClick={start} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#a9232b] px-6 py-3 font-semibold text-white">Use this template<ArrowRight size={18} /></button>{error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}</div></section>
  </div></main>;
}
