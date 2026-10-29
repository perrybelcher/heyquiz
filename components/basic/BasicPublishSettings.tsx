"use client";

import type { MouseEvent } from "react";
import type { FormSchemaType } from "@/lib/schema";
import type { GuidedChecklistTarget } from "@/lib/guided-checklist";
import { defaultCapture } from "@/lib/contacts";
import BasicLeadCaptureSettings from "../BasicLeadCaptureSettings";

export interface BasicPublishSettingsProps {
  form: FormSchemaType; onChange: (form: FormSchemaType) => void;
  published: boolean; publicationLabel: string; publicationUncertain: boolean;
  hasUnpublishedChanges: boolean; publicationBusy: boolean;
  onSave: () => void; onPreview: () => void;
  onPublish: (event?: MouseEvent<HTMLButtonElement>) => void;
  onShare: () => void; onPause: () => void;
  onFieldRef?: (target: GuidedChecklistTarget, element: HTMLInputElement | HTMLTextAreaElement | null) => void;
}

export default function BasicPublishSettings({ form, onChange, published, publicationLabel, publicationUncertain, hasUnpublishedChanges, publicationBusy, onSave, onPreview, onPublish, onShare, onPause, onFieldRef }: BasicPublishSettingsProps) {
  const capture = form.capture || { ...defaultCapture, marketingEnabled: false };
  return <div className="basic-section">
    <header><h1>Check it. Try it. Share it.</h1><p className="basic-help">Save protects your draft. Preview tests the full journey. Publish updates the version visitors see.</p></header>
    <section className="basic-note" aria-label="Publication state"><h2 role="status">{publicationLabel}</h2><p>{publicationUncertain ? "Publication may have completed. Refresh this editor to check the live version before publishing again." : !published ? "Your public link and embeds open after you publish." : hasUnpublishedChanges ? "Your latest edits are in the draft. Visitors still see the previous published version until you publish again." : "Your draft matches the published version. You can share its link or embed it on your website."}</p></section>
    <BasicLeadCaptureSettings config={capture} onChange={next => onChange({ ...form, capture: next })}>
      <label className="basic-field">Privacy-policy link<input className="hq-input" ref={element => onFieldRef?.({ kind: "capture-privacy" }, element)} value={capture.privacyUrl} onChange={event => onChange({ ...form, capture: { ...capture, privacyUrl: event.target.value } })}/></label>
    </BasicLeadCaptureSettings>
    <section className="basic-section" aria-label="Publish actions"><h2>Try the complete journey</h2><p className="basic-help">Full preview saves your latest draft first. Publishing uses the existing checks and asks you to confirm before the live quiz changes.</p><div className="basic-actions"><button type="button" className="hq-secondary" onClick={onSave}>Save draft</button><button type="button" className="hq-secondary" onClick={onPreview}>Save &amp; preview</button><button type="button" className="hq-primary" data-publication-action="publish" disabled={publicationBusy} onClick={onPublish}>Review &amp; publish</button></div></section>
    {published && <section className="basic-section" aria-label="Sharing and publication controls"><h2>Share your published quiz</h2><div className="basic-actions"><button type="button" className="hq-secondary" onClick={onShare}>Share &amp; embed</button><a href={`/play/${form.id}`} className="hq-secondary" target="_blank" rel="noreferrer">Open published quiz</a><button type="button" className="hq-secondary" disabled={publicationBusy} onClick={onPause}>Pause publication</button></div><p className="basic-help">Pausing closes new public starts. Republishing restores the same URL.</p></section>}
  </div>;
}
