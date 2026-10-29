"use client";

import { useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Image from "next/image";
import { Eye, Link2, List, Plus, Search, X } from "lucide-react";
import EditorModeSwitch from "../EditorModeSwitch";
import "./basic-builder.css";

export type BasicBuilderShellProps = {
  title: string;
  status: string;
  saveFailed?: boolean;
  steps: { id: number; label: string }[];
  activeStep: number;
  onStepChange: (step: number) => void;
  questions: { id: string; title: string }[];
  selectedQuestionId?: string | null;
  onQuestionSelect: (id: string) => void;
  onAddQuestion: () => void;
  onAdvanced: () => void;
  onShare: () => void;
  onPreview: () => void;
  onPublish: (event?: MouseEvent<HTMLButtonElement>) => void;
  previewing?: boolean;
  publicationBusy?: boolean;
  children: ReactNode;
  preview: ReactNode;
  footer: ReactNode;
  notices?: ReactNode;
  outline?: ReactNode;
};

export default function BasicBuilderShell({ title, status, saveFailed, steps, activeStep, onStepChange, questions, selectedQuestionId, onQuestionSelect, onAddQuestion, onAdvanced, onShare, onPreview, onPublish, previewing, publicationBusy, children, preview, footer, notices, outline }: BasicBuilderShellProps) {
  const [search, setSearch] = useState("");
  const outlineDialog = useRef<HTMLDialogElement>(null);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const searchId = useId();
  const outlineTitleId = useId();
  const previewTitleId = useId();
  const currentIndex = questions.findIndex(question => question.id === selectedQuestionId);
  const questionStep = activeStep === 1;
  const hasOutline = questionStep || outline !== undefined;
  const currentStep = steps.find(step => step.id === activeStep);
  const filtered = questions.map((question, index) => ({ ...question, number: index + 1 })).filter(question => question.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) || String(question.number) === search.trim());

  function questionOutline(mobile = false) {
    return <div className="basic-question-outline">
      <h2 id={mobile ? outlineTitleId : undefined}>Questions <span>· {questions.length}</span></h2>
      <label className="basic-outline-search" htmlFor={`${searchId}-${mobile ? "mobile" : "desktop"}`}>
        <Search size={17} aria-hidden="true" />
        <span className="basic-sr-only">Search questions</span>
        <input id={`${searchId}-${mobile ? "mobile" : "desktop"}`} type="search" placeholder="Search questions…" value={search} onChange={event => setSearch(event.target.value)} />
      </label>
      <p className="basic-outline-count" aria-live="polite">{search.trim() ? `${filtered.length} of ${questions.length} questions shown` : `${questions.length} questions in this quiz`}</p>
      <nav aria-label="Questions" className="basic-question-list">
        {filtered.map(question => <button key={question.id} type="button" aria-current={question.id === selectedQuestionId ? "true" : undefined} onClick={() => { onQuestionSelect(question.id); if (mobile) outlineDialog.current?.close(); }} title={`${question.number}. ${question.title || "Untitled question"}`}>
          <span className="basic-question-number" aria-hidden="true">{question.number}</span>
          <span className="basic-question-name"><span className="basic-sr-only">Question {question.number}: </span>{question.title || "Untitled question"}</span>
        </button>)}
        {!filtered.length && <p className="basic-empty">{questions.length ? "No questions match your search. Clear the search to see all questions." : "Add your first question to get started."}</p>}
      </nav>
      <div className="basic-outline-actions"><button className="basic-button" type="button" onClick={() => { onAddQuestion(); if (mobile) outlineDialog.current?.close(); }}><Plus size={18} aria-hidden="true" />Add question</button></div>
    </div>;
  }

  return <div className={`basic-builder${hasOutline ? " basic-builder--outlined" : ""}`}>
    <header className="basic-builder-header">
      <a className="basic-brand" href="/" aria-label="Pippi overview"><Image src="/pippi-logo.svg" width={75} height={38} alt="Pippi" priority /></a>
      <div className="basic-builder-identity"><p className="basic-quiz-title" title={title}>{title || "Untitled quiz"}</p><p role="status" className={`basic-save-status${saveFailed ? " basic-save-status--error" : ""}`}>{status}</p></div>
      <div className="basic-builder-actions">
        <EditorModeSwitch basic onChange={basic => { if (!basic) onAdvanced(); }} />
        <button className="basic-button" type="button" onClick={onShare}><Link2 size={17} aria-hidden="true" />Share</button>
        <button className="basic-button" type="button" onClick={onPreview} disabled={previewing}><Eye size={18} aria-hidden="true" />{previewing ? "Preparing…" : "Preview"}</button>
        <button className="basic-button basic-button--primary" type="button" onClick={onPublish} disabled={publicationBusy}>Publish</button>
      </div>
    </header>
    <nav className="basic-steps" aria-label="Quiz setup steps">{steps.map((step, index) => <button key={step.id} type="button" aria-current={activeStep === step.id ? "step" : undefined} onClick={() => onStepChange(step.id)}><span className="basic-step-number" aria-hidden="true">{index + 1}</span><span>{step.label}</span></button>)}</nav>
    {notices && <div className="basic-builder-notices">{notices}</div>}
    <div className="basic-compact-tools">
      {hasOutline && <button type="button" className={`basic-button basic-outline-trigger${!questionStep ? " basic-outline-trigger--other" : ""}`} onClick={() => outlineDialog.current?.showModal()}><List size={18} aria-hidden="true" />{questionStep ? `Questions · ${questions.length}` : `${currentStep?.label || "Step"} list`}</button>}
      {questionStep && <span className="basic-current-question">{currentIndex >= 0 ? `Question ${currentIndex + 1} of ${questions.length}` : `${questions.length} questions`}</span>}
      <button type="button" className="basic-button basic-preview-trigger" onClick={() => previewDialog.current?.showModal()}><Eye size={18} aria-hidden="true" />Visitor preview</button>
    </div>
    <div className="basic-builder-workspace">
      {hasOutline && <aside className="basic-builder-outline" aria-label={questionStep ? "Question outline" : "Step outline"}>{outline ?? questionOutline()}</aside>}
      <div className="basic-builder-editor">{children}</div>
      <aside className="basic-builder-preview" aria-label="Visitor preview">{preview}</aside>
      <footer className="basic-builder-footer">{footer}</footer>
    </div>
    <dialog ref={outlineDialog} className="basic-builder-dialog" aria-labelledby={outlineTitleId} onClick={event => { if (event.target === event.currentTarget) outlineDialog.current?.close(); }}>
      <div className="basic-dialog-content"><div className="basic-dialog-top">{!questionStep && <h2 id={outlineTitleId}>{currentStep?.label}</h2>}<button type="button" className="basic-button basic-icon-button" aria-label="Close question list" onClick={() => outlineDialog.current?.close()}><X size={20} aria-hidden="true" /></button></div>{outline ?? questionOutline(true)}</div>
    </dialog>
    <dialog ref={previewDialog} className="basic-builder-dialog basic-builder-dialog--preview" aria-labelledby={previewTitleId} onClick={event => { if (event.target === event.currentTarget) previewDialog.current?.close(); }}>
      <div className="basic-dialog-content"><div className="basic-dialog-top"><h2 id={previewTitleId}>Visitor preview</h2><button type="button" className="basic-button basic-icon-button" aria-label="Close visitor preview" onClick={() => previewDialog.current?.close()}><X size={20} aria-hidden="true" /></button></div>{preview}</div>
    </dialog>
  </div>;
}
