"use client";

import type { FormSchemaType, FormSettings } from "@/lib/schema";
import type { GuidedChecklistTarget } from "@/lib/guided-checklist";
import LandingPageEditor from "../LandingPageEditor";

export interface BasicQuizSettingsProps {
  form: FormSchemaType;
  onChange: (form: FormSchemaType) => void;
  onChooseImage: () => void;
  onFieldRef?: (target: GuidedChecklistTarget, element: HTMLInputElement | HTMLTextAreaElement | null) => void;
}

export default function BasicQuizSettings({ form, onChange, onChooseImage, onFieldRef }: BasicQuizSettingsProps) {
  const settings = form.settings;
  const update = (patch: Partial<FormSettings>) => onChange({ ...form, settings: { ...settings, ...patch } });
  return <div className="basic-section">
    <header><h1>Introduce your quiz</h1><p className="basic-help">Give visitors a clear reason to begin, then choose how the questions appear.</p></header>
    <section className="basic-section" aria-label="Quiz introduction">
      <label className="basic-field">Quiz title<input className="hq-input" ref={element => onFieldRef?.({ kind: "quiz-title" }, element)} value={form.title} onChange={event => onChange({ ...form, title: event.target.value })}/></label>
      <label className="basic-field">Introduction<textarea className="hq-input" rows={4} value={form.description || ""} onChange={event => onChange({ ...form, description: event.target.value })}/></label>
    </section>
    <section className="basic-section" aria-label="Welcome screen">
      <h2>Welcome screen</h2><p className="basic-help">Use the existing landing designer to edit the heading, text, image and start button.</p>
      <LandingPageEditor form={form} onChange={onChange} onChooseImage={onChooseImage}/>
    </section>
    <section className="basic-section" aria-labelledby="basic-presentation-title">
      <h2 id="basic-presentation-title">Question presentation</h2>
      <div className="basic-field-grid">
        <label className="basic-field">Show questions<select className="hq-input" value={settings.presentation || "question"} onChange={event => update({ presentation: event.target.value as FormSettings["presentation"] })}><option value="question">One question at a time</option><option value="page">Questions grouped by page</option></select></label>
        <label className="basic-field">Progress indicator<select className="hq-input" value={settings.showProgressBar === false ? "none" : settings.progressBarMode || "percentage"} onChange={event => update({ progressBarMode: event.target.value as FormSettings["progressBarMode"], showProgressBar: event.target.value !== "none" })}><option value="percentage">Percentage</option><option value="steps">Steps</option><option value="questions">Question count</option><option value="pages">Page count</option><option value="none">No progress indicator</option></select></label>
      </div>
      {settings.presentation === "page" && <label className="basic-check"><input type="checkbox" checked={Boolean(settings.enablePageJumps)} onChange={event => update({ enablePageJumps: event.target.checked })}/>Allow visitors to return to earlier pages</label>}
      <label className="basic-check"><input type="checkbox" checked={Boolean(settings.showReviewBeforeSubmit)} onChange={event => update({ showReviewBeforeSubmit: event.target.checked })}/>Review answers before submitting</label>
      <label className="basic-check"><input type="checkbox" checked={Boolean(settings.enableKeyboardShortcuts)} onChange={event => update({ enableKeyboardShortcuts: event.target.checked })}/>Enable participant keyboard shortcuts</label>
      {form.mode === "quiz" && <>
        <label className="basic-field">Show answer feedback<select className="hq-input" value={settings.feedbackMode || "end"} onChange={event => update({ feedbackMode: event.target.value as FormSettings["feedbackMode"] })}><option value="end">At the end of the quiz</option><option value="immediate">After each answer</option></select></label>
        <label className="basic-check"><input type="checkbox" checked={Boolean(settings.showAnswerKeyOnFinish)} onChange={event => update({ showAnswerKeyOnFinish: event.target.checked })}/>Show the answer key after completion</label>
      </>}
    </section>
  </div>;
}
