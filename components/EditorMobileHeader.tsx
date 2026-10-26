"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { Ellipsis, Paintbrush, Pause, Play, X, Zap } from "lucide-react";

type Action = { label: string; onClick: () => void; disabled?: boolean };
type Section = { id: string; label: string; onClick: () => void };
function subscribeMobile(change: () => void) {
  const media = window.matchMedia("(max-width: 1023px)");
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
}
export default function EditorMobileHeader({ title, onTitleChange, status, onSave, saveFailed, published, publicationLabel, onTheme, onPreview, previewing, previewLabel = "Preview", onPublish, onPause, publicationBusy, actions, extra, sections, activeSection, steps = false }: {
  title: string; onTitleChange: (title: string) => void; status: string; onSave: () => void; saveFailed?: boolean;
  published: boolean; publicationLabel: string; onTheme: () => void; onPreview: () => void; previewing?: boolean; previewLabel?: string;
  onPublish: () => void; onPause: () => void; publicationBusy: boolean; actions: Action[]; extra?: ReactNode;
  sections: Section[]; activeSection: string; steps?: boolean;
}) {
  // Mount only the visible toolbar: hidden duplicate inputs must not intercept
  // keyboard shortcuts, accessibility queries or form title editing on desktop.
  const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia("(max-width: 1023px)").matches, () => false);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null), dialog = useRef<HTMLDialogElement>(null), strip = useRef<HTMLElement>(null);
  const id = useId();
  function close(action?: () => void) {
    // Close the native modal synchronously before a command opens another dialog.
    // Returning focus first also gives History/Pause a connected return target.
    dialog.current?.close(); setOpen(false); trigger.current?.focus(); action?.();
  }
  function containTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(control => control.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    // A native modal makes the page inert, but browser chrome can still receive
    // Shift+Tab from its first control. Keep keyboard navigation within tools.
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    element.showModal();
    const desktop = window.matchMedia("(min-width: 1024px)");
    const resized = () => {
      if (!desktop.matches) return;
      element.close(); setOpen(false);
      requestAnimationFrame(() => {
        Array.from(document.querySelectorAll<HTMLElement>('input[aria-label="Quiz name"], .guided-studio input, .guided-studio button, .studio-toolbar button')).find(control => control.getClientRects().length)?.focus();
      });
    };
    desktop.addEventListener("change", resized);
    return () => { desktop.removeEventListener("change", resized); element.close(); };
  }, [open]);
  useEffect(() => {
    const nav = strip.current, current = nav?.querySelector<HTMLElement>('[aria-current]');
    if (!nav || !current) return;
    // Reveal the selected section without scrolling the editor canvas or window.
    const viewport = nav.getBoundingClientRect(), button = current.getBoundingClientRect();
    // Rectangles retain fractional widths. Offset metrics round them and can
    // leave the last label clipped by a pixel; preserve an eight-pixel edge too.
    if (button.left < viewport.left + 8) nav.scrollLeft -= Math.ceil(viewport.left + 8 - button.left);
    else if (button.right > viewport.right - 8) nav.scrollLeft += Math.ceil(button.right - viewport.right + 8);
  }, [activeSection, mobile]);
  if (!mobile) return null;
  return <header data-mobile-editor-header className="shrink-0 border-b border-stone-200 bg-white lg:hidden">
    <div className="flex min-w-0 items-center gap-2 px-3 py-2">
      <div className="min-w-0 flex-1"><input aria-label="Quiz name" className="block h-5 w-full min-w-0 truncate rounded border border-transparent bg-transparent px-1 text-sm font-semibold focus:border-red-800 focus:outline-none" value={title} onChange={event => onTitleChange(event.target.value)}/>
        <p role="status" className="truncate px-1 text-[11px] leading-4 text-slate-500" title={`${status} · ${publicationLabel}`}>{saveFailed ? <button className="text-red-800 underline" onClick={onSave}>{status}</button> : status} · {publicationLabel}</p>
      </div>
      <button ref={trigger} type="button" aria-haspopup="dialog" aria-controls={open ? id : undefined} aria-expanded={open} onClick={() => setOpen(true)} className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-stone-200 px-2 text-xs font-semibold"><Ellipsis size={17} aria-hidden="true"/>More</button>
    </div>
    <div className="flex gap-1.5 px-3 pb-2">
      <button type="button" onClick={onTheme} className="flex min-h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-stone-200 px-2 text-xs font-semibold"><Paintbrush size={14} aria-hidden="true"/>Theme</button>
      <button type="button" disabled={previewing} onClick={onPreview} className="flex min-h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-stone-200 px-2 text-xs font-semibold disabled:opacity-50"><Play size={13} aria-hidden="true"/>{previewing ? "Saving…" : previewLabel}</button>
      <button type="button" data-publication-action="publish" disabled={publicationBusy} onClick={onPublish} className="flex min-h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-stone-900 px-2 text-xs font-semibold text-white disabled:opacity-50"><Zap size={13} aria-hidden="true" className="text-amber-300"/>Publish</button>
      {published && <button type="button" aria-label="Pause publication" disabled={publicationBusy} onClick={onPause} className="flex min-h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-stone-200 px-2 text-xs font-semibold disabled:opacity-50"><Pause size={13} aria-hidden="true"/>Pause</button>}
    </div>
    <div className="relative border-t border-stone-100">
      <nav ref={strip} aria-label={steps ? "Quiz setup steps" : "Quiz workspace"} className="relative flex min-w-0 gap-1 overflow-x-auto overscroll-x-contain px-2 py-1 [scrollbar-width:thin]" title="Scroll for more sections">
        {sections.map(section => <button key={section.id} type="button" aria-current={activeSection === section.id ? steps ? "step" : "page" : undefined} onClick={section.onClick} className={`min-h-8 shrink-0 whitespace-nowrap rounded-md px-3 text-xs font-medium ${activeSection === section.id ? "bg-red-50 text-red-900" : "text-slate-600 hover:bg-stone-50"}`}>{section.label}</button>)}
      </nav>
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-white to-transparent"/>
    </div>
    {open && <dialog ref={dialog} id={id} aria-labelledby={`${id}-title`} onKeyDown={containTab} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close(); } }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto overscroll-contain rounded-2xl border border-stone-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-black/40">
      <div className="flex items-center justify-between gap-3"><h2 id={`${id}-title`} className="text-lg font-semibold">Editor tools</h2><button type="button" aria-label="Close editor tools" onClick={() => close()} className="rounded-lg p-2 hover:bg-stone-100"><X size={20} aria-hidden="true"/></button></div>
      <p className="mt-1 break-words text-xs text-slate-500">{status} · {publicationLabel}</p>
      <div className="mt-4 grid gap-2">{actions.map(action => <button key={action.label} type="button" disabled={action.disabled} onClick={() => close(action.onClick)} className="rounded-xl border border-stone-200 px-4 py-3 text-left text-sm font-medium hover:bg-stone-50 disabled:opacity-50">{action.label}</button>)}</div>
      {extra && <div className="mt-4 space-y-4 border-t border-stone-100 pt-4">{extra}</div>}
    </dialog>}
  </header>;
}
