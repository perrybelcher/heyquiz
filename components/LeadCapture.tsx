"use client";
import { useState } from "react";
import type { CaptureConfig, ContactInput } from "@/lib/contacts";
export default function LeadCapture({ config, busy, error, onSubmit, onSkip }: {
    config: CaptureConfig;
    busy: boolean;
    error: string;
    onSubmit: (value: ContactInput) => void;
    onSkip?: () => void;
}) {
    const [email, setEmail] = useState(""), [name, setName] = useState(""), [phone, setPhone] = useState(""), [consent, setConsent] = useState(false);
    return <form className="hq-question-enter mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-left space-y-5" onSubmit={e => { e.preventDefault(); onSubmit({ email, name, phone, marketingConsent: consent }); }}>
    <h2 className="text-2xl font-semibold">{config.title}</h2><p className="text-slate-600">{config.description}</p>
    {config.name !== "off" && <label className="block">Name {config.name === "optional" && "(optional)"}<input autoComplete="name" className="hq-input w-full" value={name} maxLength={160} required={config.name === "required"} onChange={e => setName(e.target.value)}/></label>}
    <label className="block">Email<input type="email" autoComplete="email" className="hq-input w-full" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)}/></label>
    {config.phone !== "off" && <label className="block">Phone {config.phone === "optional" && "(optional)"}<input type="tel" autoComplete="tel" className="hq-input w-full" maxLength={50} required={config.phone === "required"} value={phone} onChange={e => setPhone(e.target.value)}/></label>}
    {config.marketingEnabled && <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>{config.marketingLabel}<span className="block text-slate-500 mt-1">Optional. Your results do not depend on this choice.</span></span></label>}
    {config.privacyUrl && <a className="text-sm underline" target="_blank" rel="noreferrer" href={config.privacyUrl}>Privacy policy</a>}
    {error && <p role="alert" className="hq-error">{error}</p>}
    <div className="flex gap-3"><button disabled={busy} className="hq-primary" type="submit">{busy ? "Saving…" : config.buttonText}</button>{onSkip && <button type="button" className="hq-secondary" disabled={busy} onClick={onSkip}>Skip for now</button>}</div>
  </form>;
}
