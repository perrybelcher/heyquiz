"use client";
import { useRef, useState } from "react";
import { nanoid } from "nanoid";
import { ArrowRight, BarChart3, ShoppingBag, Users, Search, SlidersHorizontal, Check, X } from "lucide-react";
import { launchTemplate, launchTemplates, type LaunchTemplateId } from "@/lib/launch-templates";
import type { FormSchemaType } from "@/lib/schema";
import EditorStudio from "./EditorStudio";

const industries = [...new Set(launchTemplates.map(t=>t.industry))].sort();
const goals = ['Product finder','Service & audience match','Scorecard'];
const pageSize = 12;
export default function TemplateLibrary() {
  const [selected, setSelected] = useState<LaunchTemplateId | null>(null);
  const [form, setForm] = useState<FormSchemaType | null>(null);
  const [error, setError] = useState("");
  const [query,setQuery] = useState('');
  const [industry,setIndustry] = useState('');
  const [goal,setGoal] = useState('');
  const [visible,setVisible] = useState(pageSize);
  const details = useRef<HTMLElement>(null);
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  const sample = selected ? launchTemplate(selected, "template-preview") : null;
  const filtered = launchTemplates.filter(t=>(!industry || t.industry===industry)&&(!goal || t.goal===goal)&&`${t.name} ${t.industry} ${t.summary} ${t.goal}`.toLowerCase().includes(query.trim().toLowerCase()));
  function clearFilters(){setQuery('');setIndustry('');setGoal('');setVisible(pageSize);}
  function start() {
    if(!selected) return;
    const draft = launchTemplate(selected, `quiz-${nanoid(10)}`);
    try {
      // Each selection creates an independent draft; existing work keeps its own ID.
      localStorage.setItem(`heyquiz-draft:${draft.id}`, JSON.stringify(draft));
      localStorage.setItem("pippi-guest-draft", draft.id);
      setForm(draft);
    } catch { setError("Your browser could not store this draft. Enable site storage before starting so your work can be recovered."); }
  }
  function closePreview(){setSelected(null);selectedButton.current?.focus();}
  if (form) return <EditorStudio initialForm={form} guest />;
  return <main className="min-h-screen bg-[#faf8f4] px-5 py-10 text-slate-900"><div className="mx-auto max-w-6xl">
    <nav className="mb-12 flex items-center justify-between gap-4"><a href="/welcome"><img src="/pippi-logo.svg" alt="Pippi home" className="w-36" /></a><a href="/create" className="text-sm underline">Return to my draft</a></nav>
    <p className="text-sm font-semibold uppercase tracking-widest text-red-800">{launchTemplates.length} free templates. Your next idea starts here.</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">A head start for<br />your kind of business.</h1>
    <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">Help shoppers find their fit. Match prospects with the right service. Give people a useful scorecard. Start with real questions and results, then make every word your own.</p>
    <div className="mt-6 flex flex-wrap items-center gap-5 text-sm"><span className="inline-flex items-center gap-2"><Check size={16} className="text-red-800"/>Questions and scoring included</span><span className="inline-flex items-center gap-2"><Check size={16} className="text-red-800"/>No credit card required</span><a href="/create/blank" className="font-semibold underline">Prefer a blank quiz? Start here →</a></div>
    <section aria-label="Find a template" className="mt-10 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
        <label className="text-sm font-medium">Search templates<div className="relative mt-2"><Search size={18} className="absolute left-3 top-3 text-stone-400"/><input value={query} onChange={e=>{setQuery(e.target.value);setVisible(pageSize);}} placeholder="Try coffee, wedding, website…" className="w-full rounded-lg border border-stone-300 py-2.5 pl-10 pr-3 font-normal" /></div></label>
        <label className="text-sm font-medium">Industry<select value={industry} onChange={e=>{setIndustry(e.target.value);setVisible(pageSize);}} className="mt-2 w-full rounded-lg border border-stone-300 bg-white p-2.5 font-normal"><option value="">All industries</option>{industries.map(i=><option key={i}>{i}</option>)}</select></label>
        <label className="text-sm font-medium">Quiz goal<select value={goal} onChange={e=>{setGoal(e.target.value);setVisible(pageSize);}} className="mt-2 w-full rounded-lg border border-stone-300 bg-white p-2.5 font-normal"><option value="">All goals</option>{goals.map(g=><option key={g}>{g}</option>)}</select></label>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-slate-500"><p role="status">{filtered.length} {filtered.length===1?'template':'templates'} found</p>{(query||industry||goal)&&<button onClick={clearFilters} className="inline-flex items-center gap-2 font-medium text-red-800"><X size={16}/>Clear filters</button>}</div>
    </section>
    {sample && <section ref={details} tabIndex={-1} aria-label="Template details" onKeyDown={e=>{if(e.key==='Escape')closePreview();}} className="mt-6 rounded-2xl border border-red-200 bg-white p-6 outline-none sm:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-red-800">Template preview</p><h2 className="mt-2 text-2xl font-semibold">{sample.title}</h2></div><button aria-label="Close template preview" onClick={closePreview} className="rounded-lg border border-stone-200 p-2"><X size={20}/></button></div>
      <div className="mt-6 grid gap-8 lg:grid-cols-2"><div><h3 className="font-semibold">Questions your audience will answer</h3><ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-600">{sample.questions.map(q=><li key={q.id}>{q.title}</li>)}</ol><h3 className="mt-6 font-semibold">Their personalized results</h3><ul className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">{sample.marketing?.kind==='scorecard'?sample.marketing.categories.map(c=><li key={c.id}><strong>{c.title}</strong> — {c.description}</li>):sample.marketing?.outcomes.map(o=><li key={o.id}><strong>{o.title}</strong> — {o.advice}</li>)}</ul></div>
      <div className="self-start rounded-xl bg-[#faf8f4] p-6"><h3 className="text-lg font-semibold">Make it yours in the editor</h3><ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-relaxed text-slate-600"><li>Adapt the wording, answer choices, and results to your audience.</li><li>For product quizzes, add your actual products and confirm suitability rules.</li><li>Add your logo, colors, result links, and privacy policy.</li><li>Preview every result before publishing.</li></ul><p className="mt-5 text-sm text-slate-600">Edit immediately. Create a free account to save and publish. Each template starts a separate draft; your earlier drafts stay in this browser.</p><button onClick={start} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#a9232b] px-6 py-3 font-semibold text-white">Use this template<ArrowRight size={18}/></button>{error&&<p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}</div></div>
    </section>}
    <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filtered.slice(0,visible).map(template=>{const Icon=template.goal==='Product finder'?ShoppingBag:template.goal==='Scorecard'?BarChart3:Users;return <button key={template.id} aria-pressed={selected===template.id} onClick={e=>{selectedButton.current=e.currentTarget;setSelected(template.id);setError('');requestAnimationFrame(()=>{details.current?.scrollIntoView({behavior:'instant',block:'start'});details.current?.focus({preventScroll:true});});}} className={`flex flex-col rounded-2xl border bg-white p-6 text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-red-800 ${selected===template.id?'border-red-800 ring-1 ring-red-800':'border-stone-200'}`}><div className="flex w-full items-center justify-between gap-3"><span className="rounded-xl bg-red-50 p-3 text-red-800"><Icon size={22} aria-hidden="true"/></span><span className="text-xs text-slate-500">{template.industry}</span></div><h2 className="mt-5 text-xl font-semibold">{template.name}</h2><p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{template.summary}</p><p className="mt-5 text-xs text-slate-500">{template.detail}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-800">Preview template<ArrowRight size={16}/></span></button>;})}</div>
    {!filtered.length&&<div className="py-16 text-center"><SlidersHorizontal className="mx-auto text-stone-400"/><h2 className="mt-4 text-xl font-semibold">No templates match those filters yet.</h2><p className="mt-2 text-slate-600">Try a broader term or browse a different industry.</p><button onClick={clearFilters} className="mt-5 font-semibold text-red-800 underline">Show all templates</button></div>}
    {visible<filtered.length&&<div className="mt-8 text-center"><button onClick={()=>setVisible(n=>n+pageSize)} className="rounded-xl border border-stone-300 bg-white px-6 py-3 font-semibold">Show more templates ({filtered.length-visible} remaining)</button></div>}
    <p className="mt-12 text-center text-sm text-slate-500">A useful starting point, never a locked formula. Every question, answer, score, result, and design is editable.</p>
  </div></main>;
}
