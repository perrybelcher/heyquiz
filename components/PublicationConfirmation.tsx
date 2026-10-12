"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, Copy, ExternalLink, Share2, X } from "lucide-react";

/** A successful publication is a completed action; this dialog only offers its next steps. */
export default function PublicationConfirmation({ url, hasUnpublishedChanges, onDismiss, onShare }: {
  url: string; hasUnpublishedChanges: boolean; onDismiss: () => void; onShare: () => void;
}) {
  const id = useId(), dialog = useRef<HTMLDialogElement>(null), closeButton = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null);
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const copySequence = useRef(0), mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const element = dialog.current;
    element?.showModal(); closeButton.current?.focus({ preventScroll: true });
    return () => { mounted.current = false; element?.close(); };
  }, []);
  function close(action: () => void) {
    copySequence.current++;
    // Finish native focus restoration before the parent navigates or schedules
    // a visible replacement opener after a responsive header has changed.
    dialog.current?.close(); action();
  }
  function containTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]')).filter(element => element.getClientRects().length);
    if (!controls.length) return;
    event.preventDefault();
    const index = controls.indexOf(document.activeElement as HTMLElement);
    const next = index < 0 ? (event.shiftKey ? controls.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    controls[next].focus();
  }
  async function copy() {
    const sequence = ++copySequence.current, origin = document.activeElement;
    setCopyState("copying");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      if (mounted.current && copySequence.current === sequence) setCopyState("copied");
    } catch {
      if (!mounted.current || copySequence.current !== sequence) return;
      setCopyState("failed");
      // A rejected asynchronous clipboard request must not take focus back from
      // a different control the creator has chosen while it was pending.
      if (document.activeElement === origin || document.activeElement === document.body) { input.current?.focus(); input.current?.select(); }
    }
  }
  return <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onKeyDown={containTab} onCancel={event => { event.preventDefault(); close(onDismiss); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-black/50 sm:p-6">
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-800"><Check size={20} aria-hidden="true"/></span>
      <div className="min-w-0 flex-1"><h2 id={`${id}-title`} className="text-lg font-semibold">Your Quiz is Published!</h2><p id={`${id}-description`} className="mt-2 text-sm leading-relaxed text-slate-600">Copy your quiz link or get the embed code to add it to your website.</p></div>
      <button ref={closeButton} type="button" aria-label="Close publication confirmation" onClick={() => close(onDismiss)} className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-stone-100"><X size={20} aria-hidden="true"/></button>
    </div>
    {hasUnpublishedChanges && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Your draft has unpublished changes. Your link shows the version just published; publish again when your draft is ready.</p>}
    <div className="mt-5"><label htmlFor={`${id}-url`} className="text-sm font-semibold">Quiz public URL</label><div className="mt-2 flex flex-wrap gap-2"><input ref={input} id={`${id}-url`} data-share-url readOnly value={url} className="min-w-0 flex-[1_1_12rem] rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-mono text-slate-800 focus-visible:outline-2 focus-visible:outline-red-800"/><button type="button" disabled={copyState === "copying"} onClick={event => { event.currentTarget.focus(); void copy(); }} className="hq-secondary disabled:opacity-50"><Copy size={16} aria-hidden="true"/>{copyState === "copying" ? "Copying…" : copyState === "copied" ? "Copied!" : "Copy Link"}</button></div></div>
    {copyState === "copied" && <p role="status" className="mt-2 text-sm text-green-800">Quiz link copied.</p>}
    {copyState === "failed" && <p role="alert" className="mt-2 text-sm text-red-800">Your browser could not copy the link. Select the quiz public URL above and copy it manually.</p>}
    <div className="mt-5 flex flex-wrap gap-3"><a href={url} target="_blank" rel="noopener noreferrer" className="hq-secondary"><ExternalLink size={16} aria-hidden="true"/>Open published quiz</a><button type="button" onClick={() => close(onShare)} className="hq-primary"><Share2 size={16} aria-hidden="true"/>Embed &amp; Share</button></div>
    <div className="mt-5 flex justify-end border-t border-stone-200 pt-4"><button type="button" onClick={() => close(onDismiss)} className="hq-secondary">Done</button></div>
  </dialog>;
}
