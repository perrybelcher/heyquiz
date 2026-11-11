"use client";
import { quizTypeDefinitions, type QuizType } from "@/lib/quiz-types";
import WorkspaceHeader from "./WorkspaceHeader";
import { useEffect, useState } from "react";
import { reviewQuizCopy } from "@/lib/quiz-copy-review";
import { ArrowRight, Check, Plus, Sparkles, Trash2 } from "lucide-react";
import { MarketingBriefSchema, createMarketingStarter, type MarketingBrief } from "@/lib/marketing-brief";
import { FormSchema, type FormSchemaType } from "@/lib/schema";
import { evaluateMarketing } from "@/lib/marketing";
import BrandProfilePicker from "./BrandProfilePicker";
import MarketingResultCard from "./MarketingResultCard";

const empty: MarketingBrief = {audience:"",offer:"",goal:"",concerns:"",voice:"Warm, clear, helpful, and never pushy",kind:"segmentation",numQuestions:6,ctaLabel:"Explore my next step",ctaUrl:"",targets:[{title:"",description:"",ctaUrl:""},{title:"",description:"",ctaUrl:""}]};
type Preview = {form:FormSchemaType;rationale:{questionId:string;purpose:string}[]};
export default function MarketingBriefBuilder({aiAvailable,initialQuizType,persuasive=false}:{aiAvailable:boolean;initialQuizType?:QuizType;persuasive?:boolean}) {
  const selectedKind = initialQuizType ? quizTypeDefinitions[initialQuizType].marketingKind : undefined;
  const defaults = {...empty, persuasive, numQuestions: persuasive ? 19 : 6};
  const initialBrief:MarketingBrief = selectedKind ? {...defaults,kind:selectedKind,quizType:initialQuizType} : defaults;
  const recommendation = persuasive && initialQuizType === "product_finder";
  const [previewOfferId, setPreviewOfferId] = useState("");
  const storagePrefix = persuasive ? "pippi-persuasive" : "pippi-marketing";
  const [questionsApproved,setQuestionsApproved]=useState(false);
  const [resultsReviewed,setResultsReviewed]=useState(!initialQuizType);
  const [brief,setBrief]=useState<MarketingBrief>(initialBrief),[step,setStep]=useState(0),[preview,setPreview]=useState<Preview|null>(null),[answers,setAnswers]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[authError,setAuthError]=useState(false),[error,setError]=useState(""),[ready,setReady]=useState(false),[recovered,setRecovered]=useState(false),[storageWarning,setStorageWarning]=useState(false);
  // Restore tab-local storage after hydration; it is unavailable during SSR.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{try{const saved=sessionStorage.getItem(`${storagePrefix}-brief`);if(saved){const restored=JSON.parse(saved);if(!initialQuizType || restored.quizType===initialQuizType || (recommendation && restored.quizType==="diagnostic"))setBrief({...empty,...restored,persuasive,...(recommendation ? {quizType:"product_finder",kind:"product_finder"} : {})});}}catch{}
    try {
      const saved=JSON.parse(sessionStorage.getItem(`${storagePrefix}-preview`)||"null");
      const parsed=FormSchema.safeParse(saved?.form);
      if(parsed.success && (!initialQuizType || parsed.data.quizType===initialQuizType || (recommendation && parsed.data.quizType==="diagnostic")) && Array.isArray(saved?.rationale)) {
        setPreview({form:parsed.data,rationale:saved.rationale.filter((r:Preview["rationale"][number])=>r&&typeof r.questionId==="string"&&typeof r.purpose==="string")});
        setRecovered(true);
        setResultsReviewed(!parsed.data.quizType);
      }
    }catch{}
    setReady(true);},[initialQuizType,storagePrefix,persuasive,recommendation]);
  // Report browser storage failures without discarding the in-memory brief.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{if(ready)try{sessionStorage.setItem(`${storagePrefix}-brief`,JSON.stringify(brief));}catch{setStorageWarning(true);}},[brief,ready,storagePrefix]);
  useEffect(()=>{
    if(!ready)return;
    try {
      if(preview)sessionStorage.setItem(`${storagePrefix}-preview`,JSON.stringify(preview));
      else sessionStorage.removeItem(`${storagePrefix}-preview`);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    }catch{setStorageWarning(true);}
  },[preview,ready,storagePrefix]);
  const offerStep = recommendation ? 0 : 1;
  const audienceStep = recommendation ? 1 : 0;
  const updateOffer = (index: number, patch: Partial<MarketingBrief["targets"][number]>) => {
    setBrief(current => ({ ...current, targets: current.targets.map((target, i) => i === index ? { ...target, ...patch } : target) }));
  };
  const change=(patch:Partial<MarketingBrief>)=>setBrief(b=>({...b,...patch}));
  const field=(label:string,key:"audience"|"offer"|"goal"|"concerns"|"voice"|"ctaLabel"|"ctaUrl",placeholder:string,max:number,multiline=false)=><label className="block text-sm font-medium">{label}{multiline?<textarea rows={3} className="hq-input mt-2" value={brief[key]} maxLength={max} placeholder={placeholder} onChange={e=>change({[key]:e.target.value})}/>:<input className="hq-input mt-2" value={brief[key]} maxLength={max} placeholder={placeholder} onChange={e=>change({[key]:e.target.value})}/>}</label>;
  function starter(){setError("");setAuthError(false);try{setPreviewOfferId("");setQuestionsApproved(false);setPreview(createMarketingStarter(recommendation ? {...brief,ctaUrl:""} : brief));setResultsReviewed(!brief.quizType);setAnswers({});}catch(e){setError(e instanceof Error?e.message:"Complete your brief first.");}}
  async function generate(){
    setError("");setAuthError(false);const parsed=MarketingBriefSchema.safeParse({...brief,persuasive,...(recommendation ? {ctaUrl:""} : {})});
    if(!parsed.success){setError(parsed.error.issues.map(i=>`${i.path.join(" → ")}: ${i.message}`).join(" · "));return;}
    setBusy(true);
    const fallback = "Could not generate the draft. Your brief is still here.";
    try {
      const res = await fetch("/api/agent/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        setAuthError(res.status === 401);
        const data = await res.json().catch(() => null);
        const message = typeof data?.error === "string" ? data.error : fallback;
        const reference = res.headers.get("X-Pippi-Reference");
        setError(reference ? `${message} (Support reference ${reference})` : message);
        return;
      }
      setPreview(await res.json());
      setQuestionsApproved(false);
      setPreviewOfferId("");
      setResultsReviewed(!brief.quizType);
      setAnswers({});
    } catch {
      setError(fallback);
    } finally {
      setBusy(false);
    }
  }
  async function save(){
    if(!preview)return;
    if(persuasive && !questionsApproved){setError("Approve the questions before creating your quiz.");return;}
    if(preview.form.quizType && !resultsReviewed){setError("Review your possible results before opening the question editor.");return;}
    if(preview.form.questions.some(q=>!q.title.trim()||q.options?.some(o=>!o.label.trim())||new Set(q.options?.map(o=>o.label.trim().toLowerCase())).size!==q.options?.length)){setError("Give every question and answer a clear, distinct label before saving.");return;}
    setBusy(true);setError("");setAuthError(false);
    try{const res=await fetch("/api/forms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(preview.form)});const data=await res.json();if(!res.ok){setAuthError(res.status===401);throw Error(data.error || "Could not save.");}try{sessionStorage.removeItem(`${storagePrefix}-brief`);sessionStorage.removeItem(`${storagePrefix}-preview`);}catch{}window.location.assign(`/editor/${data.id}`);}
    catch(e){setError(e instanceof Error?e.message:"Could not save.");setBusy(false);}
  }
  const copyFindings=preview?reviewQuizCopy(preview.form):[];
  function editQuestion(id:string,title:string){setQuestionsApproved(false);setPreview(p=>p?{...p,form:{...p.form,questions:p.form.questions.map(q=>q.id===id?{...q,title}:q)}}:p);}
  function editAnswer(id:string,answerId:string,label:string){setQuestionsApproved(false);setPreview(p=>p?{...p,form:{...p.form,marketing:p.form.marketing?{...p.form.marketing,rules:p.form.marketing.rules.map(r=>r.questionId===id&&r.answerId===answerId&&r.reason===`You selected: ${p.form.questions.find(q=>q.id===id)?.options?.find(o=>o.id===answerId)?.label}`?{...r,reason:`You selected: ${label}`}:r)}:p.form.marketing,questions:p.form.questions.map(q=>q.id===id?{...q,options:q.options?.map(o=>o.id===answerId?{...o,label}:o)}:q)}}:p);}
  const matchingResult = preview ? evaluateMarketing(preview.form, answers) : undefined;
  const offerOutcomes = preview?.form.marketing?.outcomes ?? [];
  const previewOffer = offerOutcomes.find(offer => offer.id === previewOfferId);
  const fallbackPreview = preview && previewOfferId ? evaluateMarketing(preview.form, {}) : undefined;
  const result = fallbackPreview && previewOffer
    ? { ...fallbackPreview, status: "matched" as const, outcomeId: previewOffer.id, title: previewOffer.title,
        message: previewOffer.description, advice: previewOffer.advice, ctaLabel: previewOffer.ctaLabel, ctaUrl: previewOffer.ctaUrl }
    : fallbackPreview ?? matchingResult;
  return <><WorkspaceHeader active="overview" /><main className="min-h-screen bg-[#faf8f5] text-slate-900 px-5 py-8 sm:py-12"><div className="max-w-6xl mx-auto">

    <p className="text-sm font-semibold text-red-800 flex items-center gap-2"><Sparkles size={17}/>{persuasive ? "Create an AI recommendation quiz" : "Marketing quiz studio"}</p>
    <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-3">{persuasive ? "Help people find the right product or service." : "Help people discover what matters—and what fits."}</h1>
    <p className="mt-4 text-slate-600 max-w-2xl leading-relaxed">{recommendation ? "Add the products or services you want to recommend. AI drafts the questions, and you can check each recommendation and its button before creating the quiz." : "Describe your audience and offers, then review the questions and test the results before publishing."}</p>
    {!preview && ready && <BrandProfilePicker brief={brief} disabled={busy} onApply={value=>{setBrief(selectedKind ? {...value,persuasive,numQuestions:brief.numQuestions,kind:selectedKind,quizType:initialQuizType} : {...value,persuasive});setStep(0);setError("");setAuthError(false);}}/>}
    {recovered&&preview&&<p role="status" className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-900">Your unsaved draft was restored from this tab. Review it and save it to your account when ready.</p>}
    {storageWarning&&<p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm">This browser could not back up your draft. Keep this tab open and save to your account before leaving.</p>}
    {error&&<div role="alert" className="hq-error mt-6">{error}<p className="mt-2">{authError&&<><a href={recommendation ? "/login?next=%2Fcreate%2Fpersuasive" : "/login?next=%2Fcreate%2Fmarketing"} className="underline">Sign in again</a> · </>}{!preview&&<button disabled={busy} onClick={starter} className="underline">Create starter from this brief</button>}</p></div>}
    {!preview?<div className="grid lg:grid-cols-[1fr_300px] gap-7 mt-8">
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <nav aria-label="Brief steps" className="flex flex-wrap gap-3 mb-8">{(recommendation ? ["Products & services", "Audience & goal", "Generate questions"] : ["Audience & offer","Results & fit","Voice & action"]).map((label,i)=><button key={label} disabled={busy} aria-current={step===i?"step":undefined} onClick={()=>setStep(i)} className={`text-sm rounded-full px-4 py-2 ${step===i?"bg-red-50 text-red-800 font-semibold":"bg-slate-50 text-slate-600"}`}>{i+1}. {label}</button>)}</nav>
        <div className="space-y-6">{step===audienceStep?<>
          {field("Who is this quiz for?","audience","Example: first-time business owners struggling to follow up with inquiries",1500,true)}
          {field("What do you offer? Include only facts you can support.","offer","Describe the product or service, who it helps, and its limitations.",2000,true)}
          {field("What should the right person do next?","goal","Book a consultation, explore a product, or request a guide",500)}
          {field("What concerns or barriers should we understand?","concerns","Cost, time, fit, previous experiences… (optional)",2000,true)}
        </>:step===offerStep?<>
          {!recommendation && <label className="block text-sm font-medium">Quiz goal<select disabled={Boolean(initialQuizType)} className="hq-input mt-2" value={brief.kind} onChange={e=>change({kind:e.target.value as MarketingBrief["kind"],quizType:undefined})}><option value="segmentation">Understand and segment my audience</option><option value="product_finder">Recommend a product or offer</option><option value="scorecard">Assess strengths and priorities</option><option value="qualification">Check fit and choose a route</option></select></label>}
          <p className="text-sm text-slate-600">{recommendation ? "Add 2 to 5 products or services. Each becomes a recommendation with its own description and next step." : brief.kind==="scorecard"?"Define the categories you want to assess. Each gets its own score and practical advice.":"Define real products or audience segments. Describe who each is suitable for, including constraints. The AI can only recommend these results."}</p>
          {brief.targets.map((t,i)=><fieldset key={i} className="rounded-xl border border-slate-200 p-5 space-y-4"><legend className="text-sm font-semibold">{recommendation ? "Product or service" : brief.kind==="scorecard"?"Category":"Result"} {i+1}</legend>
            <label className="block text-sm">{recommendation ? "Product or service name" : "Name"}<input className="hq-input mt-1" value={t.title} placeholder={recommendation ? "e.g. Starter Website" : undefined} maxLength={120} onChange={e=>change({targets:brief.targets.map((x,j)=>j===i?{...x,title:e.target.value}:x)})}/></label>
            <label className="block text-sm">{brief.kind==="scorecard"?"What does this category measure?":"Who is this for? What makes it a fit?"}<textarea rows={3} className="hq-input mt-1" value={t.description} maxLength={1200} onChange={e=>change({targets:brief.targets.map((x,j)=>j===i?{...x,description:e.target.value}:x)})}/></label>
            {recommendation && <>
              <label className="block text-sm">What should visitors know about this offer? (optional)
                <textarea rows={2} className="hq-input mt-1" value={t.resultDescription ?? ""} maxLength={1200}
                  placeholder="e.g. A simple website package for businesses that need to launch quickly."
                  onChange={e => updateOffer(i, { resultDescription: e.target.value })} />
              </label>
              <label className="block text-sm">Button text (optional)
                <input className="hq-input mt-1" value={t.ctaLabel ?? ""} maxLength={100}
                  placeholder="e.g. View the package" onChange={e => updateOffer(i, { ctaLabel: e.target.value })} />
              </label>
            </>}
            {brief.kind!=="scorecard"&&<label className="block text-sm">{recommendation ? "Product page or booking link (optional)" : "Specific destination URL (optional)"}<input className="hq-input mt-1" value={t.ctaUrl} placeholder="https://" onChange={e=>change({targets:brief.targets.map((x,j)=>j===i?{...x,ctaUrl:e.target.value}:x)})}/></label>}
            {brief.targets.length>2&&<button className="text-sm text-red-800 inline-flex items-center gap-2" onClick={()=>change({targets:brief.targets.filter((_,j)=>j!==i)})}><Trash2 size={15}/>Remove {recommendation ? "product or service" : brief.kind==="scorecard"?"category":"result"}</button>}
          </fieldset>)}
          {brief.targets.length<5&&<button className="hq-secondary" onClick={()=>change({targets:[...brief.targets,{title:"",description:"",ctaUrl:""}]})}><Plus size={16}/>Add {recommendation ? "product or service" : brief.kind==="scorecard"?"category":"result"}</button>}
        </>:<>
          {field("Your voice","voice","Warm and conversational",500)}
          <label className="block text-sm font-medium">Number of questions<select className="hq-input mt-2" value={brief.numQuestions} onChange={e=>change({numQuestions:Number(e.target.value)})}>{[3,4,5,6,7,8,9,10,11,12,15,19,20,25,30].map(n=><option key={n}>{n}</option>)}</select></label>
          {field("Result button label","ctaLabel","Explore my next step",100)}
          {!recommendation && field("Default destination URL (optional)","ctaUrl","https://your-site.com/next-step",2000)}
          <p className="text-sm text-slate-600">{persuasive ? "An optional email capture step will be added after results." : "An optional email capture step will be added before results."} It does not subscribe anyone to marketing. Review capture, privacy, scoring, and every recommendation in the editor before publishing.</p>
        </>}</div>
        {step===2&&!aiAvailable&&<p className="mt-6 text-sm text-slate-600">AI generation is not connected yet. You can create and customize a starter below.</p>}
        {step===2&&<div className="mt-6 rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-600">Prefer to write the copy yourself? Create a structured starter with up to 12 basic questions and scoring from your brief. Review and customize it before publishing.</p><button disabled={busy} onClick={starter} className="hq-secondary mt-3">Create starter without AI</button></div>}
        <div className="flex justify-between mt-8 gap-4"><button disabled={step===0||busy} className="hq-secondary disabled:opacity-40" onClick={()=>setStep(s=>s-1)}>Back</button>{step<2?<button className="hq-primary" onClick={()=>setStep(s=>s+1)}>Continue<ArrowRight size={16}/></button>:<button disabled={busy||!aiAvailable} className="hq-primary disabled:opacity-50" onClick={generate}><Sparkles size={16}/>{busy?"Creating your draft…":persuasive ? "Propose my questions" : "Generate my quiz"}</button>}</div>
      </section>
      <aside className="rounded-2xl bg-[#f1ebe3] p-6 h-fit"><h2 className="font-semibold text-lg">Built around your business</h2><ul className="mt-5 space-y-4 text-sm text-slate-700">{["Questions that reveal real needs","Scoring connected to your results","A neutral answer when nothing fits","Useful advice before the offer","An editable draft, never auto-published"].map(t=><li key={t} className="flex gap-2"><Check size={17} className="shrink-0 text-red-800"/>{t}</li>)}</ul><p className="text-xs text-slate-500 mt-6">Your brief and unsaved preview stay in this browser tab while you work. Closing the tab may clear them. Generation sends it to our AI provider. Avoid confidential customer information.</p></aside>
    </div>:<div className="mt-8"><div className="flex flex-wrap gap-3 mb-6">{persuasive && resultsReviewed && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={questionsApproved} onChange={e=>setQuestionsApproved(e.target.checked)}/>I reviewed the questions and answers and approve this draft.</label>}<button disabled={busy} className="hq-secondary" onClick={()=>{setPreview(null);setError("");setAuthError(false);}}>Edit brief</button><button disabled={busy || !resultsReviewed || (persuasive && !questionsApproved)} className="hq-primary" onClick={save}>{busy?"Saving…":persuasive ? "Approve & create quiz" : "Save draft & open editor"}<ArrowRight size={16}/></button></div>{!resultsReviewed && <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-6"><h2 className="text-xl font-semibold">{recommendation ? "Review your recommendations" : "Review your possible results"}</h2><p className="text-sm text-slate-600 mt-2">Confirm the results people can receive before editing questions. Appearance previews do not prove an answer path reaches a result.</p>{(preview.form.marketing?.kind === "scorecard" ? preview.form.marketing.categories : preview.form.marketing?.outcomes ?? []).map(outcome=><article className="mt-4 border rounded-xl p-4" key={outcome.id}><h3 className="font-semibold">{outcome.title}</h3><p className="text-sm mt-2">{outcome.description}</p>{"advice" in outcome && <p className="text-sm mt-2">{outcome.advice}</p>}{recommendation && "ctaUrl" in outcome && <p className="mt-2 break-all text-sm text-slate-600">{outcome.ctaUrl ? `${outcome.ctaLabel} → ${outcome.ctaUrl}` : "This result has no linked button."}</p>}</article>)}<button className="hq-primary mt-5" onClick={()=>setResultsReviewed(true)}>Confirm results and review questions</button><p className="text-sm mt-3">Use Edit brief to change results. Design controls are available in the editor after saving this draft.</p></section>}<div className="grid lg:grid-cols-2 gap-7">
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6"><h2 className="text-2xl font-semibold">{preview.form.title}</h2><p className="text-slate-600">{preview.form.description}</p><p className="text-sm text-red-800">Edit the wording below, then try different answers. Scoring stays connected to the same answer choices. Nothing is published.</p>
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4"><h3 className="font-semibold">Conversation review</h3><p className="text-sm mt-2">{copyFindings.length?`${copyFindings.length} wording suggestions to review below.`:"No common wording flags found. Still check that every question earns its place."} These are editorial hints, not a conversion prediction.</p><p className="text-sm mt-2">Try a clear fit, mixed answers, and all “not sure” answers. Confirm each result is useful and honest.</p></div>{resultsReviewed && preview.form.questions.map((q,i)=><fieldset key={q.id} className="border border-slate-200 rounded-xl p-5"><legend className="font-medium">{i+1}. {q.title}</legend><p className="text-sm text-slate-500 mb-4">{preview.rationale.find(r=>r.questionId===q.id)?.purpose}</p>
        <details className="mb-4 text-sm"><summary className="cursor-pointer font-medium text-red-800">Edit question and answers</summary><label className="block mt-3">Question {i+1} wording<textarea aria-label={`Question ${i+1} wording`} className="hq-input mt-1" maxLength={1000} value={q.title} onChange={e=>editQuestion(q.id,e.target.value)}/></label>{q.options?.map((o,oi)=><label key={o.id} className="block mt-3">Question {i+1}, answer {oi+1}<input aria-label={`Question ${i+1}, answer ${oi+1}`} className="hq-input mt-1" maxLength={300} value={o.label} onChange={e=>editAnswer(q.id,o.id,e.target.value)}/></label>)}</details>
        {copyFindings.filter(f=>f.questionId===q.id).map(f=><p key={f.message} className="text-sm text-amber-900 mb-2">{f.message}</p>)}{q.options?.map(o=><label key={o.id} className="flex gap-3 items-start py-2 text-sm"><input type="radio" className="mt-1" name={q.id} checked={answers[q.id]===o.id} onChange={()=>{setPreviewOfferId("");setAnswers(a=>({...a,[q.id]:o.id}));}}/>{o.label}</label>)}<details className="mt-3 text-xs text-slate-500" open={recommendation || undefined}><summary className="cursor-pointer">{recommendation ? "How answers affect recommendations" : "View answer logic"}</summary>{preview.form.marketing?.kind === "qualification" && <p>Qualification uses ordered route conditions. Review these in the editor; the first matching route wins.</p>}{q.options?.map(o=><p key={o.id} className="mt-2">{o.label}: {preview.form.marketing?.rules.filter(r=>r.questionId===q.id&&r.answerId===o.id).map(r=>`${[...(preview.form.marketing?.outcomes||[]),...(preview.form.marketing?.categories||[])].find(t=>t.id===r.targetId)?.title} +${r.points}`).join(", ")||(recommendation ? "No recommendation points" : "No score")}</p>)}</details></fieldset>)}</section>
      <aside className="bg-white rounded-2xl border border-slate-200 p-6 h-fit lg:sticky lg:top-6"><h2 className="text-xl font-semibold mb-3">Visitor result preview</h2>
      {recommendation && <label className="mb-4 block text-sm font-medium">Result to preview
        <select className="hq-input mt-2" value={previewOfferId} onChange={event => setPreviewOfferId(event.target.value)}>
          <option value="">Match my test answers</option>
          {offerOutcomes.map(offer => <option key={offer.id} value={offer.id}>{offer.title}</option>)}
          <option value="fallback">No clear match</option>
        </select>
      </label>}
      {recommendation && previewOfferId && <p className="mb-3 text-sm text-slate-500">Showing this result directly. Choose “Match my test answers” to check which result the quiz selects.</p>}<p className="text-sm text-slate-500 mb-3">{Object.keys(answers).length} of {preview.form.questions.length} questions answered. Try different paths before saving.</p><button type="button" className="hq-secondary mb-6" onClick={()=>setAnswers({})} disabled={!Object.keys(answers).length}>Reset test answers</button>{result&&<MarketingResultCard result={result}/>}</aside>
    </div></div>}
  </div></main></>;
}
