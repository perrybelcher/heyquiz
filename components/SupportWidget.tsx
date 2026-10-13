"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Minus, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
const SupportChat = dynamic(() => import("./SupportChat"), { loading: () => <p role="status" className="p-4 text-sm text-slate-600">Opening support…</p> });
const subscribe=()=>()=>{};
export default function SupportWidget() {
  const path=usePathname();
  const topLevel=useSyncExternalStore(subscribe,()=>window.self===window.top && new URLSearchParams(window.location.search).get("embed")!=="1",()=>false);
  const [open,setOpen]=useState(false);
  const [initialized,setInitialized]=useState(false);
  const launcher=useRef<HTMLButtonElement>(null);
  const panel=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(open)panel.current?.focus();},[open]);
  useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);launcher.current?.focus();}};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close);},[open]);
  // Respondent experiences belong to the quiz creator; do not add Pippi support
  // to their public player, experiment, private result or embedded website.
  if(!topLevel || /^\/(play|experiment|result)(\/|$)/.test(path))return null;
  function close(){setOpen(false);launcher.current?.focus();}
  return <aside data-clarity-mask="true" aria-label="Pippi support" className="fixed bottom-4 right-4 z-[120] max-w-[calc(100vw-2rem)] print:hidden">
    {initialized && <div hidden={!open} ref={panel} tabIndex={-1} role="dialog" aria-modal="false" aria-labelledby="pippi-support-title" className="mb-3 flex max-h-[calc(100dvh-6rem)] w-[390px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_20px_80px_-20px_rgba(40,15,20,.35)] outline-none">
      <header className="flex shrink-0 items-center gap-3 bg-[#681d27] p-4 text-white"><div className="rounded-xl bg-white/15 p-2"><Sparkles size={20} aria-hidden="true"/></div><div className="flex-1"><h2 id="pippi-support-title" className="text-base font-semibold">Pippi support</h2><p className="mt-0.5 text-xs text-rose-100">Your AI product guide</p></div><button onClick={close} aria-label="Minimize support chat" className="rounded-lg p-2 hover:bg-white/15"><Minus size={20}/></button></header>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-4"><SupportChat/></div>
    </div>}
    <button ref={launcher} onClick={()=>{if(open)close();else{setInitialized(true);setOpen(true);}}} aria-expanded={open} aria-label={open?"Close Pippi support":"Open Pippi support"} className="ml-auto flex min-h-12 items-center gap-2 rounded-full bg-[#681d27] px-4 py-3 text-sm font-semibold text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-800"><MessageCircle size={20} aria-hidden="true"/><span>Ask Pippi</span></button>
  </aside>;
}
