"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpRight, BarChart3, BookmarkCheck, Check, ExternalLink, Link2, LoaderCircle, X } from "lucide-react";
import "./QuizAccountPrompt.css";

type QuizAccountPromptProps = {
  guest: boolean;
  backedUp: boolean;
  busy: boolean;
  intent: "save" | "publish" | "preview";
  onClose: () => void;
  onRetry: () => void;
};

const guestTitles = {
  save: "Keep your quiz moving.",
  publish: "Let your quiz meet its audience.",
  preview: "See your quiz come to life.",
};
const nextActions = {
  save: "save your draft to your account",
  publish: "save your draft and publish when you’re ready",
  preview: "save your draft and open its preview",
};

/** Account links preserve this editor in its tab; the parent owns saving and opener focus. */
export default function QuizAccountPrompt({ guest, backedUp, busy, intent, onClose, onRetry }: QuizAccountPromptProps) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const primaryLink = useRef<HTMLAnchorElement>(null);
  const [openedAccountTab, setOpenedAccountTab] = useState(false);
  const retryLabel = guest ? "Save to my account" : "Save changes";

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    primaryLink.current?.focus();
    return () => element?.close();
  }, []);

  function dismiss() {
    // Finish native focus restoration before the parent restores a visible opener.
    dialog.current?.close();
    onClose();
  }

  function containTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')).filter(element => element.getClientRects().length);
    if (!controls.length) return;
    event.preventDefault();
    const index = controls.indexOf(document.activeElement as HTMLElement);
    const next = index < 0 ? (event.shiftKey ? controls.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    controls[next].focus();
  }

  return <dialog ref={dialog} className="pippi-account-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onKeyDown={containTab} onCancel={event => { event.preventDefault(); dismiss(); }}>
    <div className="pippi-account-header">
      <button type="button" onClick={dismiss} className="pippi-account-close" aria-label="Close account prompt"><X size={20} aria-hidden="true" /></button>
      <div className="pippi-account-eyebrow"><span className="pippi-account-mark"><BookmarkCheck size={20} aria-hidden="true" /></span>{guest ? "A little next step. A lot more possibility." : "Reconnect to your workspace"}</div>
      <h2 id={`${id}-title`} className="pippi-account-title">{guest ? guestTitles[intent] : "Pick up where you left off."}</h2>
      <p id={`${id}-description`} className="pippi-account-description">{guest ? `Create a free account to ${nextActions[intent]}.` : `Your session needs a quick sign-in. Use the account that owns this quiz to ${nextActions[intent]}.`}</p>
    </div>

    <div className="pippi-account-body">
      {guest && <ul className="pippi-account-benefits" aria-label="Your free account includes">
        <li><BookmarkCheck size={18} aria-hidden="true" /><span>Return to your saved quiz</span></li>
        <li><Link2 size={18} aria-hidden="true" /><span>Publish a link or embed it</span></li>
        <li><BarChart3 size={18} aria-hidden="true" /><span>See submitted answers and results</span></li>
      </ul>}

      <div className="pippi-account-account-actions">
        <a ref={primaryLink} href={guest ? "/signup" : "/login"} target="_blank" rel="noopener noreferrer" onClick={() => setOpenedAccountTab(true)} className="pippi-account-primary">
          {guest ? "Create free account" : "Sign in"}<ArrowUpRight size={18} aria-hidden="true" />
          <span className="pippi-account-sr-only"> (opens in a new tab)</span>
        </a>
        {guest && <p className="pippi-account-sign-in">Already have an account? <a href="/login" target="_blank" rel="noopener noreferrer" onClick={() => setOpenedAccountTab(true)}>Sign in<span className="pippi-account-sr-only"> (opens in a new tab)</span></a></p>}
        {guest && <p className="pippi-account-free"><Check size={14} aria-hidden="true" />All accounts are free. No charges or credit card.</p>}
      </div>

      <section className={`pippi-account-return-step${openedAccountTab ? ` pippi-account-return-step-active` : ""}`} aria-labelledby={`${id}-return`}>
        <div className="pippi-account-return-heading"><ExternalLink size={16} aria-hidden="true" /><h3 id={`${id}-return`}>{openedAccountTab ? "Come back here to finish saving" : "Keep this draft open"}</h3></div>
        <p>{guest ? "Account access opens in a new tab. After any email verification or sign-in, return here and choose" : "Sign-in opens in a new tab. When you’re signed in, return here and choose"} <strong>{retryLabel}</strong>.</p>
        <button type="button" onClick={onRetry} disabled={busy} className="pippi-account-retry">{busy && <LoaderCircle size={16} className="pippi-account-spinner" aria-hidden="true" />}{busy ? "Saving…" : retryLabel}</button>
        <span className="pippi-account-sr-only" role="status">{busy ? "Saving your quiz to your account." : openedAccountTab ? "Return to this draft after signing in, then save to your account." : ""}</span>
      </section>

      <p className={`pippi-account-backup${backedUp ? "" : ` pippi-account-backup-warning`}`} role="status">{backedUp ? "A copy of your draft is saved on this device. It isn’t synced to your account yet." : "A browser backup hasn’t been confirmed. Keep this tab open until your quiz is saved to your account."}</p>
      <button type="button" className="pippi-account-keep-editing" onClick={dismiss}>Keep editing</button>
    </div>
  </dialog>;
}
