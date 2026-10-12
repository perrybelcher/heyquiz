"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Upload, ArrowDown, ArrowRight, Check, GitBranch, MessageCircle, Play, Sparkles, Target, Users, X } from 'lucide-react';
import type { FormSchemaType } from '@/lib/schema';
import { formatAnswer, orderedQuestions } from '@/lib/engine';
import { inspectConversation, simulateJourneys, type JourneySimulation } from '@/lib/journey-testing';
import { applyJourneyFixtureUpgrade, expectationFor, hasExpandedJourneyChecks, prepareJourneyFixtureUpgrade, createJourneyFixture, journeyDraftFingerprint, journeyFixtureStorageKey, MAX_JOURNEY_FIXTURES, parseJourneyFixtures, runJourneyFixture, serializeJourneyFixtures, type JourneyFixture, type JourneyFixtureResult, type JourneyExpectation, type JourneyFixtureUpgrade } from '@/lib/journey-fixtures';
import { applyJourneyFixtureImport, decodeJourneyFixtureFile, exportJourneyFixtures, MAX_JOURNEY_TRANSFER_BYTES, prepareJourneyFixtureImport, type JourneyImportReview } from '@/lib/journey-fixture-transfer';
import { validateJourneyFixtureLibrary } from '@/lib/journey-fixtures';
import ManualJourneyComposer, { type ManualJourneyComposerHandle } from './ManualJourneyComposer';
export type ConversationTarget = 'promise'|'questions'|'results'|'capture'|'design'|'publish';
export type ConversationEdit = {target:ConversationTarget;questionId?:string};

function loadFixtures(quizId: string): {quizId: string; cases: JourneyFixture[]; raw: string|null; error: string} {
 let raw:string|null=null;
 try { raw=typeof window === 'undefined'?null:localStorage.getItem(journeyFixtureStorageKey(quizId));return {quizId, cases: parseJourneyFixtures(raw,quizId),raw,error:''}; }
 catch { return {quizId, cases: [],raw,error:'Saved cases could not be loaded. Browser storage may be unavailable or contain an unsupported format. The original data has not been changed.'}; }
}

function JourneyEvidence({expected,form}:{expected:JourneyExpectation;form:FormSchemaType}){
 return <div className="mt-3 space-y-4 text-sm" role="group" aria-label="Category and section checks">
  <div><h5 className="font-semibold">Category scores and coverage</h5>{expected.categories===undefined?<p className="mt-1 text-slate-600">Not checked by this saved case.</p>:expected.categories.length?<dl className="mt-2 space-y-2">{expected.categories.map(category=><div key={category.id} className="rounded-lg bg-stone-50 p-3"><dt className="break-words font-medium">{form.marketing?.categories.find(item=>item.id===category.id)?.title||category.id}<span className="ml-2 break-all text-xs font-normal text-slate-500">{category.id}</span></dt><dd className="mt-1 text-slate-700">{category.score===null?'Not enough information':`${category.score}%`} · {category.answered} of {category.applicable} applicable questions scored · {category.minAnswers} needed</dd></div>)}</dl>:<p className="mt-1 text-slate-600">No categories expected.</p>}</div>
  <div><h5 className="font-semibold">Result sections in order</h5>{expected.resultSectionIds===undefined?<p className="mt-1 text-slate-600">Not checked by this saved case.</p>:expected.resultSectionIds.length?<ol className="mt-2 list-decimal space-y-1 pl-5">{expected.resultSectionIds.map(id=><li key={id} className="break-words">{form.marketing?.resultSections?.find(section=>section.id===id)?.title||id}<span className="ml-2 break-all text-xs text-slate-500">{id}</span></li>)}</ol>:<p className="mt-1 text-slate-600">No result sections expected.</p>}</div>
 </div>;
}

function JourneyInputs({fixture}:{fixture:JourneyFixture}){
 return <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">View saved synthetic inputs</summary><p className="mt-2 text-xs text-slate-600">These exact values are stored and included in exports. They are not redacted or verified to be anonymous.</p><dl className="mt-3 space-y-3 text-sm">{Object.entries(fixture.answers).map(([id,value])=><div key={id}><dt className="break-all font-medium">{id} · finite choice</dt><dd className="mt-1 break-words whitespace-pre-wrap">{Array.isArray(value)?value.join(' · '):String(value)}</dd></div>)}{Object.entries(fixture.typedAnswers||{}).map(([id,entry])=><div key={id}><dt className="break-all font-medium">{id} · {entry.type.replaceAll('_',' ')}</dt><dd className="mt-1 break-words whitespace-pre-wrap">{entry.value}</dd></div>)}</dl></details>;
}

