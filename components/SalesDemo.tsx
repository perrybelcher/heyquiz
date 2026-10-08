"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Sparkles } from "lucide-react";
import { marketingTemplate } from "@/lib/marketing-templates";
import { evaluateMarketing } from "@/lib/marketing";
const form = marketingTemplate("product_finder", "public-sample");
export default function SalesDemo() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const shouldFocus = useRef(false);
  useLayoutEffect(() => { if (shouldFocus.current) { heading.current?.focus({ preventScroll: true }); shouldFocus.current = false; } }, [step]);
  const question = form.questions[step];
  const result = step === form.questions.length ? evaluateMarketing(form, answers) : undefined;
  function move(next: number) { shouldFocus.current = true; setStep(next); }
  return <div className="sales-demo" id="demo">
    <div className="demo-top"><span><span className="status-dot"/> TRY IT YOURSELF</span><span>{question ? `${step + 1} / ${form.questions.length}` : "YOUR RESULT"}</span></div>
    <div className="demo-progress" aria-hidden="true"><span style={{ width: `${(step + 1) / (form.questions.length + 1) * 100}%` }}/></div>
    <div className="demo-content" key={step}>
      <span className="demo-brand">THE EVERYDAY EDIT</span>
      <h2 ref={heading} tabIndex={-1}>{question?.title || result?.title}</h2>
      {question ? <><p>Find a bag that fits the way you move.</p><div className="demo-options">{question.options?.map((option, i) => <button key={option.id} onClick={() => { setAnswers(a => ({ ...a, [question.id]: option.id })); move(step + 1); }}><span className="option-letter">{String.fromCharCode(65 + i)}</span>{option.label}<ArrowRight size={16} aria-hidden="true"/></button>)}</div></> : <div className="demo-result"><span className="result-icon"><Sparkles size={24}/></span><p>{result?.message}</p>{result?.reasons.map(reason => <p className="demo-reason" key={reason}><Check size={16} aria-hidden="true"/>{reason}</p>)}<p>{result?.advice}</p><a href="#how-it-works" className="sales-button">See how to build yours <ArrowRight size={16}/></a></div>}
      <div className="demo-bottom">{step > 0 ? <button onClick={() => move(step - 1)}><ArrowLeft size={14}/> Back</button> : <span>Three questions. A more personal answer.</span>}{result && <button onClick={() => { setAnswers({}); move(0); }}><RotateCcw size={14}/> Start again</button>}</div>
    </div>
    <p className="demo-disclosure">Fictional products. Real HeyQuiz matching. Answers stay in this page and are not saved.</p>
  </div>;
}
