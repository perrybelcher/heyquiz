"use client";
import "./basic/basic-builder.css";

export default function EditorModeSwitch({ basic, onChange }: { basic: boolean; onChange: (basic: boolean) => void }) {
  return <div role="group" aria-label="Editor mode" className="editor-mode-switch">
    {[{ label: "Basic", value: true }, { label: "Advanced", value: false }].map(mode => <button key={mode.label} type="button" aria-pressed={basic === mode.value} onClick={() => onChange(mode.value)}>{mode.label}</button>)}
  </div>;
}
