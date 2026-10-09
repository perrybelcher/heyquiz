"use client";
import { nanoid } from "nanoid";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { ScorecardPresentationSchema, type MarketingConfig, type ScoreBand } from "@/lib/marketing";

function starterBands(): ScoreBand[] {
  return [[0,39,"Build your foundation"],[40,69,"Strengthen your approach"],[70,100,"Keep building on your strengths"]].map(([min,max,title])=>({id:`band-${nanoid(8)}`,min:Number(min),max:Number(max),title:String(title),advice:"",action:"",ctaLabel:"Continue",ctaUrl:""}));
}
function Bands({bands,onChange,overall}:{bands:ScoreBand[];onChange:(bands:ScoreBand[])=>void;overall:boolean}) {
  const update=(id:string,patch:Partial<ScoreBand>)=>onChange(bands.map(b=>b.id===id?{...b,...patch}:b));
  return <div className="space-y-4">
    {bands.map((b,i)=><fieldset key={b.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
      <legend className="px-2 text-sm font-semibold">Band {i+1}</legend>
      <div className="grid grid-cols-2 gap-3">{(["min","max"] as const).map(key=><label key={key} className="text-sm">{key==="min"?"From (%)":"Through (%)"}<input className="hq-input w-full" type="number" min={0} max={100} step={1} value={b[key]} onChange={e=>update(b.id,{[key]:Number(e.target.value)})}/></label>)}</div>
      <label className="block text-sm">Result headline<input className="hq-input w-full" maxLength={200} value={b.title} onChange={e=>update(b.id,{title:e.target.value})}/></label>
      <label className="block text-sm">Advice for this score<textarea className="hq-input w-full min-h-20" maxLength={4000} value={b.advice} onChange={e=>update(b.id,{advice:e.target.value})}/></label>
      {overall ? <div className="space-y-3"><label className="block text-sm">Button label<input className="hq-input w-full" maxLength={100} value={b.ctaLabel} onChange={e=>update(b.id,{ctaLabel:e.target.value})}/></label><label className="block text-sm">Destination URL<input className="hq-input w-full" placeholder="https://your-site.com/next-step" maxLength={2000} value={b.ctaUrl} onChange={e=>update(b.id,{ctaUrl:e.target.value})}/></label></div> : <label className="block text-sm">Recommended action<textarea className="hq-input w-full" maxLength={1000} value={b.action} onChange={e=>update(b.id,{action:e.target.value})}/></label>}
      <button type="button" className="text-sm text-rose-700 flex items-center gap-2" onClick={()=>onChange(bands.filter(x=>x.id!==b.id))}><Trash2 size={14}/>Remove band {i+1}</button>
    </fieldset>)}
    <button type="button" className="hq-secondary" disabled={bands.length>=10} onClick={()=>onChange([...bands,{id:`band-${nanoid(8)}`,min:0,max:100,title:"New score band",advice:"",action:"",ctaLabel:"Continue",ctaUrl:""}])}><Plus size={15}/> Add score band</button>
  </div>;
}
export default function ScorecardResultsEditor({marketing:m,onChange}:{marketing:MarketingConfig;onChange:(m:MarketingConfig)=>void}) {
  const presentation=m.scorecard;
  return <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4" aria-label="Personalized scorecard results">
    <div className="flex items-center gap-2"><Sparkles size={20}/><h2 className="text-lg font-semibold">Personalized scorecard results</h2></div>
    <p className="text-sm text-slate-600">Turn each score into useful advice and a relevant next step. Use descriptions supported by the answers, rather than promises or diagnoses.</p>
    {!presentation ? <button type="button" className="hq-primary" onClick={()=>onChange({...m,scorecard:ScorecardPresentationSchema.parse({bands:starterBands()})})}>Customize score-based results</button> : <>
      <p className="text-sm text-slate-600">Overall score is the equally weighted average of all category percentages. It appears only when every category has enough scored answers. Bands include both endpoints and must cover 0–100 without gaps or overlaps before publishing.</p>
      <label className="block text-sm">Scorecard heading<input className="hq-input w-full" maxLength={200} value={presentation.title} onChange={e=>onChange({...m,scorecard:{...presentation,title:e.target.value}})}/></label>
      <label className="block text-sm">Introduction<textarea className="hq-input w-full" maxLength={4000} value={presentation.message} onChange={e=>onChange({...m,scorecard:{...presentation,message:e.target.value}})}/></label>
      <details open className="space-y-4"><summary className="font-semibold cursor-pointer">Overall advice &amp; next step</summary><Bands overall bands={presentation.bands} onChange={bands=>onChange({...m,scorecard:{...presentation,bands}})}/></details>
      <p className="text-sm text-slate-600">Category actions appear in a list of up to three priorities, starting with the lowest scored category. Leave an action blank when no follow-up is needed.</p>
      {m.categories.map(c=><details key={c.id} className="rounded-xl border border-slate-200 p-4 space-y-4"><summary className="font-semibold cursor-pointer">{c.title}: advice by score</summary>{c.bands?.length ? <Bands overall={false} bands={c.bands} onChange={bands=>onChange({...m,categories:m.categories.map(x=>x.id===c.id?{...x,bands}:x)})}/> : <button type="button" className="hq-secondary" onClick={()=>onChange({...m,categories:m.categories.map(x=>x.id===c.id?{...x,bands:starterBands()}:x)})}>Add advice bands for {c.title}</button>}</details>)}
    </>}
  </section>;
}
