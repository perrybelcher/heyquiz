"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode, type MouseEvent } from "react";
import type { FormSchemaType } from "@/lib/schema";
import { orderedQuestions } from "@/lib/engine";
import { addGuidedQuestion } from "@/lib/guided-editing";
import type { ConversationEdit } from "./ConversationMap";
import { buildGuidedChecklist, guidedTargetKey, resolveGuidedChecklistTarget, type GuidedChecklistTarget, type GuidedReviewSection } from "@/lib/guided-checklist";
import BasicBuilderShell from "./basic/BasicBuilderShell";
import BasicQuestionEditor from "./basic/BasicQuestionEditor";
import BasicResultsEditor from "./basic/BasicResultsEditor";
import BasicVisitorPreview from "./basic/BasicVisitorPreview";
import BasicQuizSettings from "./basic/BasicQuizSettings";
import BasicDesignSettings from "./basic/BasicDesignSettings";
import BasicPublishSettings from "./basic/BasicPublishSettings";
export type BasicEditorState = { step: number; resultsReviewed: boolean; resultId: string | null };
const outcomeStepOrder=[2,0,1,3,4], standardStepOrder=[0,1,2,3,4];
const steps = ["Your quiz", "Questions", "Results", "Design", "Publish"];
export default function GuidedQuizEditor({ form, onChange, onAdvanced, onFlow, onTheme, onPublish, onPreview, onSave, status, published, publicationLabel, publicationUncertain, hasUnpublishedChanges, onShare, onPause, publicationBusy, onConversationMap, navigationRequest, onHistory, previewing, saveFailed, uiState, onUiStateChange, selectedQuestionId, onQuestionSelect, onChooseImage, onChangeType }: {
  uiState: BasicEditorState; onUiStateChange: (state: BasicEditorState) => void; selectedQuestionId: string | null; onQuestionSelect: (id: string | null) => void; onChooseImage: () => void; onChangeType?: () => void;
  reportDesignEditor?: ReactNode;
  resultEmailEditor?: ReactNode;
  onHistory: () => void; previewing: boolean; saveFailed: boolean; mobileStatus: string;
  form: FormSchemaType; onChange: (form: FormSchemaType) => void;
  onFlow?: () => void;
  onAdvanced: () => void; onTheme: () => void; onPublish: (event?: MouseEvent<HTMLButtonElement>) => void; onPreview: () => void; onSave: () => void;
  status: string; published: boolean; publicationLabel: string; publicationUncertain: boolean; hasUnpublishedChanges: boolean; onShare: () => void; onPause: () => void; publicationBusy: boolean; onConversationMap: () => void; navigationRequest?: ConversationEdit & {requestId:number; focus?:boolean};
}) {
  const outcomeFirst=Boolean(form.quizType && form.marketing && form.marketing.kind!=="scorecard");
  const stepOrder=outcomeFirst?outcomeStepOrder:standardStepOrder;
  const step = uiState.step;
  const setStep = (value: number) => onUiStateChange({ ...uiState, step: value });
  const position=stepOrder.indexOf(step);
  const resultsReviewed = uiState.resultsReviewed || !outcomeFirst;
  const setQuestionIndex = (index: number) => onQuestionSelect(questions[index]?.id || null);
  const [newQuestionType, setNewQuestionType] = useState<"multiple_choice" | "multiselect" | "short_answer" | "paragraph" | "email">("multiple_choice");
  const [editingError, setEditingError] = useState("");
  const questions = orderedQuestions(form);
  const questionIndex = Math.max(0, questions.findIndex(question => question.id === selectedQuestionId));
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
  const sheetRef = useRef<HTMLElement>(null);
  function cancelChecklist() { requestId.current++; setPendingTarget(null); setPendingNavigationFocus(null); }
  function goToStep(value: number, reviewAcknowledged = false) { cancelChecklist(); if(value===1 && !resultsReviewed && !reviewAcknowledged){setChecklistNotice("Review your possible results before editing questions.");setStep(2);return;} setChecklistNotice(""); setStep(value); }
  function leave(action: () => void) { cancelChecklist(); action(); }
  function publish(event?: MouseEvent<HTMLButtonElement>) { cancelChecklist(); onPublish(event); }
  function navigateChecklist(target?: GuidedChecklistTarget, reviewSection?: GuidedReviewSection) {
    cancelChecklist(); setChecklistNotice(""); focusOrigin.current = document.activeElement;
    const resolved = target ? resolveGuidedChecklistTarget(form, target) : null;
    if (target && !resolved) { setChecklistNotice("This checklist item changed. Review the current draft and choose an item again."); return; }
    const targetStep=resolved?.step ?? ({ promise: 0, questions: 1, results: 2, capture: 4 }[reviewSection || "questions"]);
    if(targetStep===1 && !resultsReviewed){setChecklistNotice("Review your possible results and choose Results reviewed before editing questions.");setStep(2);return;}
    if (target && "outcomeId" in target) onUiStateChange({ ...uiState, step: targetStep, resultId: target.outcomeId });
    else setStep(targetStep);
    if (target && "questionId" in target) setQuestionIndex(orderedQuestions(form).findIndex(question => question.id === target.questionId));
    setPendingTarget({ requestId: ++requestId.current, quizId: form.id, target, reviewSection });
  }

  useEffect(() => {
    if (!navigationRequest) return;
    if(navigationRequest.target === "questions" && !resultsReviewed){
      // An external question shortcut follows the same result-review requirement.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(2); setChecklistNotice("Review your possible results and choose Results reviewed before editing questions."); setPendingTarget(null); setPendingNavigationFocus(null); return;
    }
    const navigationId = ++requestId.current, origin = document.activeElement;
    const stepsByTarget = { promise:0, questions:1, results:2, design:3, capture:4, publish:4 };
    // An explicit request from the conversation map is an external navigation event.
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
      } else control = sheetRef.current;
      if (control?.isConnected) {
        control.focus({ preventScroll: true });
        (control.closest("label") || control).scrollIntoView({ block: "center", behavior: "instant" });
      } else setChecklistNotice("This field is no longer available here. Review the current draft or use advanced tools.");
      setPendingTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingTarget, form, step, q?.id]);

  function addQuestion() {
    cancelChecklist(); setEditingError("");
    try {
      const added = addGuidedQuestion(form, newQuestionType, q?.id);
      onChange(added.form); onQuestionSelect(added.questionId);
    } catch (error) { setEditingError(error instanceof Error ? error.message : "Could not add a question."); }
  }
  const onFieldRef = (target: GuidedChecklistTarget, element: HTMLInputElement | HTMLTextAreaElement | null) => {
    const key = guidedTargetKey(target);
    if (element) fieldRefs.current.set(key, element); else fieldRefs.current.delete(key);
  };
  const m = form.marketing;
  const nextStep = stepOrder[position + 1];
  const continueStep = () => {
    cancelChecklist(); setChecklistNotice("");
    onUiStateChange({ ...uiState, step: nextStep, resultsReviewed: resultsReviewed || step === 2 });
  };
  const footer = <>
    {step === 1 ? <div className="basic-question-pagination">
      <button type="button" className="hq-secondary" disabled={questionIndex === 0} onClick={() => { cancelChecklist(); setQuestionIndex(questionIndex - 1); }}>Previous question</button>
      <span>Question {questions.length ? questionIndex + 1 : 0} of {questions.length} · {Math.max(0,questions.length-questionIndex-1)} remaining</span>
      <button type="button" className="hq-primary" disabled={!questions.length || questionIndex >= questions.length - 1} onClick={() => { cancelChecklist(); setQuestionIndex(questionIndex + 1); }}>Next question</button>
    </div> : null}
    <div className="basic-step-pagination"><button type="button" className="hq-secondary" disabled={position === 0} onClick={() => goToStep(stepOrder[position - 1])}>Previous step</button><span>Step {position + 1} of 5</span>
    {position < stepOrder.length - 1 ? <button type="button" className="hq-primary" disabled={step === 2 && outcomeFirst && !m?.outcomes.length} onClick={continueStep}>{step === 2 && outcomeFirst ? "Results reviewed — continue" : `Continue to ${steps[nextStep]}`}</button> : <button type="button" className="hq-primary" disabled={publicationBusy} onClick={publish}>Review & publish</button>}</div>
  </>;
  return <BasicBuilderShell title={form.title} status={status} saveFailed={saveFailed}
    steps={stepOrder.map(id => ({id, label: steps[id]}))} activeStep={step} onStepChange={goToStep}
    questions={questions} selectedQuestionId={q?.id || null} onQuestionSelect={id => { cancelChecklist(); onQuestionSelect(id); }} onAddQuestion={addQuestion}
    onAdvanced={() => leave(onAdvanced)} onFlow={onFlow ? () => leave(onFlow) : undefined} onShare={() => leave(onShare)} onPreview={() => leave(onPreview)} onPublish={publish} previewing={previewing} publicationBusy={publicationBusy}
    preview={<BasicVisitorPreview form={form} step={step} questionId={q?.id} resultId={uiState.resultId || undefined}/>} footer={footer}
    notices={<>{checklistNotice && <p role="status">{checklistNotice}</p>}{editingError && <p role="alert">{editingError}</p>}</>}
  >
    <section ref={sheetRef} tabIndex={-1} className="guided-sheet basic-step-content" aria-label={steps[step]}
      onPointerDownCapture={event => { if ((pendingTarget || pendingNavigationFocus) && !(event.target as Element).closest("[data-checklist-action]")) cancelChecklist(); }}
      onKeyDownCapture={event => { if ((pendingTarget || pendingNavigationFocus) && event.key === "Tab") cancelChecklist(); }}
      onInputCapture={() => { if (pendingTarget || pendingNavigationFocus) cancelChecklist(); }}>
      {step === 0 && <BasicQuizSettings form={form} onChange={onChange} onChooseImage={onChooseImage} onFieldRef={onFieldRef}/>}
      {step === 1 && <>
        {q ? <BasicQuestionEditor form={form} onChange={onChange} questionId={q.id} onAdvanced={() => leave(onAdvanced)} onRoutes={() => goToStep(2)} onFieldRef={onFieldRef} onQuestionRemoved={onQuestionSelect}/> : <p>Add your first question to get started.</p>}
        <details className="basic-add-question"><summary>Add a question</summary><label>Question type<select value={newQuestionType} onChange={event => setNewQuestionType(event.target.value as typeof newQuestionType)}><option value="multiple_choice">Single choice</option><option value="multiselect">Multiple answers</option><option value="short_answer">Short answer</option><option value="paragraph">Long answer</option><option value="email">Email</option></select></label><button type="button" className="hq-secondary" onClick={addQuestion}>Add question</button></details>
      </>}
      {step === 2 && <BasicResultsEditor form={form} onChange={onChange} selectedResultId={uiState.resultId} onSelectResult={resultId => onUiStateChange({ ...uiState, resultId })} onAdvanced={() => leave(onAdvanced)} onFieldRef={onFieldRef} onDetailsRef={(id,element) => { if(element)resultRefs.current.set(id,element);else resultRefs.current.delete(id); }}/>}
      {step === 3 && <BasicDesignSettings form={form} onChange={onChange} onTheme={() => leave(onTheme)}/>}
      {step === 4 && <>
        <BasicPublishSettings form={form} onChange={onChange} published={published} publicationLabel={publicationLabel} publicationUncertain={publicationUncertain} hasUnpublishedChanges={hasUnpublishedChanges} publicationBusy={publicationBusy} onSave={onSave} onPreview={() => leave(onPreview)} onPublish={publish} onShare={() => leave(onShare)} onPause={() => leave(onPause)} onFieldRef={onFieldRef}/>
        <section aria-label="Setup checklist" className="basic-checklist"><h2>Readiness checklist</h2><p>{requiredCount} required fixes · {checklist.length - requiredCount} recommendations</p>
        <p>Recommendations are optional. Existing server checks still run when you publish.</p>
        {nextItem && <button type="button" data-checklist-action className="hq-secondary" onClick={() => nextItem.target || nextItem.reviewSection ? navigateChecklist(nextItem.target,nextItem.reviewSection) : leave(onAdvanced)}>Review next item</button>}
        {(["blocker", "recommendation"] as const).map(level => <div key={level}><h3>{level === "blocker" ? "Required fixes" : "Recommendations"}</h3><ul>{checklist.filter(item => item.level === level).map(item => <li key={item.id}><p>{item.message}</p><button type="button" data-checklist-action className="hq-secondary" onClick={() => item.target || item.reviewSection ? navigateChecklist(item.target,item.reviewSection) : leave(onAdvanced)}>{item.target ? "Go to field" : "Review settings"}<span className="sr-only">: {item.message}</span></button></li>)}</ul>{!checklist.some(item => item.level === level) && <p>{level === "blocker" ? "No required fixes in these setup checks." : "No additional recommendations."}</p>}</div>)}
        </section>
      </>}
      <details className="basic-editor-tools"><summary>More editor tools</summary><a className="hq-secondary" href="/help" target="_blank" rel="noreferrer">Help & support</a>{onChangeType && <button type="button" className="hq-secondary" onClick={() => leave(onChangeType)}>Change type</button>}<button type="button" className="hq-secondary" onClick={() => leave(onConversationMap)}>Conversation map</button><button type="button" className="hq-secondary" onClick={() => leave(onHistory)}>Draft history</button><button type="button" className="hq-secondary" onClick={onSave}>Save draft</button></details>
    </section>
  </BasicBuilderShell>;
}
