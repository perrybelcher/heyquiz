"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode, type MouseEvent } from "react";
import type { FormSchemaType } from "@/lib/schema";
import { defaultCapture } from "@/lib/contacts";
import { orderedQuestions, singleTypes } from "@/lib/engine";
import { addGuidedAnswer, addGuidedQuestion, guidedChoiceTypes, moveGuidedAnswer, moveGuidedQuestion, removeGuidedAnswer, removeGuidedQuestion, renameGuidedAnswer, reviewGuidedRemoval } from "@/lib/guided-editing";
import AnswerScoring, { ScoringMode } from "./AnswerScoring";
import { ArrowDown, ArrowUp, Plus, Trash2, Pause } from "lucide-react";
import type { ConversationEdit } from "./ConversationMap";
import ScorecardResultsEditor from "./ScorecardResultsEditor";
import LandingPageEditor from "./LandingPageEditor";
import ResultLayoutEditor from "./ResultLayoutEditor";
import EditorMobileHeader from "./EditorMobileHeader";
import { buildGuidedChecklist, guidedTargetKey, resolveGuidedChecklistTarget, type GuidedChecklistTarget, type GuidedReviewSection } from "@/lib/guided-checklist";

const steps = ["Your quiz", "Questions", "Results", "Design", "Publish"];
export default function GuidedQuizEditor({ reportDesignEditor, resultEmailEditor, form, onChange, onAdvanced, onTheme, onPublish, onPreview, onSave, status, published, publicationLabel, publicationUncertain, hasUnpublishedChanges, onShare, onPause, publicationBusy, onConversationMap, navigationRequest, onHistory, previewing, saveFailed, mobileStatus }: {
  reportDesignEditor?: ReactNode;
  resultEmailEditor?: ReactNode;
  onHistory: () => void; previewing: boolean; saveFailed: boolean; mobileStatus: string;
  form: FormSchemaType; onChange: (form: FormSchemaType) => void;
  onAdvanced: () => void; onTheme: () => void; onPublish: (event?: MouseEvent<HTMLButtonElement>) => void; onPreview: () => void; onSave: () => void;
  status: string; published: boolean; publicationLabel: string; publicationUncertain: boolean; hasUnpublishedChanges: boolean; onShare: () => void; onPause: () => void; publicationBusy: boolean; onConversationMap: () => void; navigationRequest?: ConversationEdit & {requestId:number; focus?:boolean};
}) {
  const [step, setStep] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [newQuestionType, setNewQuestionType] = useState<"multiple_choice" | "multiselect">("multiple_choice");
  const [editingError, setEditingError] = useState("");
  const questions = orderedQuestions(form);
  const checklist = useMemo(() => buildGuidedChecklist(form), [form]);
  const requiredCount = checklist.filter(item => item.level === "blocker").length;
  const nextItem = checklist.find(item => item.level === "blocker") || checklist[0];
  const [checklistNotice, setChecklistNotice] = useState("");
  const [pendingTarget, setPendingTarget] = useState<{ requestId: number; quizId: string; target?: GuidedChecklistTarget; reviewSection?: GuidedReviewSection } | null>(null);
  const [pendingNavigationFocus, setPendingNavigationFocus] = useState<{ requestId: number; quizId: string; step: number; origin: Element | null } | null>(null);
  const requestId = useRef(0);
  const focusOrigin = useRef<Element | null>(null);
  const fieldRefs = useRef(new Map<string, HTMLInputElement | HTMLTextAreaElement>());
  const resultRefs = useRef(new Map<string, HTMLDetailsElement>());
  const sheetRef = useRef<HTMLElement>(null), landingRef = useRef<HTMLDetailsElement>(null);
  function cancelChecklist() { requestId.current++; setPendingTarget(null); setPendingNavigationFocus(null); }
  function goToStep(value: number) { cancelChecklist(); setChecklistNotice(""); setStep(value); }
  function leave(action: () => void) { cancelChecklist(); action(); }
  function publish(event?: MouseEvent<HTMLButtonElement>) { cancelChecklist(); onPublish(event); }
  function navigateChecklist(target?: GuidedChecklistTarget, reviewSection?: GuidedReviewSection) {
    cancelChecklist(); setChecklistNotice(""); focusOrigin.current = document.activeElement;
    const resolved = target ? resolveGuidedChecklistTarget(form, target) : null;
    if (target && !resolved) { setChecklistNotice("This checklist item changed. Review the current draft and choose an item again."); return; }
    setStep(resolved?.step ?? ({ promise: 0, questions: 1, results: 2, capture: 4 }[reviewSection || "questions"]));
    if (target && "questionId" in target) setQuestionIndex(orderedQuestions(form).findIndex(question => question.id === target.questionId));
    setPendingTarget({ requestId: ++requestId.current, quizId: form.id, target, reviewSection });
  }

  useEffect(() => {
    if (!navigationRequest) return;
    const navigationId = ++requestId.current, origin = document.activeElement;
    const stepsByTarget = { promise:0, questions:1, results:2, design:3, capture:4, publish:4 };
    // An explicit request from the conversation map is an external navigation event.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(stepsByTarget[navigationRequest.target]);
    setPendingTarget(null);
    if (navigationRequest.questionId) {
      const index = orderedQuestions(form).findIndex(q => q.id === navigationRequest.questionId);
      if (index >= 0) setQuestionIndex(index);
    }
    setPendingNavigationFocus(navigationRequest.focus ? { requestId: navigationId, quizId: form.id, step: stepsByTarget[navigationRequest.target], origin } : null);
  // Only explicit navigation requests move the author away from their current edit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationRequest]);
  useEffect(() => {
    // A newly mounted guided editor starts at step zero. Wait for the requested
    // step to commit before scheduling its focus, rather than racing setStep.
    if (!pendingNavigationFocus || step !== pendingNavigationFocus.step) return;
    const frame = requestAnimationFrame(() => {
      if (requestId.current !== pendingNavigationFocus.requestId) return;
      const active = document.activeElement, sheet = sheetRef.current;
      if (form.id !== pendingNavigationFocus.quizId || document.querySelector("dialog[open]") || (active?.isConnected && active !== pendingNavigationFocus.origin && active !== document.body && active !== document.documentElement) || sheet?.getAttribute("aria-label") !== steps[pendingNavigationFocus.step]) { setPendingNavigationFocus(null); return; }
      const heading = sheet.querySelector("h1");
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: "start", behavior: "instant" }); }
      setPendingNavigationFocus(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingNavigationFocus, step, form.id]);
  const q = questions[Math.min(questionIndex, questions.length - 1)];
  useEffect(() => {
    if (!pendingTarget) return;
    const frame = requestAnimationFrame(() => {
      if (requestId.current !== pendingTarget.requestId) return;
      const active = document.activeElement;
      // The mobile header is a sibling of the editing canvas. Opening More or
      // focusing its title must win over a previously queued checklist action.
      if (document.querySelector("dialog[open]") || (active?.isConnected && active !== focusOrigin.current && active !== document.body && active !== document.documentElement)) {
        setPendingTarget(null); return;
      }
      const resolved = pendingTarget.target ? resolveGuidedChecklistTarget(form, pendingTarget.target) : null;
      if (pendingTarget.quizId !== form.id || (pendingTarget.target && !resolved)) {
        setChecklistNotice("This checklist item changed. Review the current draft and choose an item again."); setPendingTarget(null); return;
      }
      if (resolved && step !== resolved.step) { setPendingTarget(null); return; }
      if (resolved && "questionId" in resolved.target && q?.id !== resolved.target.questionId) {
        setQuestionIndex(orderedQuestions(form).findIndex(question => question.id === (resolved.target as { questionId: string }).questionId)); return;
      }
      let control: HTMLElement | null | undefined;
      if (resolved) {
        if (resolved.target.kind === "outcome-cta") {
          const details = resultRefs.current.get(resolved.target.outcomeId);
          if (details) details.open = true;
        }
        control = fieldRefs.current.get(guidedTargetKey(resolved.target));
      } else if (pendingTarget.reviewSection === "promise" && landingRef.current) {
        landingRef.current.open = true; control = landingRef.current.querySelector("summary");
      } else control = sheetRef.current;
      if (control?.isConnected) {
        control.focus({ preventScroll: true });
        (control.closest("label") || control).scrollIntoView({ block: "center", behavior: "instant" });
      } else setChecklistNotice("This field is no longer available here. Review the current draft or use advanced tools.");
      setPendingTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingTarget, form, step, q?.id]);

  function edit(operation: () => FormSchemaType, selectedId = q?.id) {
    cancelChecklist();
    setEditingError("");
    try {
      const updated = operation();
      onChange(updated);
      const index = orderedQuestions(updated).findIndex(question => question.id === selectedId);
      setQuestionIndex(index >= 0 ? index : Math.max(0, Math.min(questionIndex, updated.questions.length - 1)));
    } catch (error) { setEditingError(error instanceof Error ? error.message : "Could not update this question."); }
  }
  function remove(answerId?: string) {
    if (!q) return;
    setEditingError("");
    const review = reviewGuidedRemoval(form, q.id, answerId);
    if (review.blockers.length) { setEditingError(review.blockers.join(" ")); return; }
    const label = answerId ? q.options?.find(option => option.id === answerId)?.label || "Untitled answer" : q.title || "Untitled question";
    const message = [`Remove “${label}” from this draft?`, ...review.changes, "The published quiz stays unchanged until you publish again."].join("\n\n");
    if (!window.confirm(message)) return;
    edit(() => answerId ? removeGuidedAnswer(form, q.id, answerId) : removeGuidedQuestion(form, q.id));
  }
  function addQuestion() {
    setEditingError("");
    try {
      const added = addGuidedQuestion(form, newQuestionType, q?.id);
      edit(() => added.form, added.questionId);
    } catch (error) { setEditingError(error instanceof Error ? error.message : "Could not add a question."); }
  }
  const m = form.marketing;
  const capture = form.capture || { ...defaultCapture, marketingEnabled: false };
  // Answer IDs and rule targets stay stable; changed labels clear stale result explanations.
  function question(patch: Partial<typeof q>) { onChange({ ...form, questions: form.questions.map(x => x.id === q.id ? { ...x, ...patch } : x) }); }
  const field = (label: string, value: string, change: (value: string) => void, multiline = false, target?: GuidedChecklistTarget) => {
    const ref = target ? (element: HTMLInputElement | HTMLTextAreaElement | null) => { const key = guidedTargetKey(target); if (element) fieldRefs.current.set(key, element); else fieldRefs.current.delete(key); } : undefined;
    return <label className="block text-sm font-medium">{label}{multiline ? <textarea ref={ref} className="hq-input mt-2 w-full min-h-24" value={value} onChange={e => change(e.target.value)} /> : <input ref={ref} className="hq-input mt-2 w-full" value={value} onChange={e => change(e.target.value)} />}</label>;
  };
  return <><EditorMobileHeader title={form.title} onTitleChange={title => { cancelChecklist(); onChange({ ...form, title, coverPage: form.coverPage ? { ...form.coverPage, title } : undefined }); }}
    status={mobileStatus} onSave={() => leave(onSave)} saveFailed={saveFailed} published={published} publicationLabel={publicationLabel}
    onTheme={() => leave(onTheme)} onPreview={() => leave(onPreview)} previewing={previewing} onPublish={publish} onPause={() => leave(onPause)} publicationBusy={publicationBusy}
    actions={[{ label: "Conversation map", onClick: () => leave(onConversationMap) }, { label: "Full editor & advanced tools", onClick: () => leave(onAdvanced) }, { label: "Draft history", onClick: () => leave(onHistory) }, { label: "Save draft", onClick: () => leave(onSave) }]}
    sections={steps.map((label, i) => ({ id: String(i), label: `${i + 1}. ${label}`, onClick: () => goToStep(i) }))} activeSection={String(step)} steps
  /><main onPointerDownCapture={event => { if ((pendingTarget || pendingNavigationFocus) && !(event.target as Element).closest("[data-checklist-action]")) cancelChecklist(); }} onKeyDownCapture={event => { if ((pendingTarget || pendingNavigationFocus) && event.key === "Tab") cancelChecklist(); }} onInputCapture={() => { if (pendingTarget || pendingNavigationFocus) cancelChecklist(); }} className="guided-studio flex-1 overflow-y-auto bg-[#faf8f4] px-4 py-6 sm:px-8"><div className="mx-auto max-w-3xl">
    <header className="hidden lg:flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-red-800">Guided builder</p><p role="status" className="mt-1 text-xs text-slate-600">{status} · {publicationLabel}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => leave(onConversationMap)} className="hq-secondary">Conversation map</button><button onClick={() => leave(onAdvanced)} className="hq-secondary">Full editor & advanced tools</button></div></header>
    <nav aria-label="Quiz setup steps" className="guided-steps my-7 !hidden lg:!flex flex-wrap gap-2">{steps.map((label, i) => <button key={label} aria-current={step === i ? "step" : undefined} onClick={() => goToStep(i)} className={`rounded-full px-4 py-2 text-sm ${step === i ? "bg-red-800 text-white" : "border bg-white text-slate-600"}`}>{i + 1}. {label}</button>)}</nav>
    <section aria-label="Your next step" className="my-4 rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Your next step</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-800">{nextItem ? nextItem.message : "Your setup checks are clear. Try the quiz as a visitor and check the result before publishing."}</p>
      {nextItem ? <><p className="mt-1 text-xs text-slate-600">{nextItem.level === "blocker" ? "Required before saving or publishing" : "Recommended review · this does not block publishing"}</p><button type="button" data-checklist-action data-clarity-event="setup_next" className="hq-secondary mt-3" onClick={() => nextItem.target || nextItem.reviewSection ? navigateChecklist(nextItem.target, nextItem.reviewSection) : leave(onAdvanced)}>Review next item</button></> : <button type="button" disabled={previewing} className="hq-secondary mt-3 disabled:opacity-50" onClick={() => leave(onPreview)}>Try my quiz</button>}
      <p className="mt-3 text-xs leading-relaxed text-slate-600">Save keeps your draft. Preview lets you test it. Publish updates the version visitors see.</p>
    </section>
    <details className="mb-4 rounded-xl border border-stone-200 bg-white p-4" aria-label="Setup checklist">
      <summary className="cursor-pointer rounded text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-800"><span>Setup checklist</span><span className="ml-2 text-xs font-normal text-slate-600">{requiredCount} required {requiredCount === 1 ? 'fix' : 'fixes'} · {checklist.length - requiredCount} recommended {checklist.length - requiredCount === 1 ? 'review' : 'reviews'}</span></summary>
      <p className="mt-3 text-xs leading-relaxed text-slate-600">Required fixes come from existing save or publish checks. Recommendations are optional. Scoring diagnostics run in Review & publish. Preview your intended journeys before sharing; server checks still run when you publish.</p>
      {checklist.length ? <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto p-1">{checklist.map(item => <li key={item.id} className="rounded-lg border border-stone-200 p-3"><p className="text-xs font-semibold text-slate-600">{item.level === "recommendation" ? "Recommended review" : item.source === "save" ? "Required to save" : "Required before publishing"}</p><p className="mt-1 break-words text-sm text-slate-800">{item.message}</p><button type="button" data-checklist-action className="mt-2 rounded text-left text-sm font-semibold text-red-800 underline focus-visible:outline-2 focus-visible:outline-offset-4" onClick={() => item.target || item.reviewSection ? navigateChecklist(item.target, item.reviewSection) : leave(onAdvanced)}>{item.target ? "Go to field" : item.reviewSection === "promise" ? "Review landing page" : item.reviewSection === "questions" ? "Review questions" : "Review in advanced tools"}<span className="sr-only">: {item.message}</span></button></li>)}</ul> : <p className="mt-3 text-sm text-green-800">These setup checks passed. Preview your intended journeys before sharing.</p>}
    </details>
    {checklistNotice && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{checklistNotice}</p>}
    <section ref={sheetRef} tabIndex={-1} className="guided-sheet rounded-2xl border bg-white p-5 sm:p-8 space-y-6" aria-label={steps[step]}>
      {step === 0 && <><h1 className="text-3xl font-semibold">Give your quiz a clear promise.</h1><p className="text-slate-600">Tell people what they will discover. Your starting questions and scoring are already connected; edit them one step at a time.</p>{field("Quiz title", form.title, title => onChange({ ...form, title, coverPage: form.coverPage ? { ...form.coverPage, title } : undefined }), false, { kind: "quiz-title" })}{field("What will people discover?", form.description || "", description => onChange({ ...form, description, coverPage: form.coverPage ? { ...form.coverPage, subtitle: description } : undefined }), true)}{form.coverPage?.enabled && field("Start button label", form.coverPage.buttonText, buttonText => onChange({ ...form, coverPage: { ...form.coverPage!, buttonText } }))}<p className="text-sm text-slate-500">Using a template? Replace its example products and advice with your own before publishing.</p><details ref={landingRef} className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Design your landing page</summary><div className="mt-5"><LandingPageEditor form={form} onChange={onChange}/></div></details></>}
      {step === 1 && <>
        <h1 className="text-3xl font-semibold">One question at a time.</h1>
        <ScoringMode form={form} onChange={onChange}/>
        <p className="text-slate-600">Add questions, arrange the answers, and connect each choice to a useful result. Your changes save with the rest of your draft.</p>
        {editingError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{editingError}</p>}
        <div className="flex flex-col items-stretch gap-3 rounded-xl bg-stone-50 p-4 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-sm font-medium">New question type<select aria-label="New question type" className="hq-input mt-2 w-full" value={newQuestionType} onChange={e => setNewQuestionType(e.target.value as "multiple_choice" | "multiselect")}><option value="multiple_choice">Choose one answer</option><option value="multiselect">Choose several answers</option></select></label>
          <button type="button" className="hq-secondary" disabled={form.questions.length >= 200} onClick={addQuestion}><Plus size={16}/>Add question</button>
        </div>
        {q ? <>
          <label className="block text-sm font-medium">Question<select aria-label="Question" className="hq-input mt-2 w-full" value={Math.min(questionIndex, questions.length - 1)} onChange={e => { cancelChecklist(); setQuestionIndex(Number(e.target.value)); setEditingError(""); }}>{questions.map((x, i) => <option key={x.id} value={i}>{i + 1}. {x.title || "Untitled question"}</option>)}</select></label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="hq-secondary" aria-label="Move question up" disabled={questionIndex === 0} onClick={() => edit(() => moveGuidedQuestion(form, q.id, -1))}><ArrowUp size={15}/>Move up</button>
            <button type="button" className="hq-secondary" aria-label="Move question down" disabled={questionIndex >= questions.length - 1} onClick={() => edit(() => moveGuidedQuestion(form, q.id, 1))}><ArrowDown size={15}/>Move down</button>
            <button type="button" className="hq-secondary text-red-800" onClick={() => remove()}><Trash2 size={15}/>Remove question</button>
          </div>
          {field("Question wording", q.title, title => question({ title }), false, { kind: "question-title", questionId: q.id })}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(q.required)} onChange={e => question({ required: e.target.checked })}/>Answer required</label>
          {form.logicRules?.some(rule => rule.sourceQuestionId === q.id) && <p className="text-sm text-slate-600">This question has branching. After changing its answers, check the conversation map. Substring conditions may need updating in the full editor.</p>}
          {q.options?.map((option, index) => <fieldset key={option.id} className="rounded-xl border p-4 space-y-3">
            <legend className="px-1 text-xs font-semibold">Answer {index + 1}</legend>
            {field("Answer wording", option.label, label => onChange(renameGuidedAnswer(form, q.id, option.id, label)), false, { kind: "answer-label", questionId: q.id, answerId: option.id })}
            {guidedChoiceTypes.has(q.type) && <div className="flex flex-wrap gap-2">
              <button type="button" className="hq-secondary" aria-label={`Move answer ${index + 1} up`} disabled={index === 0} onClick={() => edit(() => moveGuidedAnswer(form, q.id, option.id, -1))}><ArrowUp size={14}/><span className="text-xs">Move up</span></button>
              <button type="button" className="hq-secondary" aria-label={`Move answer ${index + 1} down`} disabled={index === q.options!.length - 1} onClick={() => edit(() => moveGuidedAnswer(form, q.id, option.id, 1))}><ArrowDown size={14}/><span className="text-xs">Move down</span></button>
              <button type="button" className="hq-secondary text-red-800" aria-label={`Remove answer ${index + 1}`} disabled={q.options!.length <= 2} onClick={() => remove(option.id)}><Trash2 size={14}/><span className="text-xs">Remove</span></button>
            </div>}
            {m ? <div className="space-y-2">{m.rules.filter(r => r.questionId === q.id && r.answerId === option.id).map(rule => <div key={rule.id} className="flex flex-wrap items-center gap-2 text-sm text-slate-600"><span>{rule.effect === "exclude" ? "Rules out" : m.kind === "scorecard" ? "Points toward" : "Recommends"}: <strong>{[...m.outcomes, ...m.categories].find(t => t.id === rule.targetId)?.title || "Missing result"}</strong></span>{rule.effect === "add" && <label className="flex items-center gap-2">Points<input aria-label={`Points for answer ${index + 1} toward ${[...m.outcomes, ...m.categories].find(t => t.id === rule.targetId)?.title}`} className="w-20 rounded border p-2" type="number" min={0} max={100} value={rule.points} onChange={e => { const points = Number(e.target.value); if (Number.isFinite(points) && points >= 0 && points <= 100) onChange({ ...form, marketing: { ...m, rules: m.rules.map(r => r.id === rule.id ? { ...r, points } : r) } }); }} /></label>}</div>)}{!m.rules.some(r => r.questionId === q.id && r.answerId === option.id) && <p className="text-xs text-slate-500">No points assigned. This answer is neutral. Use “Connect answers to results” below to change that.</p>}</div> : form.mode === "quiz" && guidedChoiceTypes.has(q.type) ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(option.isCorrect)} onChange={e => question({ options: q.options!.map(answer => answer.id === option.id ? { ...answer, isCorrect: e.target.checked } : singleTypes.has(q.type) && e.target.checked ? { ...answer, isCorrect: false } : answer) })}/>Correct answer {index + 1}</label> : null}
          </fieldset>)}
          {guidedChoiceTypes.has(q.type) && <button type="button" className="hq-secondary" onClick={() => edit(() => addGuidedAnswer(form, q.id))}><Plus size={16}/>Add answer</button>}
          {!guidedChoiceTypes.has(q.type) && <p className="text-sm text-slate-600">Use the full editor for this field’s options and settings.</p>}
          {m && Boolean(q.options?.length) && <details key={q.id} className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Connect answers to results</summary><AnswerScoring q={q} form={form} marketing={m} onChange={marketing => onChange({ ...form, marketing })} onLabelChange={(answerId, label) => onChange(renameGuidedAnswer(form, q.id, answerId, label))}/></details>}
        </> : <p className="rounded-xl border border-dashed p-6 text-slate-600">Start with one question above. You can add more as your conversation takes shape.</p>}
        <button onClick={() => leave(onAdvanced)} className="text-sm underline">More field types, pages, and branching</button>
      </>}
      {step === 2 && <><h1 className="text-3xl font-semibold">Make every result useful.</h1><p className="text-slate-600">Explain what fits, give one useful next step, and add the page you want people to visit.</p>{m && <ResultLayoutEditor marketing={m} onChange={presentation => onChange({ ...form, marketing: { ...m, presentation } })}/>} {m?.kind === "scorecard" ? <ScorecardResultsEditor marketing={m} onChange={marketing => onChange({ ...form, marketing })} /> : m ? m.outcomes.map((outcome, index) => { const update = (patch: Partial<typeof outcome>) => onChange({ ...form, marketing: { ...m, outcomes: m.outcomes.map(o => o.id === outcome.id ? { ...o, ...patch } : o) } }); return <details ref={element => { if (element) resultRefs.current.set(outcome.id, element); else resultRefs.current.delete(outcome.id); }} key={outcome.id} className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Result {index + 1}: {outcome.title}</summary><div className="mt-4 space-y-4">{field("Result name", outcome.title, title => update({ title }))}{field("Why this fits", outcome.description, description => update({ description }), true)}{field("Helpful advice", outcome.advice, advice => update({ advice }), true)}{field("Button text", outcome.ctaLabel, ctaLabel => update({ ctaLabel }))}{field("Destination link", outcome.ctaUrl, ctaUrl => update({ ctaUrl }), false, { kind: "outcome-cta", outcomeId: outcome.id })}</div></details>; }) : <button className="hq-secondary" onClick={() => leave(onAdvanced)}>Configure results in the full editor</button>}{m && <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">When no recommendation fits</summary><div className="mt-4 space-y-4">{field("Fallback title", m.fallbackTitle, fallbackTitle => onChange({ ...form, marketing: { ...m, fallbackTitle } }))}{field("Fallback guidance", m.fallbackMessage, fallbackMessage => onChange({ ...form, marketing: { ...m, fallbackMessage } }), true)}</div></details>}<button onClick={() => leave(onAdvanced)} className="text-sm underline">Advanced result design, videos, and conditions</button>{reportDesignEditor}{resultEmailEditor}</>}
      {step === 3 && <><h1 className="text-3xl font-semibold">Make it feel like your brand.</h1><p className="text-slate-600">Choose a palette, then adjust colors, type, and spacing. Your quiz keeps its own theme when embedded on another website.</p><div className="rounded-xl border p-6" style={{ background: form.theme.backgroundColor, color: form.theme.textColor }}><h2 className="text-xl font-semibold">{form.title}</h2><p className="my-4">{form.questions[0]?.title}</p><span className="inline-block rounded-lg px-4 py-2 text-white" style={{ background: form.theme.primaryColor }}>Your quiz colors</span></div><button onClick={() => leave(onTheme)} className="hq-primary">Customize theme</button></>}
      {step === 4 && <><h1 className="text-3xl font-semibold">Check it. Try it. Share it.</h1><div className="rounded-xl border border-stone-200 bg-stone-50 p-4"><p role="status" className="text-sm font-semibold text-slate-900">{publicationLabel}</p><p className="mt-2 text-sm leading-relaxed text-slate-600">{publicationUncertain ? "Publication may have completed. Keep your draft and refresh this editor to check the live version before publishing again." : !published ? "Saving protects your draft. Publish when you are ready to open your quiz link and embeds." : hasUnpublishedChanges ? "Your latest edits are in the draft. The public link still shows the previous published version; publish again to update it." : "Your current draft matches the published version. You can share its link or embed it on your website."}</p></div><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={capture.enabled} onChange={e => onChange({ ...form, capture: { ...capture, enabled: e.target.checked } })} />Collect contact details</label>{capture.enabled && <div className="space-y-4"><p className="text-sm text-slate-600">Contact capture is {capture.required ? "required" : "optional"}. Marketing opt-in is {capture.marketingEnabled ? "enabled" : "off"}. Change the full capture settings in advanced tools.</p>{field("Contact heading", capture.title, title => onChange({ ...form, capture: { ...capture, title } }))}{field("Contact button label", capture.buttonText, buttonText => onChange({ ...form, capture: { ...capture, buttonText } }))}{field("Privacy-policy link", capture.privacyUrl, privacyUrl => onChange({ ...form, capture: { ...capture, privacyUrl } }), false, { kind: "capture-privacy" })}</div>}<p className="text-sm text-slate-600">Preview saves your latest changes first. Publishing runs the full checks and asks you to confirm before changing the live quiz.</p><div className="flex flex-wrap gap-3"><button onClick={onSave} className="hq-secondary">Save draft</button><button onClick={() => leave(onPreview)} className="hq-secondary">Save & preview</button><button data-publication-action="publish" disabled={publicationBusy} onClick={publish} className="hq-primary disabled:opacity-50">Review & publish</button>{published && <button type="button" disabled={publicationBusy} onClick={() => leave(onPause)} className="hq-secondary !hidden lg:!inline-flex disabled:opacity-50"><Pause size={16} aria-hidden="true"/>Pause publication</button>}</div>{published ? <div className="flex flex-wrap items-center gap-4"><button type="button" onClick={() => leave(onShare)} className="hq-secondary">Embed &amp; Share</button><a className="block text-sm underline" href={`/play/${form.id}`} target="_blank" rel="noreferrer">Open published quiz →</a></div> : !publicationUncertain ? <p className="text-sm text-slate-600">New public starts are closed. Publishing opens your link and embeds; republishing after a pause restores the same URL.</p> : null}</>}
    </section><footer className="my-6 flex items-center justify-between gap-3"><button className="hq-secondary disabled:opacity-40" disabled={step === 0} onClick={() => goToStep(step - 1)}>Back</button><span className="text-xs text-slate-500">Step {step + 1} of 5</span>{step < 4 ? <button className="hq-primary" onClick={() => goToStep(step + 1)}>Continue →</button> : <button className="hq-secondary" onClick={() => leave(onAdvanced)}>More tools</button>}</footer>
  </div></main></>;
}
