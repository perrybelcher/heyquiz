"use client";

export default function EditorModeSwitch({ basic, onChange }: { basic: boolean; onChange: (basic: boolean) => void }) {
  return <div role="group" aria-label="Editor mode" className="inline-flex shrink-0 rounded-lg border border-stone-300 bg-stone-100 p-1">
    {[{ label: "Basic", value: true }, { label: "Advanced", value: false }].map(mode => <button key={mode.label} type="button" aria-pressed={basic === mode.value} onClick={() => onChange(mode.value)} className={`min-h-11 rounded-md px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800 ${basic === mode.value ? "bg-white text-red-900 shadow-sm" : "text-stone-600 hover:bg-white"}`}>{mode.label}</button>)}
  </div>;
}
