"use client";

import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ZodError } from "zod";
import {
  DEFAULT_RESULT_EMAIL_COPY, ResultEmailCopySchema, previewResultEmailCopy,
  resolveResultEmailCopy, type ResultEmailCopy,
} from "@/lib/result-email-copy";

// Held by EditorStudio, outside the quiz form: invalid/pending text survives tab
// changes without entering autosave or the published snapshot.
export type ResultEmailCopyDraft = { baseline: string; copy: ResultEmailCopy } | null;
export const resultEmailCopyIdentity = (value?: ResultEmailCopy) => JSON.stringify(value ?? null);

function storedCopyDraft(raw: string | null, quizId: string): ResultEmailCopyDraft {
  if (!raw || raw.length > 18000) return null;
  try {
    const value = JSON.parse(raw), draft = value.draft, copy = draft?.copy;
    if (value.version !== 1 || value.quizId !== quizId || typeof draft?.baseline !== "string" || draft.baseline.length > 6000 || copy?.version !== 1) return null;
    if (!["subject", "introduction", "signOff"].every(key => typeof copy[key] === "string" && copy[key].length <= 4096)) return null;
    // Invalid copy is allowed only as bounded raw editor text, never as form data.
    return { baseline: draft.baseline, copy: { version: 1, subject: copy.subject, introduction: copy.introduction, signOff: copy.signOff } };
  } catch { return null; }
}

export function useResultEmailCopyDraft(quizId: string) {
  const key = `pippi-result-email-copy:${quizId}`, cached = useRef<string | null | undefined>(undefined);
  const read = useCallback(() => {
    if (cached.current === undefined) try { cached.current = sessionStorage.getItem(key); } catch { cached.current = null; }
    return cached.current;
  }, [key]);
  const raw = useSyncExternalStore(() => () => {}, read, () => null);
  const recovered = useMemo(() => storedCopyDraft(raw, quizId), [raw, quizId]);
  const [override, setOverride] = useState<ResultEmailCopyDraft | undefined>(undefined), [storageWarning, setStorageWarning] = useState(false);
  const persisted = useRef<string | null | undefined>(undefined);
  const draft = override === undefined ? recovered : override;
  const update = (next: ResultEmailCopyDraft) => {
    const previous = persisted.current === undefined ? raw : persisted.current;
    setOverride(next);
    try {
      if (next) {
        const text = JSON.stringify({ version: 1, quizId, draft: next });
        if (!storedCopyDraft(text, quizId)) throw Error("Pending copy is too large for recovery.");
        sessionStorage.setItem(key, text); persisted.current = text;
      } else {
        // A mismatched stored draft may belong to another mounted editor instance.
        if (sessionStorage.getItem(key) === previous) sessionStorage.removeItem(key);
        persisted.current = null;
      }
      setStorageWarning(false);
    } catch { setStorageWarning(true); }
  };
  return { draft, update, restored: override === undefined && !!recovered, storageWarning };
}

