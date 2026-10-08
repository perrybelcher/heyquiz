"use client";
import { useState } from "react";
import { ArrowRight, Check, GitBranch, MessageCircle, ShoppingBag, Target, Users } from "lucide-react";
import { marketingTemplate } from "@/lib/marketing-templates";
import { evaluateMarketing, type MarketingConfig } from "@/lib/marketing";
const journeys: {kind:MarketingConfig['kind'];label:string;icon:typeof ShoppingBag;audience:string;explanation:string;answers:Record<string,string>}[] = [
 {kind:'product_finder',label:'Recommend a product',icon:ShoppingBag,audience:'For brands with a choice to simplify',explanation:'Give matching answers points. Exclude options that don’t fit.',answers:{use:'a1',priority:'a1',fit:'a1'}},
 {kind:'segmentation',label:'Find their path',icon:Users,audience:'For experts with different ways to help',explanation:'Connect goals and preferences to a relevant offer or next step.',answers:{experience:'a0',benefit:'a0',help:'a0'}},
 {kind:'scorecard',label:'Reveal an opportunity',icon:Target,audience:'For advisors who turn insight into action',explanation:'Score separate categories to show where attention is needed.',answers:{capture:'a0',followup:'a1',measure:'a2'}},
];
export default function JourneyShowcase(){
 const [selected,setSelected]=useState(0),j=journeys[selected],form=marketingTemplate(j.kind,'tour-example'),result=evaluateMarketing(form,j.answers)!;
 return <section className="sales-width journey-section" id="product-tour" aria-labelledby="journey-heading">
  <div className="journey-heading"><p className="sales-eyebrow">THE INTELLIGENCE BETWEEN QUESTION AND ANSWER</p><h2 id="journey-heading">One conversation.<br/>A more relevant <em>next step.</em></h2><p>Learn what matters. Connect the dots. Make your recommendation feel earned.</p></div>
  <div className="journey-tabs" aria-label="Choose an example journey">{journeys.map(({label,icon:Icon},i)=><button key={label} aria-pressed={i===selected} onClick={()=>setSelected(i)}><Icon size={17} aria-hidden="true"/>{label}</button>)}</div>
  <div className="journey-window"><div className="journey-toolbar"><span><span className="window-dots" aria-hidden="true"><i/><i/><i/></span> Quiznick / Journey preview</span><span className="journey-example">INTERACTIVE EXAMPLE</span></div>
   <div className="journey-flow" key={selected}>
    <article className="journey-card"><div className="journey-card-label"><MessageCircle size={16}/> 01 / UNDERSTAND</div><h3>Start with their world.</h3><div className="journey-answers">{form.questions.map(q=><div key={q.id}><span>{q.title}</span><strong><Check size={13}/>{q.options?.find(o=>o.id===j.answers[q.id])?.label}</strong></div>)}</div></article>
    <div className="journey-connector" aria-hidden="true"><ArrowRight size={18}/></div>
    <article className="journey-card journey-rules"><div className="journey-card-label"><GitBranch size={16}/> 02 / CONNECT</div><h3>Make the logic yours.</h3><p>{j.explanation}</p><div className="rule-pills"><span><Check size={13}/> Answer-based rules</span><span><Check size={13}/> Clear matching reasons</span><span><Check size={13}/> A fallback when needed</span></div><div className="logic-caption">Their answers shape the result.<br/>You set the criteria.</div></article>
    <div className="journey-connector" aria-hidden="true"><ArrowRight size={18}/></div>
    <article className="journey-card journey-outcome" aria-live="polite"><div className="journey-card-label"><Target size={16}/> 03 / GUIDE</div><span className="outcome-eyebrow">A NEXT STEP WITH CONTEXT</span><h3>{result.title}</h3>{result.status==='scored'?<div className="journey-scores">{result.categories.map(c=><div key={c.id}><span>{c.title}<strong>{c.score===null?'—':`${Math.round(c.score)}%`}</strong></span><div><i style={{width:`${c.score||0}%`}}/></div></div>)}</div>:<><p>{result.message}</p><div className="journey-reason"><Check size={16}/>{result.reasons[0]}</div></>}<span className="example-cta">{result.ctaLabel||'Explore your next step'}<ArrowRight size={15}/></span></article>
   </div><div className="journey-window-footer"><span>{j.audience}</span><span>Sample answers · Live matching engine · No data saved</span></div>
  </div>
 </section>;
}
