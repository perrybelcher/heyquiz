"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { nanoid } from "nanoid";
import { UserRound, Package, Target, Route, GraduationCap, ChartNoAxesColumnIncreasing, LayoutGrid, Search, ChevronRight, ArrowLeft, SlidersHorizontal, X, CalendarDays, Compass, Users } from "lucide-react";
import { templateLibraryItems, filterTemplateLibrary } from "@/lib/template-library-catalog";
import { createQuizTemplate } from "@/lib/template-factory";
import { quizTypes, quizTypeDefinitions, type QuizType } from "@/lib/quiz-types";
import { outcomeCreationEnabled } from "@/lib/outcome-availability";
import type { FormSchemaType } from "@/lib/schema";
import WorkspaceHeader from "./WorkspaceHeader";
import "./template-library.css";

const labels:Record<QuizType,string>={personality:"Personality",product_finder:"Product match",diagnostic:"Diagnostic",qualification:"Qualification",knowledge:"Knowledge",scorecard:"Scorecard"};
const icons={personality:UserRound,product_finder:Package,diagnostic:Target,qualification:Route,knowledge:GraduationCap,scorecard:ChartNoAxesColumnIncreasing};
const subscribe=(callback:()=>void)=>{const query=window.matchMedia("(max-width: 1199px)");query.addEventListener("change",callback);return ()=>query.removeEventListener("change",callback);};
const snapshot=()=>window.matchMedia("(max-width: 1199px)").matches;
type Tab="overview"|"questions"|"results";
export default function UnifiedTemplateLibrary({initialQuizType,onCreate,error}:{initialQuizType?:QuizType;onCreate:(form:FormSchemaType)=>void;error:string}) {
 const [quizType,setQuizType]=useState<QuizType|undefined>(initialQuizType && (outcomeCreationEnabled||quizTypeDefinitions[initialQuizType].scored)?initialQuizType:undefined);
 const [query,setQuery]=useState("");const [length,setLength]=useState("");const [industry,setIndustry]=useState("");const [selected,setSelected]=useState<string>();const [open,setOpen]=useState(false);const [filtersOpen,setFiltersOpen]=useState(false);const [tab,setTab]=useState<Tab>("results");const [limit,setLimit]=useState(15);
 const compact=useSyncExternalStore(subscribe,snapshot,()=>false);
 const trigger=useRef<HTMLButtonElement|null>(null);const detail=useRef<HTMLElement>(null);
 const available=useMemo(()=>templateLibraryItems.filter(t=>outcomeCreationEnabled||quizTypeDefinitions[t.quizType].scored),[]);
 const filtered=useMemo(()=>filterTemplateLibrary(available,{quizType,query,length,industry}),[available,quizType,query,length,industry]);
 const item=filtered.find(t=>t.id===selected)??filtered[0];
 const sample=useMemo(()=>item?createQuizTemplate(item.id,"template-preview"):undefined,[item]);
 const industries=[...new Set(available.map(t=>t.industry))].sort();
 const resultCount=sample?.marketing?.kind==="scorecard"?sample.marketing.categories.length:sample?.marketing?.outcomes.length??sample?.outcomeTiers.length??0;
 const modal=compact&&open&&Boolean(sample);
 function close(){setOpen(false);requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));}
 useEffect(()=>{
  if(!modal)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";
  const isolated:Array<{element:HTMLElement;previous:boolean}>=[];
  let branch:HTMLElement|null=detail.current;
  while(branch&&branch.parentElement){for(const sibling of Array.from(branch.parentElement.children)){if(sibling!==branch&&sibling instanceof HTMLElement){isolated.push({element:sibling,previous:sibling.inert});sibling.inert=true;}}branch=branch.parentElement;if(branch===document.body)break;}
  detail.current?.focus();
  return ()=>{document.body.style.overflow=previous;for(const entry of isolated)entry.element.inert=entry.previous;};
 },[modal]);
 function reset(){setQuery("");setLength("");setIndustry("");setLimit(15);}
 function changeType(type?:QuizType){setQuizType(type);setSelected(undefined);setOpen(false);setLimit(15);}
 const navigation=<>{quizTypes.filter(type=>outcomeCreationEnabled||quizTypeDefinitions[type].scored).map(type=>{const Icon=icons[type];return <button key={type} type="button" aria-pressed={quizType===type} onClick={()=>changeType(type)}><Icon size={21}/>{labels[type]}</button>;})}<div className="tl-nav-divider"/><button type="button" aria-pressed={!quizType} onClick={()=>changeType()}><LayoutGrid size={21}/>All templates</button></>;
 return <><WorkspaceHeader active="templates"/><main className="tl-library">
  <aside className="tl-sidebar" aria-label="Quiz outcome"><p>Quiz outcome</p>{navigation}</aside>
  <div className="tl-main"><header className="tl-heading"><p className="tl-eyebrow">Template library</p><h1>Find your starting point</h1><p>Choose a template, explore the results, then make it yours.</p></header>
  <div className="tl-mobile-type"><label htmlFor="tl-outcome">Quiz outcome</label><select id="tl-outcome" value={quizType??""} onChange={e=>changeType(e.target.value?e.target.value as QuizType:undefined)}><option value="">All templates</option>{quizTypes.filter(type=>outcomeCreationEnabled||quizTypeDefinitions[type].scored).map(type=><option key={type} value={type}>{labels[type]}</option>)}</select></div>
  <div className="tl-toolbar"><label className="tl-search"><Search size={20}/><span className="tl-sr-only">Search templates</span><input type="search" placeholder="Search templates, topics or industries…" value={query} onChange={e=>{setQuery(e.target.value);setLimit(15);}}/></label><button type="button" className="tl-filter-toggle" aria-expanded={filtersOpen} aria-controls="tl-filters" onClick={()=>setFiltersOpen(v=>!v)}><SlidersHorizontal size={18}/>Filters{(length||industry)&&<span>{Number(Boolean(length))+Number(Boolean(industry))}</span>}</button><div id="tl-filters" className={`tl-filters ${filtersOpen?"is-open":""}`}><label><span className="tl-sr-only">Question count</span><select aria-label="Question count" value={length} onChange={e=>{setLength(e.target.value);setLimit(15);}}><option value="">All lengths</option><option value="short">Short · 8 questions</option><option value="comprehensive">Comprehensive · 30 questions</option><option value="standard">Other lengths</option></select></label><label><span className="tl-sr-only">Industry</span><select aria-label="Industry" value={industry} onChange={e=>{setIndustry(e.target.value);setLimit(15);}}><option value="">All industries</option>{industries.map(i=><option key={i}>{i}</option>)}</select></label></div></div>
  <div className="tl-columns"><section className="tl-list" aria-label="Quiz templates"><div className="tl-list-heading"><p role="status">{filtered.length} {quizType?labels[quizType].toLowerCase()+" ":""}templates</p>{(query||length||industry)&&<button className="tl-text-button" onClick={reset}>Clear filters</button>}</div>
   {filtered.slice(0,limit).map(t=><button type="button" key={t.id} className="tl-template" data-template-id={t.id} aria-pressed={item?.id===t.id} onClick={e=>{trigger.current=e.currentTarget;setSelected(t.id);setOpen(true);setTab("results");}}><div className="tl-thumbnail"><Image src={t.image} alt={t.imageAlt} fill sizes="(max-width: 767px) 112px, 200px" style={{objectFit:"cover",objectPosition:t.focalPoint}}/></div><div className="tl-template-copy"><h2>{t.title}</h2><p>{t.summary}</p><div className="tl-template-meta"><span className={t.length==="comprehensive"?"is-comprehensive":""}>{t.length==="comprehensive"?"Comprehensive":t.length==="short"?"Short":"Standard"}</span><span>{t.questionCount} questions</span></div></div><ChevronRight className="tl-row-arrow" size={20}/><span className="tl-sr-only">Preview template</span></button>)}
   {!filtered.length&&<div className="tl-empty"><h2>No matching templates</h2><p>Try a different topic or clear your filters.</p><button onClick={reset}>Clear filters</button></div>}
   {filtered.length>limit&&<button className="tl-more" onClick={()=>setLimit(v=>v+15)}>Show more templates ({filtered.length-limit} remaining)</button>}
   <Link className="tl-blank" href="/create/blank">Prefer a blank quiz? Start from scratch</Link>
  </section>
  {sample&&item&&<section ref={detail} className={`tl-preview ${modal?"is-open":""}`} role={modal?"dialog":"region"} aria-modal={modal||undefined} aria-label="Template details" tabIndex={-1} onKeyDown={e=>{if(e.key==="Escape"&&modal){e.preventDefault();close();}if(e.key==="Tab"&&modal){const nodes=detail.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input,select,[tabindex="0"]');if(nodes?.length){const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===detail.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}}>
   <div className="tl-mobile-detail-header"><button onClick={close}><ArrowLeft size={20}/>Back to templates</button><button aria-label="Close template preview" onClick={close}><X size={20}/></button></div>
   <div className="tl-preview-cover"><Image src={item.image} alt={item.imageAlt} fill sizes="(max-width: 767px) 100vw, 520px" priority style={{objectFit:"cover",objectPosition:item.focalPoint}}/><div className="tl-cover-copy"><span>Template preview</span><h2>{sample.title}</h2></div></div>
   <div className="tl-preview-summary">{item.summary}</div>
   <div className="tl-tabs" role="tablist" aria-label="Template preview sections" onKeyDown={e=>{const names:Tab[]=["overview","questions","results"];if(["ArrowLeft","ArrowRight","Home","End"].includes(e.key)){e.preventDefault();const next=e.key==="Home"?0:e.key==="End"?2:(names.indexOf(tab)+(e.key==="ArrowRight"?1:2))%3;setTab(names[next]);detail.current?.querySelector<HTMLButtonElement>(`#tl-tab-${names[next]}`)?.focus();}}}>{(["overview","questions","results"] as Tab[]).map(name=><button type="button" role="tab" id={`tl-tab-${name}`} aria-selected={tab===name} aria-controls="tl-tab-content" tabIndex={tab===name?0:-1} key={name} onClick={()=>setTab(name)}>{name==="overview"?"Overview":name==="questions"?`Questions (${sample.questions.length})`:`Results (${resultCount})`}</button>)}</div>
   <div className="tl-tab-content" id="tl-tab-content" role="tabpanel" aria-labelledby={`tl-tab-${tab}`}>
    {tab==="overview"&&<><h3>About this template</h3><p>{sample.description||item.summary}</p><p>Every question, answer, result and design is editable. Selecting this template creates an independent unpublished draft.</p><p>Review the example offers and conditions, then configure your own required destination links before publishing.</p></>}
    {tab==="questions"&&<ol className="tl-questions">{sample.questions.map(q=><li key={q.id}><h3>{q.title}</h3>{q.description&&<p>{q.description}</p>}{q.options?.length?<ul>{q.options.map(a=><li key={a.id}>{a.label}</li>)}</ul>:<p>{q.type==="number"||q.type==="currency"?"Numeric answer":"Written answer"}{q.minVal!==undefined?` · minimum ${q.minVal}`:""}</p>}{q.explanation&&<details><summary>Answer explanation</summary><p>{q.explanation}</p></details>}</li>)}</ol>}
    {tab==="results"&&(sample.marketing?.kind==="scorecard"?sample.marketing.categories.map((c,i)=><article className="tl-result" key={c.id}><ResultIcon index={i}/><div><h3>{c.title}</h3><p>{c.description}</p>{c.bands?.map(b=><details key={b.id}><summary>{b.title}</summary><p>{b.advice}</p><p>{b.action}</p></details>)}</div></article>):sample.marketing?sample.marketing.outcomes.map((o,i)=><article className="tl-result" key={o.id}><ResultIcon index={i}/><div><h3>{o.title}</h3><p>{o.description}</p>{o.advice&&<details><summary>Next steps</summary><p>{o.advice}</p>{o.ctaLabel&&<p>{o.ctaLabel}</p>}</details>}</div></article>):sample.outcomeTiers.map((t,i)=><article className="tl-result" key={t.id}><ResultIcon index={i}/><div><h3>{t.title}</h3><p>{t.message}</p><p>{t.minScorePercent}–{t.maxScorePercent}%</p></div></article>))}
   </div><div className="tl-preview-actions"><button type="button" className="tl-create" onClick={()=>onCreate(createQuizTemplate(item.id,`quiz-${nanoid(10)}`))}>Use this template</button><button className="tl-text-button" onClick={()=>setTab("questions")}>Explore questions</button>{error&&<p role="alert">{error}</p>}</div>
  </section>}
  </div></div>
 </main></>;
}
function ResultIcon({index}:{index:number}){const Icon=[CalendarDays,Compass,Users][index%3];return <span className={`tl-result-icon tl-result-icon-${index%3}`}><Icon size={25}/></span>;}