export default function ResultEmailCopyEditor({ value, quizTitle, brandName, draft, onDraftChange, onChange, restored, storageWarning }: {
  value?: ResultEmailCopy; quizTitle: string; brandName?: string;
  draft: ResultEmailCopyDraft; onDraftChange: (draft: ResultEmailCopyDraft) => void;
  onChange: (value: ResultEmailCopy | undefined) => void;
  restored?: boolean; storageWarning?: boolean;
}) {
  const id = useId(), current = value ?? DEFAULT_RESULT_EMAIL_COPY, copy = draft?.copy ?? current;
  const stale = !!draft && draft.baseline !== resultEmailCopyIdentity(value);
  const errors: Partial<Record<keyof ResultEmailCopy | "general", string>> = {};
  let preview: ReturnType<typeof previewResultEmailCopy> | undefined;
  let sampleTooLong = false;
  try {
    const valid = ResultEmailCopySchema.parse(copy);
    // Preview always uses fixed samples; validation additionally catches a real
    // quiz/brand title that would exceed bounds after one-pass substitution.
    resolveResultEmailCopy(valid, { quizTitle, brandName });
    try { preview = previewResultEmailCopy(valid); }
    catch { sampleTooLong = true; }
  } catch (error) {
    if (error instanceof ZodError) for (const issue of error.issues) {
      const field = issue.path[0] as keyof ResultEmailCopy;
      if (field === "subject" || field === "introduction" || field === "signOff") errors[field] ??= issue.message;
      else errors.general ??= issue.message;
    }
    else errors.general = "This copy could not be previewed. Check the fields and try again.";
  }
  const invalid = Object.keys(errors).length > 0;
  const edit = (field: "subject" | "introduction" | "signOff", text: string) => {
    const next = { ...copy, [field]: text };
    onDraftChange(JSON.stringify(next) === JSON.stringify(current) ? null : { baseline: draft?.baseline ?? resultEmailCopyIdentity(value), copy: next });
  };
  const apply = () => {
    if (!draft || stale || invalid) return;
    const valid = ResultEmailCopySchema.parse(copy);
    resolveResultEmailCopy(valid, { quizTitle, brandName });
    onChange(valid); onDraftChange(null);
  };
  return <details className="min-w-0 rounded-xl border border-stone-200 bg-white p-4">
    <summary className="cursor-pointer font-semibold text-stone-900">Result email copy <span className="font-normal text-stone-600">· preview only{draft ? " · unapplied changes" : ""}</span></summary>
    <section aria-label="Result email copy settings" className="mt-5 min-w-0 space-y-5 text-sm text-stone-800">
      <p className="rounded-lg bg-stone-100 p-3 leading-relaxed">Production email sending is unavailable. This editor previews wording only; it does not send email or queue a test.</p>
      {restored && <p role="status" className="rounded-lg bg-blue-50 p-3 text-blue-950">Unapplied copy was recovered in this browser tab. Review it and choose Apply; your quiz has not changed.</p>}
      {storageWarning && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-950">Pending copy could not be backed up or cleared in this tab. Keep this editor open and apply or copy your wording before leaving.</p>}
      <p className="leading-relaxed">Use <code className="break-all">{"{quiz_title}"}</code> and <code className="break-all">{"{brand_name}"}</code> for personalization. The sample uses “Your sample quiz” and “Your brand.” Privacy, expiry and local-test notices stay fixed.</p>
      {([
        ["subject", "Email subject", 120, 1],
        ["introduction", "Email introduction", 1200, 5],
        ["signOff", "Email sign-off (optional)", 160, 2],
      ] as const).map(([field, label, limit, rows]) => <div key={field} className="min-w-0 space-y-2">
        <label htmlFor={`${id}-${field}`} className="block font-semibold">{label}</label>
        {rows === 1 ? <input id={`${id}-${field}`} value={copy[field]} onChange={event => edit(field, event.target.value)} aria-invalid={!!errors[field]} aria-describedby={`${id}-${field}-help${errors[field] ? ` ${id}-${field}-error` : ""}`} className="w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900 focus:outline-2 focus:outline-offset-2 focus:outline-stone-700" />
          : <textarea id={`${id}-${field}`} rows={rows} value={copy[field]} onChange={event => edit(field, event.target.value)} aria-invalid={!!errors[field]} aria-describedby={`${id}-${field}-help${errors[field] ? ` ${id}-${field}-error` : ""}`} className="w-full min-w-0 resize-y rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900 focus:outline-2 focus:outline-offset-2 focus:outline-stone-700" />}
        <p id={`${id}-${field}-help`} className="text-xs text-stone-600">{copy[field].length} / {limit} characters. Plain text only.</p>
        {errors[field] && <p id={`${id}-${field}-error`} className="text-sm text-red-800">{errors[field]}</p>}
      </div>)}
      {errors.general && <p role="alert" className="text-red-800">{errors.general}</p>}
      {stale && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-950">The saved copy changed while you were editing. Your pending text is still here. Reload the current copy before applying new changes.</p>}
      <p role="status" className="text-stone-700">{draft ? "Unapplied changes stay in this browser tab. Review and apply them before publishing; they are not saved to your account yet." : "Applied copy follows normal draft saving. Publish to use it for new responses; existing responses keep their original copy."}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={apply} disabled={!draft || invalid || stale} className="rounded-lg bg-stone-900 px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-600">Apply email copy</button>
        {draft && <button type="button" onClick={() => onDraftChange(null)} className="rounded-lg border border-stone-300 px-4 py-2.5 font-semibold">{stale ? "Reload current copy" : "Discard unapplied changes"}</button>}
        <button type="button" onClick={() => { onChange(undefined); onDraftChange(null); }} className="rounded-lg border border-stone-300 px-4 py-2.5 font-semibold">Apply default copy</button>
      </div>
      <section aria-label="Sample email preview" className="min-w-0 rounded-xl border border-stone-200 bg-stone-50 p-4">
        <h3 className="font-semibold text-stone-900">Sample email · no message will be sent</h3>
        {preview ? <><p className="mt-4 break-words font-semibold">Subject: {preview.subject}</p><div className="mt-4 whitespace-pre-wrap break-words leading-relaxed">{preview.text}</div></> : <p className="mt-3 text-stone-700">{sampleTooLong ? "The fixed sample names make this preview too long. Your actual quiz and brand values fit, so you can apply this copy." : "Correct the fields above to see the sample. Invalid copy has not changed your quiz."}</p>}
      </section>
    </section>
  </details>;
}
