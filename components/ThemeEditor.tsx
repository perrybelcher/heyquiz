"use client";
import { useEffect, useRef, useState } from "react";
import { Check, X, ArrowRight } from "lucide-react";
import { BrandLogoUrlSchema, type FormTheme } from "@/lib/schema";
import { brandFonts, quizThemeStyle } from "@/lib/theme-style";

import VisualBrandKitPicker from "./VisualBrandKitPicker";
import MediaPickerModal from "./MediaPickerModal";

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
  const [choosingLogo, setChoosingLogo] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const update = (patch: Partial<FormTheme>) => setDraft(current => ({ ...current, ...patch, id: "custom" }));
  const invalidColor = colorFields.some(([key]) => !/^#[0-9a-f]{6}$/i.test(draft[key] || ""));
  const invalidLogo = !BrandLogoUrlSchema.safeParse(draft.logoUrl || "").success || Boolean(draft.logoUrl && !draft.logoAlt?.trim() && !draft.brandName?.trim());
  const invalid = invalidColor || invalidLogo;
  const style = quizThemeStyle(draft);
  const primary = draft.primaryColor || "#c62121";
  // Button foreground follows the selected fill, including light-on-dark palettes.
  return (
    <dialog ref={dialog} onCancel={event=>{if(choosingLogo){event.preventDefault();setChoosingLogo(false);}else onClose();}} aria-labelledby="theme-editor-title"
      className="m-auto w-[calc(100%-2rem)] max-w-5xl max-h-[90vh] rounded-2xl bg-white text-gray-900 p-0 shadow-2xl backdrop:bg-black/50">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-white px-6 py-5">
        <div><h2 id="theme-editor-title" className="text-xl font-semibold">Make it yours</h2><p className="mt-1 text-sm text-gray-500">Bring your brand to every step of the experience.</p></div>
        <button onClick={onClose} aria-label="Close theme editor" className="rounded-lg p-2 hover:bg-gray-100"><X size={20} /></button>
      </header>
      <div className="grid md:grid-cols-2">
        <div className="space-y-7 p-6">
          <fieldset className="space-y-3"><legend className="mb-3 text-sm font-semibold">Your brand</legend>
            <label className="block text-sm">Brand name<input className="mt-1 w-full rounded-lg border p-2" maxLength={100} value={draft.brandName||""} onChange={e=>update({brandName:e.target.value})} placeholder="Your business or campaign"/></label>
            <label className="block text-sm">Logo image URL<input className="mt-1 w-full rounded-lg border p-2" value={draft.logoUrl||""} onChange={e=>update({logoUrl:e.target.value.trim()})} placeholder="https://…"/></label>
            <div className="flex gap-2"><button type="button" onClick={()=>setChoosingLogo(true)} className="hq-secondary text-xs">Choose or upload logo</button>{draft.logoUrl&&<button type="button" className="hq-secondary text-xs" onClick={()=>update({logoUrl:""})}>Remove logo</button>}</div>
            <label className="block text-sm">Logo description<input className="mt-1 w-full rounded-lg border p-2" maxLength={150} value={draft.logoAlt||""} onChange={e=>update({logoAlt:e.target.value})} placeholder="Your brand name for screen readers"/></label>
            <label className="block text-sm">Logo height: {draft.logoHeight||40}px<input aria-label="Logo height" type="range" min={24} max={80} step={4} value={draft.logoHeight||40} onChange={e=>update({logoHeight:Number(e.target.value)})} className="mt-2 w-full"/></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.hidePippiBranding||false} onChange={e=>update({hidePippiBranding:e.target.checked})}/>Hide Pippi branding</label>
          </fieldset>
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
            <label className="text-sm font-semibold">Font family<select value={draft.font} onChange={e=>update({font:e.target.value as FormTheme["font"],bodyFont:undefined})} className="mt-2 block w-full rounded-lg border border-gray-200 p-2 font-normal"><option value="sans">Modern sans</option><option value="serif">Editorial serif</option><option value="mono">Monospace</option></select></label>
            <label className="text-sm font-semibold">Card corners<select value={draft.borderRadius} onChange={e=>update({borderRadius:e.target.value as FormTheme["borderRadius"]})} className="mt-2 block w-full rounded-lg border border-gray-200 p-2 font-normal"><option value="none">Square</option><option value="md">Soft</option><option value="lg">Rounded</option><option value="full">Extra rounded</option></select></label>
          </div>
          <fieldset className="space-y-3"><legend className="mb-3 text-sm font-semibold">Typography details</legend>
            <div className="grid grid-cols-2 gap-4">{(["bodyFont","headingFont"] as const).map(key=><label key={key} className="text-sm">{key==="bodyFont"?"Body typeface":"Heading typeface"}<select aria-label={key==="bodyFont"?"Body typeface":"Heading typeface"} value={draft[key]||""} onChange={e=>update({[key]:e.target.value||undefined})} className="mt-2 block w-full rounded-lg border p-2"><option value="">Use font family</option>{Object.entries(brandFonts).map(([id,font])=><option key={id} value={id}>{font.label}</option>)}</select></label>)}</div>
            <label className="block text-sm">Body text size: {draft.bodySize||16}px<input aria-label="Body text size" type="range" min={14} max={22} value={draft.bodySize||16} onChange={e=>update({bodySize:Number(e.target.value)})} className="mt-2 w-full"/></label>
            <label className="block text-sm">Heading size: {Math.round((draft.headingScale||1)*100)}%<input aria-label="Heading size" type="range" min={0.8} max={1.5} step={0.05} value={draft.headingScale||1} onChange={e=>update({headingScale:Number(e.target.value)})} className="mt-2 w-full"/></label>
            <p className="text-xs text-gray-500">Device fonts keep quizzes fast. Appearance can vary slightly across operating systems.</p>
          </fieldset>
          <VisualBrandKitPicker theme={draft} onPreview={theme=>setDraft({...presets[0],...theme})} invalid={invalid}/>
        </div>
        <div className="border-t border-gray-200 md:border-t-0 md:border-l p-6" style={style}>
          <div className="sticky top-24"><p className="mb-6 text-xs font-semibold uppercase tracking-widest">Live theme preview</p>
          <div className="mb-6">{draft.logoUrl&&!invalidLogo?<img src={draft.logoUrl} alt={draft.logoAlt||draft.brandName||"Quiz logo"} className="max-w-full object-contain object-left" style={{height:draft.logoHeight||40}}/>:draft.brandName?<p className="text-xl font-semibold" style={{fontFamily:style["--hq-heading-font"]}}>{draft.brandName}</p>:!draft.hidePippiBranding?<img src="/pippi-logo.svg" alt="pippi" className="h-7"/>:null}</div>
          <div className="border border-black/10 p-6 shadow-sm" style={{backgroundColor:draft.cardColor,borderRadius:style["--hq-radius"]}}>
            <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-black/10"><div className="h-full w-1/3" style={{background:primary}} /></div>
            <p className="mb-3 text-xs opacity-70">QUESTION 1 OF 3</p><h3 className="mb-3 font-semibold" style={{fontFamily:style["--hq-heading-font"],fontSize:`${24*(draft.headingScale||1)}px`}}>What matters most to you?</h3><p className="mb-6 opacity-75" style={{fontSize:draft.bodySize||16}}>A thoughtful question. A more personal next step.</p>
            {["Finding the right fit", "Exploring something new"].map((text,i)=><div key={text} className="mb-3 flex items-center gap-3 rounded-lg border p-3 text-sm" style={{borderColor:i===0?primary:"currentColor"}}><span className="grid h-5 w-5 place-items-center rounded-full border" style={{borderColor:primary,color:primary}}>{i===0&&<Check size={14}/>}</span>{text}</div>)}
            <div className="mt-6 inline-flex items-center gap-3 rounded-lg px-5 py-3 text-sm font-semibold" style={{background:primary,color:style["--hq-button-text"]}}>Continue <ArrowRight size={16}/></div>
          </div><p className="mt-4 text-xs opacity-70">Illustrative preview. Your theme is preserved when embedded on another website.</p></div>
        </div>
      </div>
      {choosingLogo&&<MediaPickerModal isOpen onClose={()=>setChoosingLogo(false)} initialUrl={draft.logoUrl} onSelect={url=>{update({logoUrl:url});setChoosingLogo(false);}}/>}
      <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-white px-6 py-4">
        <p className="text-xs text-gray-500">{invalidColor ? "Enter a valid six-digit hex code for each color." : invalidLogo ? "Use a valid image URL and add a logo description or brand name." : "Changes apply when you’re ready."}</p>
        <div className="flex gap-2"><button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={invalid} onClick={()=>onApply(draft)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Apply theme</button></div>
      </footer>
    </dialog>
  );
}
