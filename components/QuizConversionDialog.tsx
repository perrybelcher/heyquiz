"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { FormSchemaType } from "@/lib/schema";
import { quizTypes, quizTypeDefinitions, type QuizType } from "@/lib/quiz-types";

export type ConversionPreview = { source: FormSchemaType; changes: string[] };

/** Conversion is deliberately a two-step action: saved-source impact review,
 * then an idempotent copy. A failed retry keeps the same reviewed source/key. */
export default function QuizConversionDialog({ currentType, onClose, onPreview, onCreate }: {
  currentType?: QuizType;
  onClose: () => void;
  onPreview: (target: QuizType) => Promise<ConversionPreview>;
  onCreate: (target: QuizType, preview: ConversionPreview, key: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<QuizType>(currentType === "personality" ? "diagnostic" : "personality");
  const [preview, setPreview] = useState<ConversionPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef<string | null>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLSelectElement>("select")?.focus();
    return () => { element?.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  function containTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled), input:not(:disabled), a[href]")).filter(element => element.getClientRects().length);
    if (!controls.length) { event.preventDefault(); return; }
    event.preventDefault();
    const current = controls.indexOf(document.activeElement as HTMLElement);
    const next = current < 0 ? (event.shiftKey ? controls.length - 1 : 0) : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    controls[next].focus();
  }
  async function review() {
    setBusy(true); setError("");
    try { const next = await onPreview(target); key.current = crypto.randomUUID(); setPreview(next); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not prepare the conversion. Please try again."); }
    finally { setBusy(false); }
  }
  async function create() {
    if (!preview || !key.current) return;
    setBusy(true); setError("");
    try { await onCreate(target, preview, key.current); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the copy. Retry safely with the same request."); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby="conversion-title" onKeyDown={containTab} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 text-stone-900 shadow-xl backdrop:bg-black/40">
    <h2 id="conversion-title" className="text-xl font-semibold">Change quiz type</h2>
    <p className="mt-2 text-sm text-stone-600">Create an unpublished copy with a different outcome. Your original quiz and its responses remain available.</p>
    <label className="mt-5 block text-sm font-semibold" htmlFor="conversion-type">Desired outcome</label>
    <select id="conversion-type" disabled={busy} value={target} onChange={event => { setTarget(event.target.value as QuizType); setPreview(null); key.current = null; setError(""); }} className="mt-2 w-full rounded-lg border border-stone-300 p-3">
      {quizTypes.filter(type => type !== currentType).map(type => <option key={type} value={type}>{quizTypeDefinitions[type].label}</option>)}
    </select>
    {preview && <section className="mt-5" aria-label="Conversion impact">
      <h3 className="font-semibold">Review what changes</h3>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{preview.changes.map((change, index) => <li key={index}>{change}</li>)}</ul>
      <p className="mt-3 text-sm">Review the copied results and rules in the editor before publishing.</p>
    </section>}
    {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button type="button" className="hq-secondary" disabled={busy} onClick={onClose}>Cancel</button>
      {preview ? <><button type="button" className="hq-secondary" disabled={busy} onClick={() => void review()}>Refresh preview</button><button type="button" className="hq-primary" disabled={busy} onClick={() => void create()}>{busy ? "Creating…" : "Create converted copy"}</button></> : <button type="button" className="hq-primary" disabled={busy} onClick={() => void review()}>{busy ? "Preparing…" : "Save and preview changes"}</button>}
    </div>
  </dialog>;
}