/** Local checks never start a respondent session. Saved regression cases stay in this browser. */
export default function ConversationMap({form,onClose,onEdit}:{form:FormSchemaType;onClose:()=>void;onEdit:(where:ConversationEdit)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLElement|null>(null);
 const [view,setView]=useState<'map'|'test'>('map');
 const [run,setRun]=useState<{fingerprint:string;data:JourneySimulation}|null>(null);
 const [running,setRunning]=useState(false);
 const [runError,setRunError]=useState('');
 const [caseId,setCaseId]=useState('');
 const [filter,setFilter]=useState('all');
 const [fixtureStore,setFixtureStore]=useState(()=>loadFixtures(form.id));
 const [fixtureName,setFixtureName]=useState('');
 const [fixtureNotice,setFixtureNotice]=useState('');
 const [upgrade,setUpgrade]=useState<JourneyFixtureUpgrade|null>(null);
 const [upgradeRaw,setUpgradeRaw]=useState<string|null>(null),[typedAcknowledgement,setTypedAcknowledgement]=useState<{raw:string|null;file:string|null}|null>(null);
 const manualComposer=useRef<ManualJourneyComposerHandle>(null);
 const [transferReview,setTransferReview]=useState<{review:JourneyImportReview;raw:string|null;libraryJSON:string}|null>(null),[transferError,setTransferError]=useState(''),[readingFile,setReadingFile]=useState(false),[storageChanged,setStorageChanged]=useState(false);
 const fileInput=useRef<HTMLInputElement>(null),importButton=useRef<HTMLButtonElement>(null),transferHeading=useRef<HTMLHeadingElement>(null),fileRead=useRef(0);

 const upgradeHeading=useRef<HTMLHeadingElement>(null),upgradeLauncher=useRef<HTMLButtonElement|null>(null),savedRunButton=useRef<HTMLButtonElement>(null);
 const [fixtureRun,setFixtureRun]=useState<{fingerprint:string;results:JourneyFixtureResult[]}|null>(null);
 const fingerprint=journeyDraftFingerprint(form);
 // A quiz switch must never display or overwrite another quiz's local regression cases.
 if(fixtureStore.quizId!==form.id){setFixtureStore(loadFixtures(form.id));setFixtureRun(null);setFixtureNotice('');setUpgrade(null);setTransferReview(null);setReadingFile(false);setStorageChanged(false);setTypedAcknowledgement(null);}
 const fixtures=fixtureStore.quizId===form.id?fixtureStore.cases:[];
 const typedAcknowledged=Boolean(typedAcknowledgement&&typedAcknowledgement.raw===fixtureStore.raw&&typedAcknowledgement.file===(transferReview?.review.fileBaseline??null));
 const transferStale=Boolean(transferReview&&(storageChanged||transferReview.review.draftFingerprint!==fingerprint||JSON.stringify(fixtures)!==transferReview.libraryJSON));
 const upgradeStale=Boolean(upgrade&&(storageChanged||upgradeRaw!==fixtureStore.raw||upgrade.draftFingerprint!==fingerprint||upgrade.baseline!==JSON.stringify(fixtures.find(fixture=>fixture.id===upgrade.fixtureId))));
 useEffect(()=>{if(upgrade)upgradeHeading.current?.focus();},[upgrade]);
 useEffect(()=>{
  if(!transferReview)return;
  const heading=transferHeading.current,container=dialog.current,header=container?.querySelector('header');
  if(!heading||!container||!header)return;
  // Native focus scrolling can leave the heading behind the sticky header in
  // Firefox. Measure its actual height so narrow layouts and zoom stay usable.
  heading.focus({preventScroll:true});
  const offset=heading.getBoundingClientRect().top-header.getBoundingClientRect().bottom-16;
  container.scrollTop=Math.max(0,Math.min(container.scrollHeight-container.clientHeight,container.scrollTop+offset));
 },[transferReview]);
 useEffect(()=>()=>{fileRead.current++;},[form.id]);
 useEffect(()=>{const changed=(event:StorageEvent)=>{if(event.key===journeyFixtureStorageKey(form.id)||event.key===null){setStorageChanged(true);setTypedAcknowledgement(null);}};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[form.id]);

 const currentFixtures=fixtureRun?.fingerprint===fingerprint?fixtureRun.results:null;
 const inspection=useMemo(()=>inspectConversation(form),[form]);
 const questions=useMemo(()=>orderedQuestions(form),[form]);
 const currentRun=run?.fingerprint===fingerprint?run.data:null;
 const cases=currentRun?.cases.filter(c=>filter==='all'||c.status===filter)||[];
 const selectedCase=cases.find(c=>c.id===caseId)||cases[0];
 const results=form.marketing?.kind==='scorecard'?form.marketing.scorecard?.bands||[]:form.marketing?.outcomes||form.outcomeTiers||[];
 useEffect(()=>{const el=dialog.current;opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;el?.showModal();return()=>el?.close();},[]);
 function closeMap(){
  fileRead.current++;
  // Close while connected: unmounting first can discard native return focus.
  dialog.current?.close();onClose();
  requestAnimationFrame(()=>{
   if(document.querySelector('dialog[open]'))return;
   const available=(element:HTMLElement|null):element is HTMLElement=>Boolean(element?.isConnected&&element.getClientRects().length&&!element.matches(':disabled')&&element!==document.body);
   if(available(opener.current)){opener.current.focus();return;}
   // The responsive toolbar can replace its opener while this dialog is open.
   const fallback=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-mobile-editor-header] button[aria-haspopup="dialog"], .studio-toolbar button, .guided-studio header button')).find(button=>available(button)&&(button.textContent?.trim()==='More'||button.textContent?.trim()==='Conversation map'));
   fallback?.focus();
  });
 }
 async function test(){setRunning(true);setRunError('');setView('test');try{
  // Yield once so the busy state paints before the bounded synchronous simulation.
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  const data=simulateJourneys(form,256);setRun({fingerprint,data});setCaseId(data.cases[0]?.id||'');setFilter('all');
  setFixtureRun({fingerprint,results:fixtures.map(fixture=>runJourneyFixture(form,fixture))});
 }catch(e){setRunError(e instanceof Error?e.message:'Could not complete this local test.');}finally{setRunning(false);}}
 function persistFixtures(next:JourneyFixture[],expectedRaw:string|null=fixtureStore.raw){
  try{
   if(fixtureStore.quizId!==form.id)throw Error('The quiz changed. Reload its saved cases before saving.');
   const key=journeyFixtureStorageKey(form.id),storageFailure='Could not save to this browser. Your existing saved cases have not been changed.';
   let raw:string|null;
   try{raw=localStorage.getItem(key);}catch{throw Error(storageFailure);}
   if(raw!==expectedRaw)throw Error('The saved library changed. Reload saved cases before saving; your existing data has not been changed.');
   validateJourneyFixtureLibrary(parseJourneyFixtures(raw,form.id));validateJourneyFixtureLibrary(next);
   const serialized=serializeJourneyFixtures(form.id,next);
   // One setItem is all-or-nothing, but this read/check/write is not cross-tab CAS.
   try{localStorage.setItem(key,serialized);}catch{throw Error(storageFailure);}
   setFixtureStore({quizId:form.id,cases:next,raw:serialized,error:''});setStorageChanged(false);setTypedAcknowledgement(null);setFixtureRun(null);return true;
  }catch(error){setFixtureNotice(error instanceof Error?error.message:'Could not save to this browser. Your existing saved cases have not been changed.');return false;}
 }
 function reloadFixtures(){setTypedAcknowledgement(null);setFixtureStore(loadFixtures(form.id));setFixtureRun(null);setStorageChanged(false);setFixtureNotice('Saved cases reloaded. Review pending changes again before saving.');}
 function removeFixture(id:string){
  try{
   const key=journeyFixtureStorageKey(form.id),raw=localStorage.getItem(key);
   if(raw!==fixtureStore.raw)throw Error('The saved library changed. Reload saved cases before removing one.');
   const current=parseJourneyFixtures(raw,form.id);
   if(current.filter(item=>item.id===id).length!==1)throw Error('This saved case no longer exists. Reload saved cases.');
   const next=current.filter(item=>item.id!==id),envelope=JSON.parse(raw!);
   // Explicit deletion is the sole legacy exception: preserve all unrelated
   // envelope/case properties, even when an append would need strict validation.
   const serialized=envelope.version===1?JSON.stringify({...envelope,cases:next}):serializeJourneyFixtures(form.id,next);
   parseJourneyFixtures(serialized,form.id);
   localStorage.setItem(key,serialized);setFixtureStore({quizId:form.id,cases:next,raw:serialized,error:''});setFixtureRun(null);setStorageChanged(false);setTypedAcknowledgement(null);setFixtureNotice('Regression case removed from this browser.');
  }catch(error){setFixtureNotice(error instanceof Error?error.message:'Could not remove this case. Existing data has not been changed.');}
 }
 function saveFixture(){
  if(!selectedCase||!currentRun)return;
  try{const fixture=createJourneyFixture(form,selectedCase,fixtureName,`case-${crypto.randomUUID()}`);if(persistFixtures([...fixtures,fixture])){setFixtureName('');setFixtureNotice('Expected result saved in this browser. Run it again after your next edit.');}}
  catch(error){setFixtureNotice(error instanceof Error?error.message:'Could not save this case.');}
 }
 async function testSaved(){
  setRunning(true);setRunError('');
  try{await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));setFixtureRun({fingerprint,results:fixtures.map(fixture=>runJourneyFixture(form,fixture))});}
  catch(error){setRunError(error instanceof Error?error.message:'Could not run saved cases.');}
  finally{setRunning(false);}
 }
 function reviewUpgrade(fixture:JourneyFixture,launcher:HTMLButtonElement){
  try{manualComposer.current?.close();upgradeLauncher.current=launcher;setUpgrade(prepareJourneyFixtureUpgrade(form,fixture));setUpgradeRaw(fixtureStore.raw);setFixtureNotice('');}
  catch(error){setFixtureNotice(error instanceof Error?error.message:'Could not review this case.');}
 }
 function cancelUpgrade(){setUpgrade(null);upgradeLauncher.current?.focus();}
 function confirmUpgrade(){
  if(!upgrade)return;
  try{if(upgradeStale)throw Error('The draft or library changed. Keep the existing expectations and review again.');const fixture=fixtures.find(item=>item.id===upgrade.fixtureId);if(!fixture)throw Error('This saved case no longer exists.');const expanded=applyJourneyFixtureUpgrade(form,fixture,upgrade),next=fixtures.map(item=>item.id===fixture.id?expanded:item);
   if(persistFixtures(next,upgradeRaw)){setUpgrade(null);setFixtureRun({fingerprint,results:next.map(item=>runJourneyFixture(form,item))});setFixtureNotice('Reviewed category and section checks added. Existing expectations were preserved.');savedRunButton.current?.focus();}
  }catch(error){setFixtureNotice(error instanceof Error?error.message:'Could not save the reviewed checks.');}
 }
 function cancelImport(){fileRead.current++;setReadingFile(false);setTransferReview(null);setTransferError('');requestAnimationFrame(()=>importButton.current?.focus());}
 async function readImport(file:File|undefined){
  if(!file)return;manualComposer.current?.close();const request=++fileRead.current;setReadingFile(true);setTransferError('');setTransferReview(null);setUpgrade(null);setTypedAcknowledgement(null);
  try{
   if(file.size>MAX_JOURNEY_TRANSFER_BYTES)throw Error('Choose a JSON file no larger than 128 KiB.');
   const text=decodeJourneyFixtureFile(new Uint8Array(await file.arrayBuffer()));
   if(request!==fileRead.current)return;
   const raw=localStorage.getItem(journeyFixtureStorageKey(form.id)),current=parseJourneyFixtures(raw,form.id),review=prepareJourneyFixtureImport(form,text,current);
   setFixtureStore({quizId:form.id,cases:current,raw,error:''});setFixtureRun(null);setStorageChanged(false);setTransferReview({review,raw,libraryJSON:JSON.stringify(current)});setFixtureNotice('');
  }catch(error){if(request===fileRead.current){setTransferError(error instanceof Error?error.message:'This file could not be read. Your saved cases are unchanged.');importButton.current?.focus();}}
  finally{if(request===fileRead.current)setReadingFile(false);if(fileInput.current)fileInput.current.value='';}
 }
 function confirmImport(){
  if(!transferReview)return;
  try{
   const raw=localStorage.getItem(journeyFixtureStorageKey(form.id));
   if(raw!==transferReview.raw)throw Error('The saved library changed during review. Cancel and review the file again.');
   if(transferReview.review.cases.some(item=>item.inputVersion===2)&&!typedAcknowledged)throw Error('Confirm these typed values are synthetic before importing.');
   const current=parseJourneyFixtures(raw,form.id),next=applyJourneyFixtureImport(form,current,transferReview.review);
   if(persistFixtures(next,transferReview.raw)){setTransferReview(null);setTransferError('');setFixtureNotice(`${transferReview.review.additions.length} reviewed cases imported. Existing expectations were preserved. Run saved cases to check this draft.`);requestAnimationFrame(()=>savedRunButton.current?.focus());}
   else setTransferError('Could not save the import. Your existing library is unchanged; the review is still here so you can retry.');
  }catch(error){setTransferError(error instanceof Error?error.message:'Could not apply this import. Your saved cases are unchanged.');}
 }
 function downloadCases(){
  try{
   const raw=localStorage.getItem(journeyFixtureStorageKey(form.id));
   if(raw!==fixtureStore.raw||storageChanged)throw Error('The saved library changed. Reload saved cases and review the export acknowledgement again.');
   const current=parseJourneyFixtures(raw,form.id),text=exportJourneyFixtures(form.id,current);
   if(!current.length)throw Error('There are no saved cases to export.');
   const typed=current.some(item=>item.inputVersion===2);if(typed&&!typedAcknowledged)throw Error('Confirm these typed values are synthetic before exporting. Reload saved cases if this library changed.');
   const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'})),anchor=document.createElement('a');anchor.href=url;anchor.download=`pippi-journey-cases-${form.id}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setTransferError('');setFixtureNotice(typed?'Saved cases exported with the synthetic numbers and text you entered. The file is not redacted.':'Saved synthetic cases exported. The file contains case names and option IDs; it does not contain respondent records.');
  }catch(error){setTransferError(error instanceof Error?error.message:'Could not export saved cases.');}
 }
 const edit=(target:ConversationTarget,questionId?:string)=>{dialog.current?.close();onEdit({target,questionId});};
 const connection=<div className="flex justify-center py-2 text-stone-300" aria-hidden="true"><ArrowDown size={22}/></div>;
 const captureCard=<button onClick={()=>edit('capture')} className="w-full rounded-2xl border border-stone-200 bg-white p-5 text-left"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-800"><Users size={16}/>The invitation</span><h2 className="mt-3 font-semibold">{form.capture?.enabled?`${form.capture.required?'Required':'Optional'} contact capture`:'No contact details requested'}</h2><p className="mt-2 text-sm text-slate-600">{form.capture?.enabled?`${form.capture.placement==='after_results'?'After':'Before'} results · Marketing opt-in ${form.capture.marketingEnabled?'enabled':'off'}`:'Visitors can complete the quiz without a contact form.'}</p><span className="mt-3 block text-xs font-semibold text-red-800">Review contact capture →</span></button>;
 return <dialog ref={dialog} aria-labelledby="conversation-map-title" onCancel={e=>{e.preventDefault();if(transferReview||readingFile)cancelImport();else if(upgrade)cancelUpgrade();else if(!manualComposer.current?.cancel())closeMap();}} className="m-auto h-[92vh] max-h-[92vh] w-[calc(100%-1rem)] max-w-6xl overflow-y-auto rounded-2xl bg-[#faf8f4] p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50">
  <header className="sticky top-0 z-10 flex items-start justify-between gap-3 sm:items-center border-b border-stone-200 bg-white px-5 py-4 sm:px-8"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-widest text-red-800">Pippi conversation studio</p><h1 id="conversation-map-title" className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight">See the conversation. Shape the next step.</h1></div><button aria-label="Close conversation map" onClick={closeMap} className="shrink-0 rounded-lg border border-stone-200 p-2"><X size={20}/></button></header>
  <div className="p-5 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex flex-wrap gap-2" role="group" aria-label="Conversation views"><button aria-pressed={view==='map'} onClick={()=>setView('map')} className={view==='map'?'hq-primary':'hq-secondary'}><GitBranch size={16}/>Conversation map</button><button aria-pressed={view==='test'} onClick={()=>setView('test')} className={view==='test'?'hq-primary':'hq-secondary'}><Play size={16}/>Journey testing</button></div><p className="text-xs text-slate-500">Current draft · No responses or emails created</p></div>
  {view==='map'?<div className="mt-7 grid items-start gap-7 lg:grid-cols-[1.4fr_1fr]">
   <section aria-label="Conversation flow" className="min-w-0"><p className="mb-5 text-sm text-slate-600">Follow the experience from first impression to a useful result. Select any card to edit that part.</p>
    <button onClick={()=>edit('promise')} className="w-full rounded-2xl border border-stone-200 bg-white p-5 text-left"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-800"><Sparkles size={16}/>The promise</span><h2 className="mt-3 text-xl font-semibold">{form.coverPage?.enabled?form.coverPage.title||form.title:form.title||'What will people discover?'}</h2><p className="mt-2 text-sm text-slate-600">{form.coverPage?.enabled?form.coverPage.subtitle:form.description}</p><span className="mt-4 block text-xs font-semibold text-red-800">Edit the introduction →</span></button>
    {connection}
    <div className="space-y-3">{questions.map((q,index)=>{const rules=form.marketing?.rules.filter(r=>r.questionId===q.id)||[];const branches=form.logicRules?.filter(r=>r.sourceQuestionId===q.id)||[];return <div key={q.id} className="rounded-2xl border border-stone-200 bg-white"><button onClick={()=>edit('questions',q.id)} className="w-full p-5 text-left"><span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{q.type==='hidden'?'Hidden input':`Question ${index+1}`} · {q.type.replaceAll('_',' ')}</span><h3 className="mt-2 font-semibold">{q.title||'Untitled question'}</h3><p className="mt-2 text-xs text-slate-500">{q.options?.length?`${q.options.length} answers · `:''}{rules.length?`${rules.length} result rules`:'No marketing score rules'}{branches.length?` · ${branches.length} branching rules`:''}</p><span className="mt-3 block text-xs font-semibold text-red-800">Edit this question →</span></button>{branches.length>0&&<ul className="space-y-2 border-t border-stone-100 px-5 py-3 text-xs text-slate-600">{branches.map(r=><li key={r.id} className="flex gap-2"><GitBranch size={14} className="shrink-0"/><span>{r.operator.replaceAll('_',' ')} {q.options?.find(o=>o.id===r.value)?.label||r.value||''} → {r.action.replaceAll('_',' ')}{r.targetQuestionId?`: ${form.questions.find(t=>t.id===r.targetQuestionId)?.title||'Missing question'}`:r.targetOutcomeTierId?`: ${form.outcomeTiers?.find(t=>t.id===r.targetOutcomeTierId)?.title||'Ending'}`:''}</span></li>)}</ul>}</div>})}{!questions.length&&<button onClick={()=>edit('questions')} className="w-full rounded-2xl border border-dashed border-stone-300 p-6 text-left text-sm">Add the first question to your conversation →</button>}</div>
    {connection}
    {form.capture?.placement !== 'after_results' && <>{captureCard}{connection}</>}
    <button onClick={()=>edit('results')} className="w-full rounded-2xl border border-stone-200 bg-white p-5 text-left"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-800"><Target size={16}/>The useful next step</span><h2 className="mt-3 text-xl font-semibold">{form.marketing?.kind==='scorecard'?'Personalized scorecard':results.length?`${results.length} possible results`:'Your ending page'}</h2><ul className="mt-3 space-y-2 text-sm text-slate-600">{results.map(r=><li key={r.id}>{r.title}</li>)}</ul>{form.marketing&&<p className="mt-3 text-xs text-slate-500">Fallback: {form.marketing.fallbackTitle}</p>}<span className="mt-4 block text-xs font-semibold text-red-800">Edit results and next steps →</span></button>
    {form.capture?.placement === 'after_results' && <>{connection}{captureCard}</>}
   </section>
   <aside className="space-y-4 lg:sticky lg:top-28"><section aria-label="Suggested next action" className="rounded-2xl bg-[#26382f] p-6 text-white"><MessageCircle size={24}/><h2 className="mt-4 text-xl font-semibold">Make the next edit count.</h2>{inspection.issues.length?<><p className="mt-3 text-sm leading-relaxed text-white/80">{inspection.issues[0].message}</p><button className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#26382f]" onClick={()=>edit(inspection.issues[0].target,inspection.issues[0].questionId)}>Review this<ArrowRight size={16}/></button></>:<p className="mt-3 text-sm leading-relaxed text-white/80">No structural issues found by these checks. Test the answer paths, then read the experience as a visitor.</p>}</section>
   <section className="rounded-2xl border border-stone-200 bg-white p-5"><h2 className="font-semibold">Draft observations</h2><p className="mt-2 text-xs text-slate-500">Practical checks, not a conversion score.</p>{inspection.issues.length?<ul className="mt-4 space-y-3">{inspection.issues.map(issue=><li key={issue.id}><button onClick={()=>edit(issue.target,issue.questionId)} className="w-full rounded-lg bg-stone-50 p-3 text-left text-sm leading-relaxed"><span className={`mb-1 block text-[10px] font-semibold uppercase tracking-widest ${issue.severity==='error'?'text-red-800':'text-slate-500'}`}>{issue.severity==='error'?'Needs attention':issue.severity==='warning'?'Review':'Consider'}</span>{issue.message}<span className="ml-1 text-red-800">→</span></button></li>)}</ul>:<p className="mt-4 flex items-center gap-2 text-sm text-green-800"><Check size={16}/>Basic structure looks complete</p>}</section>
   <button onClick={test} disabled={running} className="hq-primary w-full"><Play size={16}/>{running?'Checking journeys…':'Run journey checks'}</button><button onClick={()=>edit('design')} className="hq-secondary w-full">Adjust the visual design</button>
   </aside>
  </div>:<section className="mt-7" aria-label="Journey test results"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold">Follow the answers all the way through.</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">Check representative low, high, zero, unmapped, and mixed answers first, then enumerate up to 256 distinct paths using this draft’s routing and scoring. Numbers and short answers can be tested with a manual synthetic case below. Uploads and other unsupported inputs need Preview. These checks do not test email delivery, integrations, or conversion performance.</p></div><button onClick={test} disabled={running} className="hq-primary">{running?'Checking journeys…':currentRun?'Run again':'Run journey checks'}</button></div>
   <ManualJourneyComposer key={form.id} ref={manualComposer} form={form} count={fixtures.length} libraryRaw={fixtureStore.raw} libraryUnavailable={Boolean(fixtureStore.error)||storageChanged} onOpen={()=>{fileRead.current++;setReadingFile(false);setTransferReview(null);setTransferError('');setUpgrade(null);}} onPersist={(next,raw)=>{const saved=persistFixtures(next,raw);if(saved)setFixtureNotice('Reviewed manual expected result saved in this browser. Run it after an edit to check the same behavior.');return saved;}} renderEvidence={expected=><JourneyEvidence expected={expected} form={form}/>}/>
   {runError&&<p role="alert" className="mt-4 text-red-800">{runError}</p>}
   {!currentRun&&!running&&<div className="mt-6 rounded-xl border border-dashed border-stone-300 p-8 text-sm text-slate-600">{run?'The draft changed. Run the checks again to see current results.':'Ready when you are. The simulation uses your current draft, including unsaved edits.'}</div>}
   {currentRun&&<><div role="status" className="mt-6 rounded-xl border border-stone-200 bg-white p-5"><p className="font-semibold">{currentRun.cases.length} distinct paths checked · {currentRun.exhaustive?'Complete finite-path coverage':'Partial coverage'}</p><p className="mt-2 text-xs text-slate-500">{currentRun.targetedCases} representative paths · {currentRun.enumeratedCases} paths visited during enumeration (some overlap)</p><ul className="mt-3 space-y-2 text-sm text-slate-600">{currentRun.notes.map((note,i)=><li key={i}>{note}</li>)}</ul>{currentRun.unsupportedQuestionIds.length>0&&<p className="mt-3 text-sm text-amber-900">Manual testing needed: {currentRun.unsupportedQuestionIds.map(id=>form.questions.find(q=>q.id===id)?.title||id).join(' · ')}</p>}</div>
   <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-white p-5 border border-stone-200"><h3 className="font-semibold">Results observed</h3><p className="mt-2 text-sm text-slate-600">{currentRun.reachedResultIds.map(id=>results.find(r=>r.id===id)?.title||id).join(' · ')||'No named result observed'}</p></div><div className="rounded-xl bg-white p-5 border border-stone-200"><h3 className="font-semibold">Results not observed</h3><p className="mt-2 text-sm text-slate-600">{currentRun.unreachedResultIds.map(id=>results.find(r=>r.id===id)?.title||id).join(' · ')||'None'}</p>{!currentRun.exhaustive&&<p className="mt-2 text-xs text-slate-500">A result missing from this sample may still be reachable.</p>}</div></div>
   <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.5fr]"><div className="min-w-0 rounded-xl border border-stone-200 bg-white p-5"><label className="block text-sm font-medium">Filter paths<select className="hq-input mt-2 w-full" value={filter} onChange={e=>{setFilter(e.target.value);setCaseId('');}}><option value="all">All checked paths</option>{['matched','scored','no_match','completed','invalid'].map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></label><label className="mt-5 block text-sm font-medium">Inspect a path<select className="hq-input mt-2 w-full" value={selectedCase?.id||''} onChange={e=>setCaseId(e.target.value)}>{cases.map((c,i)=><option key={c.id} value={c.id}>{i+1}. {c.targetedChecks?.[0]||'Enumerated path'} — {c.resultTitle} — {c.status.replaceAll('_',' ')}</option>)}</select></label>{!cases.length&&<p className="mt-3 text-sm text-slate-500">No checked paths match this filter.</p>}</div>{selectedCase&&<article className="min-w-0 rounded-xl border border-stone-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-red-800">{selectedCase.status.replaceAll('_',' ')}</p><h3 className="mt-2 text-xl font-semibold">{selectedCase.resultTitle}</h3>{selectedCase.targetedChecks?.length&&<p className="mt-2 text-xs leading-relaxed text-slate-500">Representative checks: {selectedCase.targetedChecks.join(" · ")}</p>}{typeof selectedCase.score === "number" && <p className="mt-2 text-sm font-semibold text-slate-600">Score: {selectedCase.score}%</p>}{selectedCase.error&&<p className="mt-3 text-sm text-red-800">{selectedCase.error}</p>}<ol className="mt-5 space-y-4">{selectedCase.questionIds.map(id=>{const q=form.questions.find(q=>q.id===id);return q?<li key={id}><button className="text-left text-sm font-semibold underline" onClick={()=>edit('questions',id)}>{q.title||'Untitled question'}</button><p className="mt-1 break-words text-sm text-slate-600">{formatAnswer(q,selectedCase.answers[id])||'No answer / display step'}</p></li>:null;})}</ol>{selectedCase.status!=='invalid'&&<JourneyEvidence expected={expectationFor(selectedCase)} form={form}/>}{selectedCase.status!=='invalid'&&<div className="mt-6 border-t border-stone-200 pt-5"><h4 className="font-semibold">Keep this as an expected result</h4><p className="mt-2 text-xs leading-relaxed text-slate-600">Review the result, score, categories, coverage, result-section order, and visible questions. Saving them creates a regression baseline; it does not prove the original answer is correct. Wording and visual design are not asserted.</p><label className="mt-3 block text-sm font-medium">Case name<input className="hq-input mt-2 w-full" maxLength={100} value={fixtureName} onChange={e=>setFixtureName(e.target.value)} placeholder="e.g. New visitor with no scored answers"/></label><button onClick={saveFixture} disabled={!fixtureName.trim()||fixtures.length>=MAX_JOURNEY_FIXTURES||Boolean(fixtureStore.error)} className="hq-secondary mt-3">Save expected result</button><p className="mt-2 text-xs text-slate-500">Stored only in this browser · {fixtures.length}/{MAX_JOURNEY_FIXTURES} cases</p></div>}</article>}</div>
   </>}
   <section className="mt-7 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6" aria-label="Saved regression cases"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">Your regression cases</h3><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Keep important answer paths and rerun their expected result, scores, coverage, result-section order, and visible questions after an edit. Wording and styling changes are not behavioral failures. Cases belong to this quiz in this browser; they are not synced to your account or included when you publish.</p></div><button ref={savedRunButton} className="hq-secondary" onClick={testSaved} disabled={!fixtures.length||running}>{running?'Checking…':'Run saved cases'}</button></div>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={downloadCases} disabled={!fixtures.length||Boolean(fixtureStore.error)} className="hq-secondary"><Download size={16} aria-hidden="true"/>Export cases</button><button type="button" ref={importButton} onClick={()=>fileInput.current?.click()} disabled={readingFile} className="hq-secondary"><Upload size={16} aria-hidden="true"/>{readingFile?'Reading file…':'Import cases'}</button><input ref={fileInput} type="file" accept=".json,application/json" aria-label="Choose journey case file" tabIndex={-1} className="sr-only" onChange={event=>void readImport(event.target.files?.[0])}/></div>
    <p className="mt-2 text-xs text-slate-600">JSON files up to 128 KiB · Same quiz only · Review before adding · {fixtures.length}/{MAX_JOURNEY_FIXTURES} saved cases. Use synthetic test values, never respondent data. Mixed files include the numbers and text you entered.</p>
    <p className="mt-2 text-xs leading-relaxed text-slate-600">Close or refresh older editor tabs before using manual cases. Storage changes are checked before saving, but simultaneous writes are not a transaction and older tabs can overwrite this library.</p>
    {(fixtures.some(item=>item.inputVersion===2)||transferReview?.review.cases.some(item=>item.inputVersion===2))&&<label className="mt-3 flex items-start gap-2 text-sm leading-relaxed"><input type="checkbox" className="mt-1 shrink-0" checked={typedAcknowledged} onChange={event=>setTypedAcknowledgement(event.target.checked?{raw:fixtureStore.raw,file:transferReview?.review.fileBaseline??null}:null)}/>I confirm these typed case values are synthetic, and understand exported files contain the numbers and text without redaction.</label>}
    {(storageChanged||fixtureStore.error)&&<p role="alert" className="mt-3 text-sm text-red-800">The saved library may have changed or could not be loaded. Reload it before saving a change. Current manual inputs are kept.</p>}
    <button type="button" className="mt-3 text-sm font-medium text-red-800 underline" onClick={reloadFixtures}>Reload saved cases</button>
    {transferError&&<p role="alert" className="mt-4 break-words text-sm text-red-800">{transferError}</p>}
    {transferReview&&<section aria-label="Review imported journey cases" className="mt-4 min-w-0 rounded-xl border border-amber-300 bg-amber-50 p-4"><h4 ref={transferHeading} tabIndex={-1} className="font-semibold outline-none">Review before importing cases</h4><p className="mt-2 text-sm text-slate-700">{transferReview.review.additions.length} cases to add · {transferReview.review.duplicates.length} identical cases skipped. Nothing has been saved. These are the file’s original expectations; importing does not score or approve them.</p><ul className="mt-4 space-y-3">{transferReview.review.cases.map(item=><li key={item.id} className="min-w-0 rounded-lg border border-amber-200 bg-white p-3"><p className="break-words font-semibold">{item.name}</p><p className="mt-1 text-xs text-slate-700">{transferReview.review.duplicates.includes(item.id)?'Already saved — unchanged':'Will be added'} · {hasExpandedJourneyChecks(item.expected)?'Expanded category and section checks':'Legacy or partial checks — missing checks remain absent'}</p><p className="mt-2 break-words text-sm text-slate-700">Expected {item.expected.status.replaceAll('_',' ')} · {item.expected.resultId||'No named result'} · {item.expected.score===null?'No score':`${item.expected.score}%`} · {item.expected.questionIds.length} visible steps</p><p className="mt-2 text-xs text-slate-600">{item.draftFingerprint===fingerprint?'Saved against this draft.':'Draft differs from this file’s baseline. Run saved cases after import to inspect behavior.'}</p><details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">View imported checks</summary><JourneyEvidence expected={item.expected} form={form}/></details>{item.inputVersion===2&&<JourneyInputs fixture={item}/>}</li>)}</ul>{!transferReview.review.cases.length&&<p className="mt-3 text-sm">This file has no saved cases to add.</p>}{transferStale&&<p role="alert" className="mt-3 text-sm text-red-800">The draft or saved library changed. Cancel and review the file again.</p>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" className="hq-secondary" onClick={cancelImport}>Cancel import</button><button type="button" className="hq-primary" disabled={transferStale||!transferReview.review.additions.length} onClick={confirmImport}>Import reviewed cases</button></div></section>}
    {fixtureNotice&&<p role="status" className="mt-4 text-sm text-slate-700">{fixtureNotice}</p>}
    {fixtureStore.error&&<p role="alert" className="mt-4 text-sm text-red-800">{fixtureStore.error}</p>}
    {!fixtures.length&&<p className="mt-5 rounded-lg bg-stone-50 p-4 text-sm text-slate-500">Run journey checks, inspect a path, and save an expected result to start your regression list.</p>}
    {fixtureRun&&!currentFixtures&&<p className="mt-4 text-sm text-amber-900">The draft changed. Run saved cases again to check the current draft.</p>}
    <ul className="mt-5 space-y-3">{fixtures.map(fixture=>{const check=currentFixtures?.find(r=>r.fixtureId===fixture.id);return <li key={fixture.id} className="rounded-xl border border-stone-200 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-words font-semibold">{fixture.name}</h4><p className="mt-1 text-xs text-slate-500">Expected: {fixture.expected.resultId?results.find(r=>r.id===fixture.expected.resultId)?.title||fixture.expected.resultId:fixture.expected.status.replaceAll('_',' ')}{fixture.expected.score!==null?` · ${fixture.expected.score}%`:''} · {fixture.expected.questionIds.length} visible steps</p></div><button className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-600 underline" aria-label={`Remove regression case ${fixture.name}`} onClick={()=>removeFixture(fixture.id)}>Remove</button></div><p className={`mt-3 text-sm font-semibold ${check?check.passed?'text-green-800':'text-red-800':'text-slate-500'}`}>{check?check.passed?'Passed on current draft':'Expected behavior changed':'Not checked on this draft'}</p>{fixture.draftFingerprint!==fingerprint&&<p className="mt-1 text-xs text-slate-500">Draft differs from the saved baseline{fixture.revision!==null?` (revision ${fixture.revision})`:''}.</p>}{check?.passed&&check.draftChanged&&<p className="mt-2 text-xs text-slate-600">Saved behavior still matches. Wording, styling, or settings outside these assertions may have changed.</p>}
      <p className="mt-3 text-xs font-medium text-slate-600">{hasExpandedJourneyChecks(fixture.expected)?'Expanded checks: category scores, coverage, and result-section order.':`Limited coverage: ${fixture.expected.categories===undefined?'category scores and coverage are not checked. ':''}${fixture.expected.resultSectionIds===undefined?'Result-section order is not checked.':''}`}</p>
      <details className="mt-2"><summary className="cursor-pointer text-sm font-medium text-slate-700">View saved checks</summary><JourneyEvidence expected={fixture.expected} form={form}/></details>
      {fixture.inputVersion===2&&<JourneyInputs fixture={fixture}/>}
      {!hasExpandedJourneyChecks(fixture.expected)&&upgrade?.fixtureId!==fixture.id&&<button className="hq-secondary mt-3" disabled={Boolean(fixtureStore.error)} onClick={event=>reviewUpgrade(fixture,event.currentTarget)}>Review additional checks</button>}
      {upgrade?.fixtureId===fixture.id&&<section aria-label="Review expanded expectations" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4"><h5 ref={upgradeHeading} tabIndex={-1} className="font-semibold outline-none">Review before adding checks</h5><p className="mt-2 text-sm text-slate-700">Existing assertions have passed and will be preserved. Review the newly observed category scores, coverage, and result sections below before adding them to this case. This does not verify result wording or design.</p><JourneyEvidence expected={upgrade.expected} form={form}/>{upgradeStale&&<p role="alert" className="mt-3 text-sm text-red-800">The draft or case changed. Keep the existing expectations, then open a new review.</p>}<div className="mt-4 flex flex-wrap gap-2"><button className="hq-secondary" onClick={cancelUpgrade}>Keep existing expectations</button><button className="hq-primary" disabled={upgradeStale} onClick={confirmUpgrade}>Add reviewed checks</button></div></section>}
      {check?.differences.length?<ul className="mt-2 list-disc space-y-1 break-words pl-4 text-sm text-red-800">{check.differences.map((difference,i)=><li key={i}>{difference}</li>)}</ul>:null}</li>;})}</ul>
   </section>
  </section>}
  </div>
 </dialog>;
}
