"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormSchemaType } from '@/lib/schema';
import { getPublishReadiness } from '@/lib/publish-readiness';

export default function PublishReadiness({form,busy,onClose,onConfirm}:{form:FormSchemaType;busy:boolean;onClose:()=>void;onConfirm:()=>void}) {
  const [security, setSecurity] = useState<"checking" | "ready" | "missing" | "error">("checking");
  const needsSecurity = form.questions.some(q => q.type === "captcha");
  useEffect(() => {
    if (!needsSecurity) return;
    let cancelled = false;
    fetch("/api/config", {cache:"no-store"}).then(r => {if (!r.ok) throw new Error(); return r.json();})
      .then(data => {if (!cancelled) setSecurity(data.turnstileConfigured === true ? "ready" : "missing");})
      .catch(() => {if (!cancelled) setSecurity("error");});
    return () => {cancelled = true;};
  }, [needsSecurity]);
  const needsAnswerReview = form.mode === "quiz" && form.questions.some(q => q.correctAnswerText || q.options?.some(o => o.isCorrect));
  const [answersReviewed, setAnswersReviewed] = useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close();},[]);
  const checks=useMemo(()=>getPublishReadiness(form),[form]);
  return <dialog ref={dialog} aria-labelledby="publish-readiness-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}} className="m-auto w-[calc(100%-2rem)] max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl backdrop:bg-black/50 text-slate-900">
    <h2 id="publish-readiness-title" className="text-xl font-semibold">Ready to publish?</h2>
    <p className="mt-2 text-sm text-slate-600">Publishing replaces the version visitors see through your public link and embeds. Review these checks first.</p>
    <section className="mt-5"><h3 className="font-semibold">Structure and scoring</h3>{checks.blockers.length?<ul className="list-disc pl-5 mt-2 text-sm text-red-800">{checks.blockers.map(x=><li key={x.message}>{x.message}</li>)}</ul>:<p className="text-sm mt-2 text-green-800">Required structure checks passed.</p>}</section>
    {checks.warnings.length>0&&<section className="mt-4 rounded-xl bg-amber-50 p-4"><h3 className="font-semibold">Review before sharing</h3><ul className="list-disc pl-5 text-sm mt-2 space-y-2">{checks.warnings.map(x=><li key={x.message}>{x.message}</li>)}</ul></section>}
    {needsSecurity && <section className="mt-4 text-sm" role="status"><h3 className="font-semibold">Spam protection</h3><p>{security === "ready" ? "Security verification is configured." : security === "checking" ? "Checking security setup…" : security === "missing" ? "Publishing is blocked: configure Cloudflare Turnstile before using a CAPTCHA question." : "Could not verify security setup. Close and reopen this check to retry."}</p></section>}
    <section className="mt-4 text-sm"><h3 className="font-semibold">Lead capture</h3><p className="mt-1">{form.capture?.enabled?`${form.capture.required?'Required':'Optional'} capture. Marketing opt-in is ${form.capture.marketingEnabled?'enabled':'off'}.`:'Lead capture is off.'}</p></section>
    <p className="mt-4 text-sm text-slate-600">Use Preview to try a complete journey, including neutral answers and each intended result. These checks do not replace a review of your copy or complex branching.</p>
    {needsAnswerReview && <label className="mt-4 flex items-start gap-3 rounded-xl bg-stone-50 p-4 text-sm"><input type="checkbox" checked={answersReviewed} onChange={e => setAnswersReviewed(e.target.checked)} className="mt-1"/><span>I reviewed the correct answers and explanations. Each single-choice question has only one defensible correct answer, including any AI-generated questions.</span></label>}
    <div className="flex flex-wrap gap-3 justify-end mt-6"><button disabled={busy} onClick={onClose} className="hq-secondary">Back to editor</button><button disabled={busy||checks.blockers.length>0||(needsSecurity && security !== "ready")||(needsAnswerReview && !answersReviewed)} onClick={onConfirm} className="hq-primary disabled:opacity-50">{busy?'Publishing…':'Publish now'}</button></div>
  </dialog>;
}
