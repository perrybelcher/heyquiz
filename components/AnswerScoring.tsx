"use client";
import { useState } from "react";
import { nanoid } from "nanoid";
import type { Question, FormSchemaType } from "@/lib/schema";
import { MarketingSchema, evaluateMarketing, type MarketingConfig } from "@/lib/marketing";

export function ScoringMode({form,onChange}:{form:FormSchemaType;onChange:(form:FormSchemaType)=>void}) {
  const value=form.marketing?.kind || (form.mode === "quiz" ? "quiz" : "none");
  function change(next:string) {
    if(next===value)return;
    if(form.marketing && !window.confirm("Changing scoring mode replaces the current marketing outcomes, categories, and scoring rules. Your questions will stay. Continue?"))return;
    const marketing=next==="quiz"||next==="none"?undefined:MarketingSchema.parse({kind:next});
    onChange({...form, mode:next==="quiz"?"quiz":"survey",marketing});
  }
  return <label className="flex items-center gap-2 text-xs font-semibold">Scoring
    <select aria-label="Scoring mode" value={value} onChange={e=>change(e.target.value)} className="max-w-48 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs">
      <option value="none">No scoring</option><option value="quiz">Correct-answer scoring</option><option value="scorecard">Scorecard</option><option value="product_finder">Product matching</option><option value="segmentation">Segment matching</option>
    </select>
  </label>;
}

export default function AnswerScoring({q,marketing,onChange,onLabelChange,form}:{q:Question;form:FormSchemaType;marketing:MarketingConfig;onChange:(m:MarketingConfig)=>void; onLabelChange?:(id:string,label:string)=>void}) {
  const [name,setName]=useState("");
  const [example,setExample]=useState("");
  let result;
  try { result=example ? evaluateMarketing(form,{[q.id]:["multiselect","image_multiselect","checkboxes"].includes(q.type)?[example]:example}) : undefined; } catch {}
  if(!q.options?.length || !["multiple_choice","multiselect","dropdown","picture_choice","image_multiselect","checkboxes","segmented","switch","thumbs","like_dislike"].includes(q.type))return null;
  const scorecard=marketing.kind==="scorecard";
  const targets=scorecard?marketing.categories:marketing.outcomes;
  const targetLabel=scorecard?"category":marketing.kind==="product_finder"?"product":"segment";
  function setRule(answerId:string,targetId:string,value:string) {
    const existing=marketing.rules.find(r=>r.questionId===q.id&&r.answerId===answerId&&r.targetId===targetId);
    const rules=marketing.rules.filter(r=>r!==existing);
    if(value!=="") rules.push({...existing,id:existing?.id||nanoid(10),questionId:q.id,answerId,targetId,effect:value==="exclude"?"exclude":"add",points:value==="exclude"?0:Math.min(100,Math.max(0,Number(value))),reason:existing?.reason||""});
    onChange({...marketing,rules});
  }
  function addTarget() {
    if(!name.trim())return;
    const id=nanoid(10), title=name.trim();
    onChange(scorecard?{...marketing,categories:[...marketing.categories,{id,title,description:"",minAnswers:1}]}:{...marketing,outcomes:[...marketing.outcomes,{id,title,description:"",advice:"",ctaLabel:"Explore this option",ctaUrl:"",minPoints:1}]});setName("");
  }
  return <section aria-label="Answer scoring" className="mt-4 border-t border-gray-200 pt-4 space-y-3" onClick={e=>e.stopPropagation()}>
    <div><h4 className="text-sm font-semibold">{scorecard?"Scorecard points":"Answer matching"}</h4><p className="mt-1 text-xs text-gray-500">{scorecard?"Give each answer 0–100 points per category. Blank means not scored; zero is a scored answer.":"Give each answer points toward a result. The highest eligible total wins. Exclusion overrides points."}</p></div>
    {targets.map(target=><fieldset key={target.id} className="rounded-lg border border-gray-200 p-3 space-y-2"><legend className="px-1 text-xs font-semibold">{target.title}</legend>
      {q.options!.map(answer=>{const rule=marketing.rules.find(r=>r.questionId===q.id&&r.answerId===answer.id&&r.targetId===target.id);return <div key={answer.id} className="flex flex-wrap items-center justify-between gap-2"><input aria-label={`${target.title} answer text ${answer.id}`} value={answer.label} onChange={e=>onLabelChange?.(answer.id,e.target.value)} className="text-xs min-w-0 flex-1 rounded border border-gray-200 p-1.5" /><div className="flex items-center gap-2">
        <input aria-label={`${answer.label}: ${target.title} points`} type="number" min={0} max={100} step="any" disabled={rule?.effect==="exclude"} value={rule?.effect==="add"?rule.points:""} placeholder="—" onChange={e=>setRule(answer.id,target.id,e.target.value)} className="w-20 rounded border border-gray-300 p-1.5 text-xs"/><span className="text-xs text-gray-500">pts</span>
        {!scorecard&&<label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={rule?.effect==="exclude"} onChange={e=>setRule(answer.id,target.id,e.target.checked?"exclude":"")} />Exclude</label>}
      </div></div>})}
    </fieldset>)}
    <div className="flex gap-2"><input aria-label={`New ${targetLabel} name`} placeholder={`Add a ${targetLabel}`} maxLength={200} value={name} onChange={e=>setName(e.target.value)} className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs"/><button type="button" disabled={!name.trim()||targets.length>=(scorecard?20:30)} onClick={addTarget} className="rounded border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-40">Add {targetLabel}</button></div>
    <div className="rounded-lg bg-gray-50 p-3 text-xs space-y-2"><label className="block font-semibold">Try an answer<select aria-label="Try an answer" value={example} onChange={e=>setExample(e.target.value)} className="mt-2 block w-full rounded border bg-white p-2"><option value="">Choose an answer to see its effect</option>{q.options.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
      {result && <div role="status"><p>{result.title}</p>{result.categories.map(c=><p key={c.id}>{c.title}: {c.score===null?"Not enough answers":`${c.score}%`}</p>)}</div>}
      <p className="text-gray-500">Single-answer example; other questions are unanswered. Use Marketing to simulate a complete journey.</p>
    </div>
    <p className="text-xs text-gray-500">Results and explanations can be edited in Marketing. These are the same rules used there.</p>
  </section>;
}
