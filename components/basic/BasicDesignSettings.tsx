"use client";

import type { FormSchemaType, FormTheme } from "@/lib/schema";
import { brandFonts } from "@/lib/theme-style";
import VisualBrandKitPicker from "../VisualBrandKitPicker";

export default function BasicDesignSettings({ form, onChange, onTheme }: {
  form: FormSchemaType; onChange: (form: FormSchemaType) => void; onTheme: () => void;
}) {
  const update = (patch: Partial<FormTheme>) => onChange({ ...form, theme: { ...form.theme, ...patch, id: "custom" } });
  return <div className="basic-section">
    <header><h1>Make it feel like your brand</h1><p className="basic-help">Your quiz appearance updates in the visitor preview. Publish when you want visitors to see these changes.</p></header>
    <section className="basic-section" aria-label="Quiz appearance">
      <h2>Quiz appearance</h2>
      <VisualBrandKitPicker applyImmediately theme={form.theme} onPreview={theme => onChange({ ...form, theme })} invalid={false}/>
      <div className="basic-field-grid">{([["primaryColor", "Buttons and highlights"], ["backgroundColor", "Page background"], ["cardColor", "Question cards"], ["textColor", "Text"]] as const).map(([key, label]) => <label className="basic-field" key={key}>{label}<input type="color" aria-label={label} value={form.theme[key]} onChange={event => update({ [key]: event.target.value })}/></label>)}</div>
      <div className="basic-field-grid">{(["bodyFont", "headingFont"] as const).map(key => <label className="basic-field" key={key}>{key === "bodyFont" ? "Body typeface" : "Heading typeface"}<select className="hq-input" value={form.theme[key] || ""} onChange={event => update({ [key]: event.target.value || undefined })}><option value="">Use font family</option>{Object.entries(brandFonts).map(([id, font]) => <option key={id} value={id}>{font.label}</option>)}</select></label>)}</div>
      <label className="basic-field">Card corners<select className="hq-input" value={form.theme.borderRadius || "lg"} onChange={event => update({ borderRadius: event.target.value as FormTheme["borderRadius"] })}><option value="none">Square</option><option value="md">Soft</option><option value="lg">Rounded</option><option value="full">Extra rounded</option></select></label>
      <button type="button" className="hq-secondary" onClick={onTheme}>Logo, imagery and full theme settings</button>
      <p className="basic-help">Open full theme settings for your brand name, logo upload, logo size, typography sizes and branding preferences.</p>
    </section>
    <section className="basic-note" aria-label="PDF and report design"><h2>PDF and report design</h2><p>Quiz appearance is separate from PDF and report styling. Existing report settings remain active and can be edited in Advanced.</p></section>
  </div>;
}
