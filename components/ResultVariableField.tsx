"use client";

import { useId, useRef, useState } from "react";
import type { Question } from "@/lib/schema";
import { answerVariable, resultVariableIssue, supportsResultAnswer } from "@/lib/result-variables";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  questions: readonly Question[];
  multiline?: boolean;
  maxLength?: number;
};

export default function ResultVariableField({ label, value, onChange, questions, multiline, maxLength }: Props) {
  const id = useId();
  const field = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const picker = useRef<HTMLDetailsElement>(null);
  const [questionId, setQuestionId] = useState("");
  const [fallback, setFallback] = useState("");
  const [error, setError] = useState("");
  const choices = questions.filter(supportsResultAnswer);
  const issue = resultVariableIssue(value, questions);
  const props = {
    id, value, maxLength,
    className: "hq-input w-full",
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setError(""); onChange(event.target.value); },
    "aria-describedby": issue || error ? `${id}-issue` : undefined,
  };
  function insert() {
    const input = field.current;
    if (!input || !choices.some(question => question.id === questionId) || !fallback.trim()) return;
    if (/[⟦⟧\r\n]/.test(fallback)) {
      setError("Use fallback wording without variable brackets or line breaks.");
      return;
    }
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;
    const token = answerVariable(questionId, fallback);
    const next = value.slice(0, start) + token + value.slice(end);
    if (maxLength && next.length > maxLength) {
      setError("Shorten the copy or fallback wording to fit this field.");
      return;
    }
    setError("");
    onChange(next);
    if (picker.current) picker.current.open = false;
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + token.length, start + token.length);
    });
  }
  return <div className="space-y-1 text-sm">
    <label htmlFor={id} className="block">{label}</label>
    {multiline ? <textarea {...props} ref={element => { field.current = element; }} /> : <input {...props} ref={element => { field.current = element; }} />}
    {!!choices.length && <details ref={picker}>
      <summary className="cursor-pointer underline">Insert answer</summary>
      <div className="space-y-2 pt-2">
        <label className="block">Answer from question<select className="hq-input w-full" value={questionId} onChange={event => { setError(""); setQuestionId(event.target.value); }}>
          <option value="">Choose a question</option>
          {choices.map(question => <option key={question.id} value={question.id}>{question.title || "Untitled question"}</option>)}
        </select></label>
        <label className="block">Fallback wording<input className="hq-input w-full" value={fallback} maxLength={160} onChange={event => { setError(""); setFallback(event.target.value); }} /></label>
        <p className="text-xs text-slate-600">Shown when there’s no usable answer. Use a phrase that fits the sentence.</p>
        <button type="button" className="hq-secondary" disabled={!questionId || !fallback.trim()} onClick={insert}>Insert variable</button>
      </div>
    </details>}
    {(error || issue) && <p id={`${id}-issue`} role="status" className="text-amber-800">{error || issue}</p>}
  </div>;
}
