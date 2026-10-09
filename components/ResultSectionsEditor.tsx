"use client";

import { nanoid } from "nanoid";
import { Video, ArrowDown, ArrowUp, FileText, ImageIcon, MessageSquareQuote, HelpCircle, MousePointerClick, Trash2 } from "lucide-react";
import type { MarketingConfig, ResultSection } from "@/lib/marketing";

const choices = [
  { type: "text", label: "Helpful advice", icon: FileText },
  { type: "video", label: "Video", icon: Video },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "testimonial", label: "Testimonial", icon: MessageSquareQuote },
  { type: "faq", label: "FAQ", icon: HelpCircle },
  { type: "cta", label: "Next step", icon: MousePointerClick },
] as const;

export default function ResultSectionsEditor({ marketing, onChange }: {
  marketing: MarketingConfig; onChange: (value: MarketingConfig) => void;
}) {
  const sections = marketing.resultSections ?? [];
  const commit = (resultSections: ResultSection[]) => onChange({ ...marketing, resultSections });
  const update = (id: string, patch: Partial<ResultSection>) => commit(sections.map(s => s.id === id ? { ...s, ...patch } : s));
  const move = (index: number, delta: number) => {
    const next = [...sections];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    commit(next);
  };
  return <section aria-label="Result page sections" className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Results designer</p><h2 className="text-xl font-semibold mt-2">Make the next step feel natural</h2><p className="text-sm text-slate-600 mt-2">Add useful context below the personalized results, before the main offer. Choose which results should show each section. Use the result simulator to preview your changes.</p></div>
    <div className="flex flex-wrap gap-2">{choices.map(({type,label,icon:Icon}) => <button type="button" key={type} disabled={sections.length >= 12} className="hq-secondary text-sm" onClick={() => commit([...sections, {id:`section-${nanoid(8)}`,type,title:"",body:"",url:"",label:""}])}><Icon size={16} aria-hidden="true"/>{label}</button>)}</div>
    {!sections.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Start with helpful advice, answer a common question, then give visitors a clear next step.</p>}
    {sections.map((s,i) => <details key={s.id} open className="rounded-xl border border-slate-200 p-4">
      <summary className="font-semibold cursor-pointer">{i+1}. {s.title || choices.find(c=>c.type===s.type)?.label}</summary>
      <div className="space-y-3 mt-4">
        <div className="flex gap-2 justify-end"><button type="button" className="hq-secondary" aria-label={`Move section ${i+1} up`} disabled={i===0} onClick={()=>move(i,-1)}><ArrowUp size={16}/></button><button type="button" className="hq-secondary" aria-label={`Move section ${i+1} down`} disabled={i===sections.length-1} onClick={()=>move(i,1)}><ArrowDown size={16}/></button><button type="button" className="hq-secondary" aria-label={`Remove section ${i+1}`} onClick={()=>commit(sections.filter(x=>x.id!==s.id))}><Trash2 size={16}/></button></div>
        <label className="block text-sm">Show this section<select className="hq-input w-full" value={s.condition?.type ?? "all"} onChange={e => update(s.id, {condition:e.target.value === "all" ? undefined : e.target.value === "outcome" ? {type:"outcome",outcomeId:marketing.outcomes[0]?.id ?? "missing"} : {type:"score",min:0,max:100,...(!marketing.scorecard && marketing.categories[0] ? {categoryId:marketing.categories[0].id} : {})}})}><option value="all">On every result</option>{marketing.kind !== "scorecard" ? <option value="outcome">For a specific result</option> : <option value="score">Within a score range</option>}</select></label>
        {s.condition?.type === "outcome" && <label className="block text-sm">Matching result<select className="hq-input w-full" value={s.condition.outcomeId} onChange={e=>update(s.id,{condition:{type:"outcome",outcomeId:e.target.value}})}>{!marketing.outcomes.some(o=>o.id===(s.condition?.type === "outcome" ? s.condition.outcomeId : "")) && <option value={s.condition.outcomeId}>Choose an existing result</option>}{marketing.outcomes.map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select></label>}
        {s.condition?.type === "score" && <div className="space-y-3"><label className="block text-sm">Score to use<select className="hq-input w-full" value={s.condition.categoryId ?? "overall"} onChange={e=>{if(s.condition?.type === "score") update(s.id,{condition:{...s.condition,categoryId:e.target.value === "overall" ? undefined : e.target.value}});}}><option value="overall">Overall score{!marketing.scorecard ? " (enable score-based results below)" : ""}</option>{marketing.categories.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><div className="grid grid-cols-2 gap-3">{(["min","max"] as const).map(key=><label key={key} className="text-sm">{key === "min" ? "Minimum score (%)" : "Maximum score (%)"}<input className="hq-input w-full" type="number" min={0} max={100} step={1} value={s.condition?.type === "score" ? s.condition[key] : 0} onChange={e=>{if(s.condition?.type === "score") update(s.id,{condition:{...s.condition,[key]:Number(e.target.value)}});}}/></label>)}</div><p className="text-xs text-slate-500">Both endpoints are included. Hidden when there are not enough scored answers.</p></div>}
        <label className="block text-sm">{s.type === "testimonial" ? "Attribution" : s.type === "faq" ? "Question" : "Heading"}<input className="hq-input w-full" maxLength={200} value={s.title} onChange={e=>update(s.id,{title:e.target.value})}/></label>
        <label className="block text-sm">{s.type === "testimonial" ? "Customer quote (use with permission)" : s.type === "faq" ? "Answer" : "Content"}<textarea className="hq-input w-full min-h-24" maxLength={4000} value={s.body} onChange={e=>update(s.id,{body:e.target.value})}/></label>
        {(s.type === "image" || s.type === "cta" || s.type === "video") && <><label className="block text-sm">{s.type === "image" ? "Image URL" : s.type === "video" ? "YouTube or Vimeo URL" : "Destination URL"}<input type="url" className="hq-input w-full" placeholder="https://" maxLength={2000} value={s.url} onChange={e=>update(s.id,{url:e.target.value})}/></label><label className="block text-sm">{s.type === "image" ? "Image description (alt text)" : s.type === "video" ? "Video description" : "Button label"}<input className="hq-input w-full" maxLength={200} value={s.label} onChange={e=>update(s.id,{label:e.target.value})}/></label></>}
      </div>
    </details>)}
    <p className="text-xs text-slate-500">{sections.length} of 12 sections</p>
  </section>;
}
