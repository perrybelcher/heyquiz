"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import { ArrowDown, ArrowUp, ImageIcon, Plus, Trash2 } from "lucide-react";
import type { CoverPageConfig, FormSchemaType } from "@/lib/schema";
import { landingSectionLimit, validateLanding, type LandingSection } from "@/lib/landing";
import { quizThemeStyle } from "@/lib/theme-style";
import QuizLanding from "./QuizLanding";

const sectionTypes: { type: LandingSection["type"]; label: string }[] = [
  { type: "benefits", label: "What they will discover" },
  { type: "text", label: "Helpful context" },
  { type: "testimonial", label: "Testimonial" },
  { type: "faq", label: "Common question" },
  { type: "video", label: "Introduction video" },
  { type: "start", label: "Start reminder" },
];

export default function LandingPageEditor({ form, onChange, onChooseImage }: {
  form: FormSchemaType;
  onChange: (value: FormSchemaType) => void;
  onChooseImage?: () => void;
}) {
  const [sectionType, setSectionType] = useState<LandingSection["type"]>("benefits");
  const [previewWidth, setPreviewWidth] = useState<"wide" | "phone">("wide");
  const [previewMessage, setPreviewMessage] = useState("");
  const cover: CoverPageConfig = form.coverPage || { enabled: false, title: form.title, subtitle: form.description || "", buttonText: "Get Started", showQuestionCount: true };
  const sections = cover.sections || [];
  const update = (patch: Partial<CoverPageConfig>) => onChange({ ...form, coverPage: { ...cover, ...patch } });
  const updateSection = (id: string, patch: Partial<LandingSection>) => update({ sections: sections.map(section => section.id === id ? { ...section, ...patch } : section) });
  const field = (label: string, value: string, change: (value: string) => void, multiline = false, maxLength = 200) => <label className="block text-sm font-medium">{label}{multiline ? <textarea className="hq-input mt-2 min-h-24 w-full" value={value} maxLength={maxLength} onChange={event => change(event.target.value)}/> : <input className="hq-input mt-2 w-full" value={value} maxLength={maxLength} onChange={event => change(event.target.value)}/>}</label>;
  function addSection() {
    if (sections.length >= landingSectionLimit) return;
    update({ sections: [...sections, { id: `landing-${nanoid(10)}`, type: sectionType, title: "", body: "", url: "", label: sectionType === "start" ? cover.buttonText || "Get Started" : "", items: sectionType === "benefits" ? ["", ""] : [] }] });
  }
  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const reordered = [...sections];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    update({ sections: reordered });
  }
  function removeSection(section: LandingSection) {
    if ([section.title, section.body, section.url, section.label, ...section.items].some(value => value.trim()) && !window.confirm(`Remove “${section.title || sectionTypes.find(choice => choice.type === section.type)?.label}” from the landing page? The published quiz stays unchanged until you publish again.`)) return;
    update({ sections: sections.filter(item => item.id !== section.id) });
  }
  let issue = "";
  try { validateLanding(cover, true); } catch (error) { issue = error instanceof Error ? error.message : "Review the landing page before publishing."; }
  return <section aria-label="Landing page designer" className="space-y-6">
    <div><h2 className="text-xl font-semibold">Earn the first answer.</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">Start with a clear promise. Add only the context people need to feel ready, then let the quiz do the work.</p></div>
    <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={cover.enabled} onChange={event => update({ enabled: event.target.checked })}/>Customize landing page</label>
    {!cover.enabled ? <p className="rounded-xl bg-stone-50 p-4 text-sm text-slate-600">Visitors see a short introduction using your quiz title and description. Your custom landing content stays saved while switched off.</p> : <>
      <fieldset className="space-y-3"><legend className="text-sm font-semibold">Opening layout</legend><div className="grid gap-3 sm:grid-cols-2">{([{ value: "compact", label: "Focused cover", description: "A simple promise with an optional image above it." }, { value: "split", label: "Image beside the promise", description: "A balanced opening that stacks on smaller screens." }] as const).map(layout => <label key={layout.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${cover.layout === layout.value || (!cover.layout && layout.value === "compact") ? "border-red-800 bg-red-50/40" : "border-slate-200"}`}><input type="radio" name={`landing-layout-${form.id}`} value={layout.value} checked={(cover.layout || "compact") === layout.value} onChange={() => update({ layout: layout.value })} className="mt-1"/><span><span className="block text-sm font-semibold">{layout.label}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{layout.description}</span></span></label>)}</div></fieldset>
      {field("Landing headline", cover.title, title => update({ title }), false, 500)}
      {field("Landing introduction", cover.subtitle || "", subtitle => update({ subtitle }), true, 4000)}
      {field("Landing start button", cover.buttonText, buttonText => update({ buttonText }), false, 100)}
      <div className="space-y-3 rounded-xl border p-4">{field("Landing image URL", cover.imageUrl || "", imageUrl => update({ imageUrl }), false, 2000)}{onChooseImage && <button type="button" className="hq-secondary" onClick={onChooseImage}><ImageIcon size={16}/>Choose landing image</button>}{cover.imageUrl && field("Landing image description", cover.imageAlt || "", imageAlt => update({ imageAlt }), false, 300)}{cover.layout === "split" && !cover.imageUrl && <p className="text-xs text-slate-500">Add an image to use the split opening. Without one, the headline uses the full width.</p>}</div>
      <div className="flex flex-wrap items-center gap-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cover.showQuestionCount !== false} onChange={event => update({ showQuestionCount: event.target.checked })}/>Show question count</label><label className="text-sm">Estimated minutes (optional)<input aria-label="Estimated minutes" type="number" min={1} max={1440} className="hq-input mt-2 block w-28" value={cover.estimatedMinutes ?? ""} onChange={event => update({ estimatedMinutes: event.target.value === "" ? undefined : Math.max(1, Math.min(1440, Number(event.target.value) || 1)) })}/></label></div>
      <div className="space-y-4 border-t pt-6"><div><h3 className="font-semibold">Build confidence before they begin</h3><p className="mt-2 text-sm text-slate-600">Optional sections appear below your opening. Keep it brief; a short cover is often enough.</p></div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-medium">New landing section<select aria-label="New landing section" className="hq-input mt-2 w-full" value={sectionType} onChange={event => setSectionType(event.target.value as LandingSection["type"])}>{sectionTypes.map(choice => <option key={choice.type} value={choice.type}>{choice.label}</option>)}</select></label><button type="button" disabled={sections.length >= landingSectionLimit} className="hq-secondary" onClick={addSection}><Plus size={16}/>Add landing section</button></div>
        {sections.map((section, index) => <details key={section.id} open className="rounded-xl border p-4" data-landing-section={section.id}><summary className="cursor-pointer font-semibold">{index + 1}. {section.title || sectionTypes.find(choice => choice.type === section.type)?.label}</summary><div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2"><button type="button" className="hq-secondary" aria-label={`Move landing section ${index + 1} up`} disabled={index === 0} onClick={() => moveSection(index, -1)}><ArrowUp size={15}/></button><button type="button" className="hq-secondary" aria-label={`Move landing section ${index + 1} down`} disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)}><ArrowDown size={15}/></button><button type="button" className="hq-secondary" aria-label={`Remove landing section ${index + 1}`} onClick={() => removeSection(section)}><Trash2 size={15}/><span className="text-xs">Remove</span></button></div>
          {field(section.type === "testimonial" ? "Attribution" : section.type === "faq" ? "Common question" : "Section heading", section.title, title => updateSection(section.id, { title }))}
          {field(section.type === "testimonial" ? "Quote (use with permission)" : section.type === "faq" ? "Helpful answer" : "Section content", section.body, body => updateSection(section.id, { body }), true, 4000)}
          {section.type === "benefits" && <div className="space-y-3">{section.items.map((item, itemIndex) => <div key={itemIndex} className="flex items-end gap-2"><label className="min-w-0 flex-1 text-sm">Benefit {itemIndex + 1}<input className="hq-input mt-1 w-full" value={item} maxLength={240} onChange={event => updateSection(section.id, { items: section.items.map((text, i) => i === itemIndex ? event.target.value : text) })}/></label><button type="button" className="hq-secondary" aria-label={`Remove benefit ${itemIndex + 1}`} onClick={() => updateSection(section.id, { items: section.items.filter((_, i) => i !== itemIndex) })}><Trash2 size={15}/></button></div>)}<button type="button" className="hq-secondary" disabled={section.items.length >= 6} onClick={() => updateSection(section.id, { items: [...section.items, ""] })}><Plus size={15}/>Add benefit</button></div>}
          {section.type === "video" && <>{field("Introduction video URL", section.url, url => updateSection(section.id, { url }), false, 2000)}{field("Video description", section.label, label => updateSection(section.id, { label }))}<p className="text-xs text-slate-500">Use an HTTPS YouTube or Vimeo URL. The video loads only after the visitor selects it.</p></>}
          {section.type === "start" && <>{field("Start reminder button", section.label, label => updateSection(section.id, { label }), false, 100)}<p className="text-xs text-slate-500">Starts this quiz using the same action as the opening button.</p></>}
        </div></details>)}
        <p className="text-xs text-slate-500">{sections.length} of {landingSectionLimit} sections</p>
      </div>
      {issue && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Before publishing: {issue}</p>}
    </>}
    <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Preview landing page</summary><div className="mt-4 space-y-4"><div className="flex flex-wrap items-center gap-2"><button type="button" className="hq-secondary" aria-pressed={previewWidth === "wide"} onClick={() => setPreviewWidth("wide")}>Available width</button><button type="button" className="hq-secondary" aria-pressed={previewWidth === "phone"} onClick={() => setPreviewWidth("phone")}>Phone width</button></div><p className="text-xs text-slate-500">Design preview only. Starting here creates no response.</p>{previewMessage && <p role="status" className="text-sm text-green-800">{previewMessage}</p>}<div className="hq-player mx-auto rounded-xl p-3" style={{ ...quizThemeStyle(form.theme), maxWidth: previewWidth === "phone" ? 390 : "100%" }}><QuizLanding form={form} busy={false} onStart={() => setPreviewMessage("The start action works. Use Save & preview to try the complete quiz.")}/></div></div></details>
  </section>;
}
