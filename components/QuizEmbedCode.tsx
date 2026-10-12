"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Code, Copy, ExternalLink } from "lucide-react";
import { quizEmbedCode, quizPopupCode } from "@/lib/embed";

const subscribe = () => () => {};
export default function QuizEmbedCode({ formId, title }: { formId: string; title: string }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const [mode, setMode] = useState("responsive"), [triggerLabel, setTriggerLabel] = useState("Take the quiz"), [copied, setCopied] = useState(false), [error, setError] = useState("");
  const code = mode === "popup" ? quizPopupCode(origin, formId, title, triggerLabel) : quizEmbedCode(origin, formId, title, mode === "responsive");
  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setError(""); }
    catch { setError("Select the code below and copy it manually. Your browser could not copy automatically."); }
  }
  return <section aria-label="Embed your quiz" className="space-y-4 border-t border-slate-200 pt-6">
    <div><h3 className="flex items-center gap-2 text-lg font-semibold"><Code size={20} aria-hidden="true"/>Embed on your website</h3><p className="mt-2 text-sm text-slate-600">Keep your quiz’s own theme, inline on your page or in a popup opened by your visitor.</p></div>
    <fieldset className="flex flex-wrap gap-4 text-sm"><legend className="sr-only">Embed type</legend>{[{ value: "responsive", label: "Automatic height" }, { value: "fixed", label: "Fixed height (no script)" }, { value: "popup", label: "Click-to-open popup" }].map(option => <label key={option.label} className="flex items-center gap-2"><input type="radio" checked={mode === option.value} onChange={() => { setMode(option.value); setCopied(false); setError(""); }} name={`embed-type-${formId}`} />{option.label}</label>)}</fieldset>
    <p className="text-sm text-slate-600">{mode === "popup" ? "Paste the link, stylesheet and script into your site’s HTML block. The quiz loads when clicked. If the popup cannot open, the link opens the quiz in a new tab." : mode === "responsive" ? "Paste both the iframe and script into your site’s HTML block. If scripts are blocked, the quiz stays usable in a 700px scrollable frame." : "Use this when your site does not allow scripts. Visitors can scroll inside the 700px frame; you can edit its height in the code."}</p>
    {mode === "popup" && <label className="block text-sm font-medium text-slate-700">Popup button text<input className="hq-input mt-2 w-full" value={triggerLabel} maxLength={80} onChange={event => { setTriggerLabel(event.target.value); setCopied(false); setError(""); }} /><span className="mt-2 block text-xs font-normal text-slate-600">Click to open only. Opening the quiz does not allow external tracking; visitors keep their own tracking choice.</span></label>}
    <textarea aria-label="Quiz embed code" readOnly value={code} rows={7} className="hq-input w-full font-mono text-xs" spellCheck={false} onFocus={event => event.target.select()} />
    <div className="flex flex-wrap items-center gap-4"><button type="button" className="hq-primary" disabled={!code} onClick={() => void copy()}>{copied ? <Check size={16} aria-hidden="true"/> : <Copy size={16} aria-hidden="true"/>}{copied ? "Copied embed code" : "Copy embed code"}</button>{origin && <a className="inline-flex items-center gap-2 text-sm underline" href={`${origin}/play/${encodeURIComponent(formId)}`} target="_blank" rel="noreferrer">Open quiz <ExternalLink size={15} aria-hidden="true"/></a>}</div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
