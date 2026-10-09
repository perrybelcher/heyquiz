"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { reviewQuizCopy } from "@/lib/quiz-copy-review";
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, Trash2 } from "lucide-react";
import { MarketingBriefSchema, createMarketingStarter, type MarketingBrief } from "@/lib/marketing-brief";
import type { FormSchemaType } from "@/lib/schema";
import { evaluateMarketing } from "@/lib/marketing";
import MarketingResultCard from "./MarketingResultCard";

const empty: MarketingBrief = {audience:"",offer:"",goal:"",concerns:"",voice:"Warm, clear, helpful, and never pushy",kind:"segmentation",numQuestions:6,ctaLabel:"Explore my next step",ctaUrl:"",targets:[{title:"",description:"",ctaUrl:""},{title:"",description:"",ctaUrl:""}]};
type Preview = {form:FormSchemaType;rationale:{questionId:string;purpose:string}[]};
export default function MarketingBriefBuilder({aiAvailable}:{aiAvailable:boolean}) {
  const [brief,setBrief]=useState<MarketingBrief>(empty),[step,setStep]=useState(0),[preview,setPreview]=useState<Preview|null>(null),[answers,setAnswers]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[error,setError]=useState(""),[ready,setReady]=useState(false);
  useEffect(()=>{try{const saved=sessionStorage.getItem("pippi-marketing-brief");if(saved)setBrief({...empty,...JSON.parse(saved)});}catch{}setReady(true);},[]);
  useEffect(()=>{if(ready)try{sessionStorage.setItem("pippi-marketing-brief",JSON.stringify(brief));}catch{}},[brief,ready]);
  const change=(patch:Partial<MarketingBrief>)=>setBrief(b=>({...b,...patch}));
  const field=(label:string,key:"audience"|"offer"|"goal"|"concerns"|"voice"|"ctaLabel"|"ctaUrl",placeholder:string,max:number,multiline=false)=><label className="block text-sm font-medium">{label}{multiline?<textarea rows={3} className="hq-input mt-2" value={brief[key]} maxLength={max} placeholder={placeholder} onChange={e=>change({[key]:e.target.value})}/>:<input className="hq-input mt-2" value={brief[key]} maxLength={max} placeholder={placeholder} onChange={e=>change({[key]:e.target.value})}/>}</label>;
  function starter(){setError("");try{setPreview(createMarketingStarter(brief));setAnswers({});}catch(e){setError(e instanceof Error?e.message:"Complete your brief first.");}}
  async function generate(){
    setError("");const parsed=MarketingBriefSchema.safeParse(brief);
    if(!parsed.success){setError(parsed.error.issues.map(i=>`${i.path.join(" → ")}: ${i.message}`).join(" · "));return;}
    setBusy(true);
    try{const res=await fetch("/api/agent/marketing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(parsed.data)});const data=await res.json();if(!res.ok)throw Error(data.error || "Could not generate the draft.");setPreview(data);setAnswers({});}
    catch(e){setError(e instanceof Error?e.message:"Could not generate the draft.");}finally{setBusy(false);}
  }
  async function save(){
    if(!preview)return;
    if(preview.form.questions.some(q=>!q.title.trim()||q.options?.some(o=>!o.label.trim())||new Set(q.options?.map(o=>o.label.trim().toLowerCase())).size!==q.options?.length)){setError("Give every question and answer a clear, distinct label before saving.");return;}
    setBusy(true);setError("");
    try{const res=await fetch("/api/forms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(preview.form)});const data=await res.json();if(!res.ok)throw Error(data.error || "Could not save.");try{sessionStorage.removeItem("pippi-marketing-brief");}catch{}window.location.assign(`/editor/${data.id}`);}
    catch(e){setError(e instanceof Error?e.message:"Could not save.");setBusy(false);}
  }
  const copyFindings=preview?reviewQuizCopy(preview.form):[];
  function editQuestion(id:string,title:string){setPreview(p=>p?{...p,form:{...p.form,questions:p.form.questions.map(q=>q.id===id?{...q,title}:q)}}:p);}
  function editAnswer(id:string,answerId:string,label:string){setPreview(p=>p?{...p,form:{...p.form,marketing:p.form.marketing?{...p.form.marketing,rules:p.form.marketing.rules.map(r=>r.questionId===id&&r.answerId===answerId&&r.reason===`You selected: ${p.form.questions.find(q=>q.id===id)?.options?.find(o=>o.id===answerId)?.label}`?{...r,reason:`You selected: ${label}`}:r)}:p.form.marketing,questions:p.form.questions.map(q=>q.id===id?{...q,options:q.options?.map(o=>o.id===answerId?{...o,label}:o)}:q)}}:p);}
  const result=preview?evaluateMarketing(preview.form,answers):null;
  return <main className="min-h-screen bg-[#faf8f5] text-slate-900 px-5 py-8 sm:py-12"><div className="max-w-6xl mx-auto">
    <header className="flex items-center justify-between mb-10"><Link href="/" aria-label="Pippi workspace"><img src="/pippi-logo.svg" alt="pippi" className="w-32"/></Link><Link href="/" className="text-sm inline-flex items-center gap-2"><ArrowLeft size={16}/>Back to workspace</Link></header>
    <p className="text-sm font-semibold text-red-800 flex items-center gap-2"><Sparkles size={17}/>Marketing quiz studio</p>
    <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-3">Help people discover what matters—and what fits.</h1>
    <p className="mt-4 text-slate-600 max-w-2xl leading-relaxed">Turn your expertise into a thoughtful sequence: their goal, what gets in the way, what matters in a solution, and a relevant next step. Review the wording, test the scoring, and make it yours before publishing.</p>
    {error&&<div role="alert" className="hq-error mt-6">{error}<p className="mt-2"><a href="/login?next=%2Fcreate%2Fmarketing" className="underline">Sign in again</a> · <Link href="/" className="underline">Use a quiz starter</Link></p></div>}
    {!preview?<div className="grid lg:grid-cols-[1fr_300px] gap-7 mt-8">
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <nav aria-label="Brief steps" className="flex flex-wrap gap-3 mb-8">{["Audience & offer","Results & fit","Voice & action"].map((label,i)=><button key={label} disabled={busy} aria-current={step===i?"step":undefined} onClick={()=>setStep(i)} className={`text-sm rounded-full px-4 py-2 ${step===i?"bg-red-50 text-red-800 font-semibold":"bg-slate-50 text-slate-600"}`}>{i+1}. {label}</button>)}</nav>
        <div className="space-y-6">{step===0?<>
          {field("Who is this quiz for?","audience","Example: first-time business owners struggling to follow up with inquiries",1500,true)}
          {field("What do you offer? Include only facts you can support.","offer","Describe the product or service, who it helps, and its limitations.",2000,true)}
          {field("What should the right person do next?","goal","Book a consultation, explore a product, or request a guide",500)}
          {field("What concerns or barriers should we understand?","concerns","Cost, time, fit, previous experiences… (optional)",2000,true)}
        </>:step===1?<>
          <label className="block text-sm font-medium">Quiz goal<select className="hq-input mt-2" value={brief.kind} onChange={e=>change({kind:e.target.value as MarketingBrief["kind"]})}><option value="segmentation">Understand and segment my audience</option><option value="product_finder">Recommend a product or offer</option><option value="scorecard">Assess strengths and priorities</option></select></label>
          <p className="text-sm text-slate-600">{brief.kind==="scorecard"?"Define the categories you want to assess. Each gets its own score and practical advice.":"Define real products or audience segments. Describe who each is suitable for, including constraints. The AI can only recommend these results."}</p>
          {brief.targets.map((t,i)=><fieldset key={i} className="rounded-xl border border-slate-200 p-5 space-y-4"><legend className="text-sm font-semibold">{brief.kind==="scorecard"?"Category":"Result"} {i+1}</legend>
            <label className="block text-sm">Name<input className="hq-input mt-1" value={t.title} maxLength={120} onChange={e=>change({targets:brief.targets.map((x,j)=>j===i?{...x,title:e.target.value}:x)})}/></label>
            <label className="block text-sm">{brief.kind==="scorecard"?"What does this category measure?":"Who is this for? What makes it a fit?"}<textarea rows={3} className="hq-input mt-1" value={t.description} maxLength={1200} onChange={e=>change({targets:brief.targets.map((x,j)=>j===i?{...x,description:e.target.value}:x)})}/></label>
            {brief.kind!=="scorecard"&&<label className="block text-sm">Specific destination URL (optional)<input className="hq-input mt-1" value={t.ctaUrl} placeholder="https://" onChange={e=>change({targets:brief.targets.map((x,j)=>j===i?{...x,ctaUrl:e.target.value}:x)})}/></label>}
            {brief.targets.length>2&&<button className="text-sm text-red-800 inline-flex items-center gap-2" onClick={()=>change({targets:brief.targets.filter((_,j)=>j!==i)})}><Trash2 size={15}/>Remove {brief.kind==="scorecard"?"category":"result"}</button>}
          </fieldset>)}
          {brief.targets.length<5&&<button className="hq-secondary" onClick={()=>change({targets:[...brief.targets,{title:"",description:"",ctaUrl:""}]})}><Plus size={16}/>Add {brief.kind==="scorecard"?"category":"result"}</button>}
        </>:<>
          {field("Your voice","voice","Warm and conversational",500)}
          <label className="block text-sm font-medium">Number of questions<select className="hq-input mt-2" value={brief.numQuestions} onChange={e=>change({numQuestions:Number(e.target.value)})}>{[3,4,5,6,7,8,9,10,11,12].map(n=><option key={n}>{n}</option>)}</select></label>
          {field("Result button label","ctaLabel","Explore my next step",100)}
          {field("Default destination URL (optional)","ctaUrl","https://your-site.com/next-step",2000)}
          <p className="text-sm text-slate-600">An optional email capture step will be added before results. It does not subscribe anyone to marketing. Review capture, privacy, scoring, and every recommendation in the editor before publishing.</p>
        </>}</div>
        {step===2&&!aiAvailable&&<p className="mt-6 text-sm text-slate-600">AI generation is not connected yet. You can create and customize a starter below.</p>}
        {step===2&&<div className="mt-6 rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-600">Prefer to write the copy yourself? Create a structured starter with basic questions and scoring from your brief. Review and customize it before publishing.</p><button disabled={busy} onClick={starter} className="hq-secondary mt-3">Create starter without AI</button></div>}
        <div className="flex justify-between mt-8 gap-4"><button disabled={step===0||busy} className="hq-secondary disabled:opacity-40" onClick={()=>setStep(s=>s-1)}>Back</button>{step<2?<button className="hq-primary" onClick={()=>setStep(s=>s+1)}>Continue<ArrowRight size={16}/></button>:<button disabled={busy||!aiAvailable} className="hq-primary disabled:opacity-50" onClick={generate}><Sparkles size={16}/>{busy?"Creating your draft…":"Generate my quiz"}</button>}</div>
      </section>
      <aside className="rounded-2xl bg-[#f1ebe3] p-6 h-fit"><h2 className="font-semibold text-lg">Built around your business</h2><ul className="mt-5 space-y-4 text-sm text-slate-700">{["Questions that reveal real needs","Scoring connected to your results","A neutral answer when nothing fits","Useful advice before the offer","An editable draft, never auto-published"].map(t=><li key={t} className="flex gap-2"><Check size={17} className="shrink-0 text-red-800"/>{t}</li>)}</ul><p className="text-xs text-slate-500 mt-6">Your brief stays in this browser tab while you work. Generation sends it to our AI provider. Avoid confidential customer information.</p></aside>
    </div>:<div className="mt-8"><div className="flex flex-wrap gap-3 mb-6"><button disabled={busy} className="hq-secondary" onClick={()=>{setPreview(null);setError("");}}>Edit brief</button><button disabled={busy} className="hq-primary" onClick={save}>{busy?"Saving…":"Save draft & open editor"}<ArrowRight size={16}/></button></div><div className="grid lg:grid-cols-2 gap-7">
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6"><h2 className="text-2xl font-semibold">{preview.form.title}</h2><p className="text-slate-600">{preview.form.description}</p><p className="text-sm text-red-800">Edit the wording below, then try different answers. Scoring stays connected to the same answer choices. Nothing is published.</p>
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4"><h3 className="font-semibold">Conversation review</h3><p className="text-sm mt-2">{copyFindings.length?`${copyFindings.length} wording suggestions to review below.`:"No common wording flags found. Still check that every question earns its place."} These are editorial hints, not a conversion prediction.</p><p className="text-sm mt-2">Try a clear fit, mixed answers, and all “not sure” answers. Confirm each result is useful and honest.</p></div>{preview.form.questions.map((q,i)=><fieldset key={q.id} className="border border-slate-200 rounded-xl p-5"><legend className="font-medium">{i+1}. {q.title}</legend><p className="text-sm text-slate-500 mb-4">{preview.rationale.find(r=>r.questionId===q.id)?.purpose}</p>
        <details className="mb-4 text-sm"><summary className="cursor-pointer font-medium text-red-800">Edit question and answers</summary><label className="block mt-3">Question {i+1} wording<textarea aria-label={`Question ${i+1} wording`} className="hq-input mt-1" maxLength={1000} value={q.title} onChange={e=>editQuestion(q.id,e.target.value)}/></label>{q.options?.map((o,oi)=><label key={o.id} className="block mt-3">Question {i+1}, answer {oi+1}<input aria-label={`Question ${i+1}, answer ${oi+1}`} className="hq-input mt-1" maxLength={300} value={o.label} onChange={e=>editAnswer(q.id,o.id,e.target.value)}/></label>)}</details>
        {copyFindings.filter(f=>f.questionId===q.id).map(f=><p key={f.message} className="text-sm text-amber-900 mb-2">{f.message}</p>)}{q.options?.map(o=><label key={o.id} className="flex gap-3 items-start py-2 text-sm"><input type="radio" className="mt-1" name={q.id} checked={answers[q.id]===o.id} onChange={()=>setAnswers(a=>({...a,[q.id]:o.id}))}/>{o.label}</label>)}<details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer">View answer scoring</summary>{q.options?.map(o=><p key={o.id} className="mt-2">{o.label}: {preview.form.marketing?.rules.filter(r=>r.questionId===q.id&&r.answerId===o.id).map(r=>`${[...(preview.form.marketing?.outcomes||[]),...(preview.form.marketing?.categories||[])].find(t=>t.id===r.targetId)?.title} +${r.points}`).join(", ")||"No score"}</p>)}</details></fieldset>)}</section>
      <aside className="bg-white rounded-2xl border border-slate-200 p-6 h-fit lg:sticky lg:top-6"><p className="text-sm font-semibold text-slate-500 mb-6">Result preview · no lead is created</p>{result&&<MarketingResultCard result={result}/>}</aside>
    </div></div>}
  </div></main>;
}
