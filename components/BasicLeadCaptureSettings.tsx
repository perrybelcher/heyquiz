"use client";

import type { ReactNode } from "react";
import type { CaptureConfig } from "@/lib/contacts";
import LeadCapture from "./LeadCapture";

export default function BasicLeadCaptureSettings({ config, onChange, children, showPreview = true }: {
  config: CaptureConfig;
  onChange: (config: CaptureConfig) => void;
  children?: ReactNode;
  showPreview?: boolean;
}) {
  const update = (patch: Partial<CaptureConfig>) => onChange({ ...config, ...patch });
  return <section aria-labelledby="basic-lead-capture-title" className={`grid min-w-0 gap-6 rounded-xl border border-stone-200 bg-white p-4 sm:p-5 ${showPreview ? "xl:grid-cols-2" : ""}`}>
    <div className="min-w-0 space-y-4"><div><h2 id="basic-lead-capture-title" tabIndex={-1} className="scroll-mt-24 text-lg font-semibold">Lead capture</h2><p className="mt-1 text-sm text-slate-600">This setting applies to this quiz. Collected contacts appear in your quiz results and the overall Contacts page.</p><p className="mt-2 text-sm text-slate-600">Publish your changes to update the live quiz.</p></div>
    <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={config.enabled} onChange={event => update({ enabled: event.target.checked })} />Collect contact details</label>
    {config.enabled && <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">When to ask<select className="hq-input mt-2 w-full" value={config.placement} onChange={event => {
          const placement = event.target.value as CaptureConfig["placement"];
          update({ placement, required: false, buttonText: config.buttonText === "See my results" || config.buttonText === "Save my details" ? placement === "after_results" ? "Save my details" : "See my results" : config.buttonText });
        }}><option value="before_results">Before showing results</option><option value="after_results">After showing results</option></select></label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={config.required} disabled={config.placement === "after_results"} onChange={event => update({ required: event.target.checked })} />Require contact details to see results</label>
      </div>
      <p className="text-xs text-slate-500">{config.placement === "after_results" ? "Visitors see their results first. Sharing details is optional." : config.required ? "Visitors must share their details before seeing results. Marketing consent stays optional." : "Visitors can skip the contact form and still see results."}</p>
      <div className="grid gap-4 sm:grid-cols-2">{(["name", "phone"] as const).map(key => <label key={key} className="block text-sm font-medium">{key === "name" ? "Name field" : "Phone field"}<select className="hq-input mt-2 w-full" value={config[key]} onChange={event => update({ [key]: event.target.value as CaptureConfig["name"] })}><option value="off">Do not ask</option><option value="optional">Optional</option><option value="required">Required when sharing details</option></select></label>)}</div>
      <p className="text-xs text-slate-500">Email is required when visitors choose to share their details. Name and phone requirements apply only when they submit this form.</p>
      <label className="block text-sm font-medium">Contact heading<input className="hq-input mt-2 w-full" maxLength={160} value={config.title} onChange={event => update({ title: event.target.value })} /></label>
      <label className="block text-sm font-medium">Contact description<textarea className="hq-input mt-2 w-full" maxLength={1000} value={config.description} onChange={event => update({ description: event.target.value })} /></label>
      <label className="block text-sm font-medium">Contact button label<input className="hq-input mt-2 w-full" maxLength={80} value={config.buttonText} onChange={event => update({ buttonText: event.target.value })} /></label>
      {children}
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={config.marketingEnabled} onChange={event => update({ marketingEnabled: event.target.checked })} />Offer a separate, optional marketing opt-in</label>
      {config.marketingEnabled && <label className="block text-sm font-medium">Marketing consent wording<input className="hq-input mt-2 w-full" maxLength={500} value={config.marketingLabel} onChange={event => update({ marketingLabel: event.target.value })} /></label>}
      <p className="text-xs text-slate-500">Marketing consent starts unchecked. Declining it never blocks results. Connect optional lead delivery in Advanced mode under Connect.</p>
    </>}
    </div>
    {showPreview && <LeadCapturePreview config={config} />}
  </section>;
}

export function LeadCapturePreview({ config }: { config: CaptureConfig }) {
  if (!config.enabled) return <p className="self-start rounded-xl bg-stone-50 p-4 text-sm text-slate-600">Turn on collection to choose your fields and preview the contact form. No external connection is needed.</p>;
  return <aside aria-label="Contact form preview" className="min-w-0 self-start rounded-xl bg-stone-50 p-4"><h3 className="text-sm font-semibold">Preview contact form</h3><p className="my-3 text-xs text-slate-500">Preview only. These fields are disabled and no contact details are collected.</p><fieldset disabled className="min-w-0"><legend className="sr-only">Contact form preview</legend><LeadCapture key={`${config.placement}-${config.marketingEnabled}`} config={{ ...config, privacyUrl: /^https?:\/\//i.test(config.privacyUrl) ? config.privacyUrl : "" }} busy={false} error="" onSubmit={() => {}} onSkip={config.required ? undefined : () => {}} /></fieldset></aside>;
}
