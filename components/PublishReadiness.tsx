"use client";
import { useEffect, useMemo, useRef } from 'react';
import type { FormSchemaType } from '@/lib/schema';
import { getPublishReadiness } from '@/lib/publish-readiness';

export default function PublishReadiness({form,busy,onClose,onConfirm}:{form:FormSchemaType;busy:boolean;onClose:()=>void;onConfirm:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close();},[]);
  const checks=useMemo(()=>getPublishReadiness(form),[form]);
  return <dialog ref={dialog} aria-labelledby="publish-readiness-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}} className="m-auto w-[calc(100%-2rem)] max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl backdrop:bg-black/50 text-slate-900">
    <h2 id="publish-readiness-title" className="text-xl font-semibold">Ready to publish?</h2>
    <p className="mt-2 text-sm text-slate-600">Publishing replaces the version visitors see through your public link and embeds. Review these checks first.</p>
    <section className="mt-5"><h3 className="font-semibold">Structure and scoring</h3>{checks.blockers.length?<ul className="list-disc pl-5 mt-2 text-sm text-red-800">{checks.blockers.map(x=><li key={x.message}>{x.message}</li>)}</ul>:<p className="text-sm mt-2 text-green-800">Required structure checks passed.</p>}</section>
    {checks.warnings.length>0&&<section className="mt-4 rounded-xl bg-amber-50 p-4"><h3 className="font-semibold">Review before sharing</h3><ul className="list-disc pl-5 text-sm mt-2 space-y-2">{checks.warnings.map(x=><li key={x.message}>{x.message}</li>)}</ul></section>}
    <section className="mt-4 text-sm"><h3 className="font-semibold">Lead capture</h3><p className="mt-1">{form.capture?.enabled?`${form.capture.required?'Required':'Optional'} capture. Marketing opt-in is ${form.capture.marketingEnabled?'enabled':'off'}.`:'Lead capture is off.'}</p></section>
    <p className="mt-4 text-sm text-slate-600">Use Preview to try a complete journey, including neutral answers and each intended result. These checks do not replace a review of your copy or complex branching.</p>
    <div className="flex flex-wrap gap-3 justify-end mt-6"><button disabled={busy} onClick={onClose} className="hq-secondary">Back to editor</button><button disabled={busy||checks.blockers.length>0} onClick={onConfirm} className="hq-primary disabled:opacity-50">{busy?'Publishing…':'Publish now'}</button></div>
  </dialog>;
}
