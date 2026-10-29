"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FileText, Grid2X2, Image, Info, Plus, Search, SlidersHorizontal, Users, X, type LucideIcon } from "lucide-react";
import type { QuestionType } from "@/lib/schema";

export interface V2PaletteSection { category: string; items: { type: QuestionType; label: string; icon: LucideIcon }[] }
const categories = [{ name: "Questions", icon: FileText }, { name: "Contact fields", icon: Users }, { name: "Content & media", icon: Image }, { name: "Layout", icon: Grid2X2 }, { name: "Advanced", icon: SlidersHorizontal }] as const;
type Category = typeof categories[number]["name"];
const contacts = new Set(["email", "phone", "full_name", "address", "website"]);
const content = new Set(["image_display", "video_embed", "rich_text", "accordion", "file_upload", "image_upload", "audio_recorder"]);
const layout = new Set(["heading", "subheading", "banner", "divider"]);
const advanced = new Set(["calculation", "hidden", "captcha", "password"]);
function categoryFor(type: string): Category { return contacts.has(type) ? "Contact fields" : content.has(type) ? "Content & media" : layout.has(type) ? "Layout" : advanced.has(type) ? "Advanced" : "Questions"; }
const descriptions: Record<string, string> = { multiple_choice: "Choose one answer", multiselect: "Choose several answers", picture_choice: "Answer with images", short_answer: "Collect a brief response", paragraph: "Collect a detailed response", dropdown: "Choose from a list", rating: "Rate on a scale", email: "Collect an email address", phone: "Collect a phone number", heading: "Introduce a section", divider: "Separate your content", calculation: "Calculate a value", hidden: "Capture a URL parameter" };
const commonQuestions: string[] = ["multiple_choice", "multiselect", "picture_choice", "short_answer", "paragraph", "dropdown", "rating", "switch"];

export default function V2ElementPicker({ sections, location, onSelect, onClose }: { sections: V2PaletteSection[]; location: string; onSelect: (type: QuestionType) => void; onClose: () => void }) {
  const id = useId(), dialog = useRef<HTMLDialogElement>(null), search = useRef<HTMLInputElement>(null), selected = useRef(false);
  const [query, setQuery] = useState(""), [category, setCategory] = useState<Category>("Questions");
  const items = useMemo(() => sections.flatMap(section => section.items).filter((item, i, all) => all.findIndex(other => other.type === item.type) === i).sort((left, right) => {
    const a = commonQuestions.indexOf(left.type), b = commonQuestions.indexOf(right.type);
    return (a < 0 ? commonQuestions.length : a) - (b < 0 ? commonQuestions.length : b);
  }), [sections]);
  const filtered = items.filter(item => query.trim() ? `${item.label} ${item.type} ${descriptions[item.type] || ""}`.toLowerCase().includes(query.trim().toLowerCase()) : categoryFor(item.type) === category);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal(); search.current?.focus();
    return () => { element?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  function choose(type: QuestionType) { if (selected.current) return; selected.current = true; onSelect(type); }
  return <dialog ref={dialog} className="v2-element-picker" aria-labelledby={`${id}-title`} aria-describedby={`${id}-location`} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }}>
    <header><div><h2 id={`${id}-title`}>Add element</h2><p id={`${id}-location`}>{location}</p></div><button type="button" className="v2-editor-icon" aria-label="Close element library" onClick={onClose}><X size={20} /></button></header>
    <label className="v2-element-search"><Search size={19} /><input ref={search} aria-label="Search elements" placeholder="Search elements…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); dialog.current?.querySelector<HTMLButtonElement>("[data-element-option]")?.focus(); } }} /></label>
    <div className="v2-element-browser">
      <nav aria-label="Element categories">{categories.map(({ name, icon: Icon }) => <button key={name} type="button" aria-pressed={category === name && !query} onClick={() => { setCategory(name); setQuery(""); }}><Icon size={19} />{name}</button>)}</nav>
      <div className="v2-element-results" aria-label="Available elements" onKeyDown={event => {
        if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-element-option]"));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (index < 0) return;
        event.preventDefault(); const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
        buttons[(index + delta + buttons.length) % buttons.length]?.focus();
      }}>
        {filtered.map(({ type, label, icon: Icon }) => <button type="button" key={type} data-element-option={type} className="v2-element-option" onClick={() => choose(type)}><span className="v2-element-icon"><Icon size={21} /></span><span><strong>{label}</strong><small>{descriptions[type] || `Add ${label.toLowerCase()}`}</small></span><Plus size={17} className="v2-element-add" /></button>)}
        {!filtered.length && <p className="v2-element-empty" role="status">No elements found. Try another search.</p>}
      </div>
    </div>
    <footer><span><Info size={16} />Choose an element to add it here. You can reorder it later.</span><span><kbd>↑ ↓</kbd> Navigate <kbd>Enter</kbd> Add <kbd>Esc</kbd> Close</span></footer>
  </dialog>;
}
