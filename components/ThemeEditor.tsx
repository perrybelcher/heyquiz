"use client";
import { useEffect, useRef, useState } from "react";
import { Check, X, ArrowRight } from "lucide-react";
import type { FormTheme } from "@/lib/schema";
import { quizThemeStyle } from "@/lib/theme-style";

const presets = [
  { name: "Pippi", primaryColor: "#c62121", backgroundColor: "#faf9f6", cardColor: "#ffffff", textColor: "#242629" },
  { name: "Ocean", primaryColor: "#2563eb", backgroundColor: "#eff6ff", cardColor: "#ffffff", textColor: "#172554" },
  { name: "Forest", primaryColor: "#047857", backgroundColor: "#ecfdf5", cardColor: "#ffffff", textColor: "#163b30" },
  { name: "Lavender", primaryColor: "#7c3aed", backgroundColor: "#f5f3ff", cardColor: "#ffffff", textColor: "#302044" },
  { name: "Clay", primaryColor: "#a44730", backgroundColor: "#f6ede4", cardColor: "#fffaf4", textColor: "#45332a" },
  { name: "Rose", primaryColor: "#be185d", backgroundColor: "#fff1f2", cardColor: "#ffffff", textColor: "#4c1932" },
  { name: "Slate", primaryColor: "#334155", backgroundColor: "#f1f5f9", cardColor: "#ffffff", textColor: "#0f172a" },
  { name: "Midnight", primaryColor: "#a5b4fc", backgroundColor: "#111827", cardColor: "#1f2937", textColor: "#f9fafb" },
];
const colorFields = [
  ["primaryColor", "Buttons & highlights"], ["backgroundColor", "Page background"],
  ["cardColor", "Question cards"], ["textColor", "Text"],
] as const;

export default function ThemeEditor({ theme, onApply, onClose }: {
  theme: FormTheme; onApply: (theme: FormTheme) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<FormTheme>({ ...presets[0], font: "sans", borderRadius: "lg", ...theme });
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const update = (patch: Partial<FormTheme>) => setDraft(current => ({ ...current, ...patch, id: "custom" }));
  const invalid = colorFields.some(([key]) => !/^#[0-9a-f]{6}$/i.test(draft[key] || ""));
  const style = quizThemeStyle(draft);
  const primary = draft.primaryColor || "#c62121";
  // Button foreground follows the selected fill, including light-on-dark palettes.
  return (
    <dialog ref={dialog} onCancel={onClose} aria-labelledby="theme-editor-title"
      className="m-auto w-[calc(100%-2rem)] max-w-5xl max-h-[90vh] rounded-2xl bg-white text-gray-900 p-0 shadow-2xl backdrop:bg-black/50">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-white px-6 py-5">
        <div><h2 id="theme-editor-title" className="text-xl font-semibold">Make it yours</h2><p className="mt-1 text-sm text-gray-500">Start with a palette. Customize every color.</p></div>
        <button onClick={onClose} aria-label="Close theme editor" className="rounded-lg p-2 hover:bg-gray-100"><X size={20} /></button>
      </header>
      <div className="grid md:grid-cols-2">
        <div className="space-y-7 p-6">
          <fieldset><legend className="mb-3 text-sm font-semibold">Starting palettes</legend>
            <div className="grid grid-cols-4 gap-2">{presets.map(p => <button key={p.name} onClick={() => update(p)} className="rounded-xl border border-gray-200 p-2 text-left hover:border-gray-500">
              <span className="mb-2 flex h-7 overflow-hidden rounded-md">{[p.primaryColor,p.backgroundColor,p.cardColor,p.textColor].map((color,i)=><span key={i} className="flex-1" style={{background:color}} />)}</span><span className="text-xs">{p.name}</span>
            </button>)}</div>
          </fieldset>
          <fieldset><legend className="mb-3 text-sm font-semibold">Your colors</legend><div className="space-y-3">{colorFields.map(([key,label]) => <div key={key} className="flex items-center justify-between gap-3">
            <label htmlFor={`theme-${key}`} className="text-sm">{label}</label>
            <div className="flex items-center gap-2"><input aria-label={`${label} color picker`} type="color" value={/^#[0-9a-f]{6}$/i.test(draft[key] || "") ? draft[key] : "#ffffff"} onChange={e=>update({[key]:e.target.value})} className="h-9 w-10 cursor-pointer rounded border border-gray-200 p-1" />
              <input id={`theme-${key}`} value={draft[key]} maxLength={7} spellCheck={false} onChange={e=>update({[key]:e.target.value})} className="w-24 rounded-lg border border-gray-200 px-2 py-2 font-mono text-sm" /></div>
          </div>)}</div><p className="mt-2 text-xs text-gray-500">Pick a color or enter its six-digit hex code.</p></fieldset>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm font-semibold">Font family<select value={draft.font} onChange={e=>update({font:e.target.value as FormTheme["font"]})} className="mt-2 block w-full rounded-lg border border-gray-200 p-2 font-normal"><option value="sans">Modern sans</option><option value="serif">Editorial serif</option><option value="mono">Monospace</option></select></label>
            <label className="text-sm font-semibold">Card corners<select value={draft.borderRadius} onChange={e=>update({borderRadius:e.target.value as FormTheme["borderRadius"]})} className="mt-2 block w-full rounded-lg border border-gray-200 p-2 font-normal"><option value="none">Square</option><option value="md">Soft</option><option value="lg">Rounded</option><option value="full">Extra rounded</option></select></label>
          </div>
        </div>
        <div className="border-t border-gray-200 md:border-t-0 md:border-l p-6" style={style}>
          <p className="mb-6 text-xs font-semibold uppercase tracking-widest">Live theme preview</p>
          <div className="border border-black/10 p-6 shadow-sm" style={{backgroundColor:draft.cardColor,borderRadius:style["--hq-radius"]}}>
            <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-black/10"><div className="h-full w-1/3" style={{background:primary}} /></div>
            <p className="mb-3 text-xs opacity-70">QUESTION 1 OF 3</p><h3 className="mb-3 text-2xl font-semibold">What matters most to you?</h3><p className="mb-6 text-sm opacity-75">A thoughtful question. A more personal next step.</p>
            {["Finding the right fit", "Exploring something new"].map((text,i)=><div key={text} className="mb-3 flex items-center gap-3 rounded-lg border p-3 text-sm" style={{borderColor:i===0?primary:"currentColor"}}><span className="grid h-5 w-5 place-items-center rounded-full border" style={{borderColor:primary,color:primary}}>{i===0&&<Check size={14}/>}</span>{text}</div>)}
            <div className="mt-6 inline-flex items-center gap-3 rounded-lg px-5 py-3 text-sm font-semibold" style={{background:primary,color:style["--hq-button-text"]}}>Continue <ArrowRight size={16}/></div>
          </div><p className="mt-4 text-xs opacity-70">Illustrative preview. Your theme is preserved when embedded on another website.</p>
        </div>
      </div>
      <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-white px-6 py-4">
        <p className="text-xs text-gray-500">{invalid ? "Enter a valid six-digit hex code for each color." : "Changes apply when you’re ready."}</p>
        <div className="flex gap-2"><button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={invalid} onClick={()=>onApply(draft)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Apply theme</button></div>
      </footer>
    </dialog>
  );
}
