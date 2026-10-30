"use client";
import { useEffect, useRef, useState } from "react";
import { X, Plus, ArrowRight, Flag } from "lucide-react";
import type { QuestionType } from "@/lib/schema";

const types: { type: QuestionType; label: string }[] = [
  { type: "multiple_choice", label: "Multiple choice" },
  { type: "multiselect", label: "Multiple answers" },
  { type: "short_answer", label: "Short answer" },
  { type: "paragraph", label: "Long answer" },
  { type: "number", label: "Number" },
  { type: "email", label: "Email" },
  { type: "rating", label: "Rating" },
];
export default function FlowBranchChooser({ title, choices, insert, error, canCreate, canCreateResult, onQuestion, onDestination, onResult, onClose }: {
  title: string; error?: string; choices: {value: string; label: string}[]; insert: boolean; canCreate: boolean; canCreateResult: boolean;
  onQuestion: (type: QuestionType) => void; onDestination: (value: string) => void; onResult: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = ref.current;
    element?.showModal();
    return () => { element?.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  const results = choices.filter(c => c.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <dialog ref={ref} className="flow-branch-chooser" aria-labelledby="flow-branch-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if(e.target === e.currentTarget) onClose(); }}>
    <header><div><h2 id="flow-branch-title">{title}</h2><p>{insert ? "The new question will continue to the current destination." : "Choose what happens next."}</p></div><button aria-label="Close destination chooser" onClick={onClose}><X size={18}/></button></header>
    {error && <p role="alert">{error}</p>}
    <section className="flow-choice-group"><h3>{insert ? "Insert a question" : "New question"}</h3><div className="flow-choice-grid">{types.map(t => <button disabled={!canCreate} key={t.type} onClick={() => onQuestion(t.type)}><Plus size={16}/>{t.label}</button>)}</div>{!canCreate && <p>The maximum is 200 questions.</p>}</section>
    {!insert && <section className="flow-choice-group"><h3>Existing question or result</h3><input autoFocus className="flow-choice-search" aria-label="Search destinations" placeholder="Search questions and results…" value={search} onChange={e => setSearch(e.target.value)}/><div className="flow-choice-destinations">{results.map(c => <button key={c.value} onClick={() => onDestination(c.value)}><ArrowRight size={16}/>{c.label}</button>)}{!results.length && <p>No destinations match your search.</p>}</div>{canCreateResult && <button onClick={onResult}><Flag size={17}/>Create result page</button>}</section>}
  </dialog>;
}
