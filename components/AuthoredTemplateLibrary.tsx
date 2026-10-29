"use client";
import { useRef, useState } from "react";
import { nanoid } from "nanoid";
import { authoredTemplates } from "@/lib/authored-templates";
import { createQuizTemplate } from "@/lib/template-factory";
import { outcomeCreationEnabled } from "@/lib/outcome-availability";
import { quizTypeDefinitions, type QuizType } from "@/lib/quiz-types";
import type { FormSchemaType } from "@/lib/schema";
import QuizTypeChooser from "./QuizTypeChooser";
import WorkspaceHeader from "./WorkspaceHeader";
import TemplateVisual from "./TemplateVisual";
import { useInterfaceVersion } from "./v2/InterfaceContext";

export default function AuthoredTemplateLibrary({initialQuizType,onTypeChange,onCreate,onLegacy,error}: {
  initialQuizType?: QuizType; onTypeChange: (type: QuizType) => void;
  onCreate: (form: FormSchemaType) => void; onLegacy: () => void; error: string;
}) {
  const v2 = useInterfaceVersion() === "v2";
  const [selected,setSelected] = useState<string>();
  const [query,setQuery] = useState("");
  const preview = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const templates = authoredTemplates.filter(t => (!initialQuizType || t.quizType === initialQuizType) && (outcomeCreationEnabled || quizTypeDefinitions[t.quizType].scored) && `${t.title} ${t.summary} ${t.audience}`.toLowerCase().includes(query.toLowerCase().trim()));
  const sample = selected ? createQuizTemplate(selected,"template-preview") : null;
  function close(){setSelected(undefined);trigger.current?.focus();}
  return <><WorkspaceHeader active="templates"/><main className={`mx-auto max-w-6xl space-y-7 px-5 py-8 ${v2?"v2-page v2-templates":""}`}>
    <div><h1 className="text-3xl font-semibold">Choose a quiz template</h1><p className="mt-3 text-slate-600">Choose the outcome, explore complete examples, then review the results and make the design your own.</p></div>
    <QuizTypeChooser selected={initialQuizType} onSelect={type=>{onTypeChange(type);setSelected(undefined);setQuery("");}}/>
    <div className="flex flex-wrap items-end justify-between gap-4"><label className="block text-sm font-medium">Search this collection<input className="mt-2 block rounded-lg border p-3" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search questions, topics or uses"/></label><button className="text-sm underline" onClick={onLegacy}>Browse additional existing templates</button></div>
    <p role="status" className="text-sm text-slate-600">{templates.length} templates · Short examples have 8 questions; comprehensive examples have 30.</p>
    {sample && <section ref={preview} tabIndex={-1} aria-label="Template details" onKeyDown={e=>{if(e.key==='Escape')close();}} className="space-y-5 rounded-2xl border border-red-200 bg-white p-5 sm:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-red-800">Template preview · {sample.questions.length} questions</p><h2 className="mt-2 text-2xl font-semibold">{sample.title}</h2></div><button aria-label="Close template preview" className="rounded-lg border p-2" onClick={close}>Close</button></div>
      <p className="text-slate-600">{sample.description}</p><TemplateVisual form={sample} large/>
      <div className="grid gap-6 lg:grid-cols-2"><div><h3 className="font-semibold">Questions and answer choices</h3><ol className="mt-3 list-decimal space-y-4 pl-5">{sample.questions.map(q=><li key={q.id}><p>{q.title}</p>{q.description&&<p className="text-sm text-slate-500">{q.description}</p>}{q.options?.length?<ul className="mt-1 list-disc pl-5 text-sm text-slate-600">{q.options.map(a=><li key={a.id}>{a.label}</li>)}</ul>:<p className="text-sm text-slate-600">Numeric answer{q.minVal!==undefined?` · minimum ${q.minVal}`:""}</p>}</li>)}</ol></div>
      <div className="space-y-4"><h3 className="font-semibold">Possible results</h3>{sample.marketing?.kind === "scorecard" ? sample.marketing.categories.map(c=><div key={c.id}><h4 className="font-medium">{c.title}</h4><p className="text-sm text-slate-600">{c.description}</p>{c.bands?.map(b=><p key={b.id} className="mt-2 text-sm"><strong>{b.title}:</strong> {b.advice} {b.action}</p>)}</div>) : sample.marketing ? sample.marketing.outcomes.map(o=><div key={o.id}><h4 className="font-medium">{o.title}</h4><p className="text-sm text-slate-600">{o.description}</p><p className="mt-2 whitespace-pre-line text-sm">{o.advice}</p><p className="mt-1 text-sm text-red-800">{o.ctaLabel}</p></div>) : <><p className="text-sm text-slate-600">Correct-answer grading with an explanation for each question.</p>{sample.outcomeTiers.map(t=><div key={t.id}><h4 className="font-medium">{t.title}</h4><p className="text-sm">{t.message}</p></div>)}</>}
      <div className="rounded-xl bg-stone-50 p-5"><h3 className="font-semibold">Make this example yours</h3><p className="mt-2 text-sm text-slate-600">Review the results, example offers and conditions. Add your own required destination links before publishing. Questions, answers, colors, fonts and result content stay editable in the existing editor.</p><p className="mt-2 text-sm text-slate-600">This creates a separate unpublished draft. Review the possible results before editing questions.</p><button className="hq-primary mt-4" onClick={()=>onCreate(createQuizTemplate(selected!,`quiz-${nanoid(10)}`))}>Use this template</button>{error&&<p role="alert" className="mt-3 text-red-800">{error}</p>}</div></div></div>
    </section>}
    <section aria-label="Authored quiz templates" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{templates.map(t=><button key={t.id} data-template-id={t.id} aria-pressed={selected===t.id} className={`${v2?"v2-template-card":""} space-y-3 rounded-2xl border bg-white p-6 text-left hover:border-red-800 focus-visible:outline-2 focus-visible:outline-red-800`} onClick={e=>{trigger.current=e.currentTarget;setSelected(t.id);requestAnimationFrame(()=>{preview.current?.scrollIntoView({block:"start"});preview.current?.focus({preventScroll:true});});}}><p className="text-xs font-medium text-red-800">{t.featured?"Featured · ":""}{t.length === "comprehensive"?"Comprehensive":"Short"} · {t.questionCount} questions</p><h2 className="text-xl font-semibold">{t.title}</h2><p className="text-sm text-slate-600">{t.summary}</p><p className="text-xs text-slate-500">{t.audience}</p><span className="block text-sm font-semibold text-red-800">Preview template →</span></button>)}</section>
    {!templates.length&&<p>No templates match this search. Try another topic or quiz type.</p>}
  </main></>;
}
