"use client";
import { useEffect, useState } from "react";
import { X, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import { CLARITY_CONSENT_KEY, clarityLocationAllowed, readClarityConsent, startClarity, stopClarity } from "@/lib/clarity";

export default function BehaviorAnalytics() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [consent, setConsent] = useState<"granted" | "denied" | null>(null);
  const [storageNotice, setStorageNotice] = useState("");
  useEffect(() => {
    const allowed = process.env.NEXT_PUBLIC_CLARITY_ENABLED !== "false" && clarityLocationAllowed(location.href)
      && !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
    // Browser consent is external state; read it only after hydration.
    const refresh = () => { setEligible(allowed); setConsent(readClarityConsent()); setVisible(allowed && !readClarityConsent()); if (allowed) startClarity(); else stopClarity(); };
    refresh();
    const sync = (event: StorageEvent) => { if (event.key === CLARITY_CONSENT_KEY || event.key === null) { if (readClarityConsent() !== "granted") stopClarity(); refresh(); } };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [pathname]);
  function choose(value: "granted" | "denied") {
    setStorageNotice("");
    if (value === "denied") stopClarity();
    try { localStorage.setItem(CLARITY_CONSENT_KEY, JSON.stringify({ value, expires: Date.now() + 180 * 86400000 })); }
    catch { setStorageNotice("Your browser could not save this preference. Recording stays off."); stopClarity(); return; }
    if (value === "granted") startClarity();
    setConsent(value);
    setVisible(false);
  }
  if (!eligible) return null;
  return <aside aria-label="Behavior analytics preferences" data-clarity-mask="true" className="fixed bottom-3 right-3 z-[100] max-w-[calc(100vw-1.5rem)]">
    {visible ? <div className="w-96 max-w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 text-slate-900 shadow-[0_12px_48px_-12px_rgba(15,23,42,0.22)]">
      <div className="flex items-start gap-3"><ShieldCheck size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-[#922c3b]" /><h2 className="flex-1 text-base font-semibold">Help us make Pippi easier</h2>{consent && <button type="button" aria-label="Close analytics preferences" onClick={() => setVisible(false)} className="-m-2 rounded-lg p-2 text-slate-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-[#922c3b]"><X size={20} aria-hidden="true" /></button>}</div>
      {consent && <p className="mt-2 text-xs font-medium text-slate-600">Saved preference: analytics {consent === "granted" ? "allowed" : "off"}. You can change this anytime.</p>}
      <p className="mt-2 text-sm leading-relaxed">Allow Microsoft Clarity to record masked clicks and scrolling in the quiz builder? Your quiz text and form entries are hidden. This is optional and is not used for advertising.</p>
      <a className="mt-2 inline-block text-sm underline" href="/privacy/analytics" target="_blank" rel="noreferrer">How behavior analytics works</a>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => choose("granted")} className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#922c3b]">Allow analytics</button><button type="button" onClick={() => choose("denied")} className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#922c3b]">No thanks</button></div>
      {storageNotice && <p role="status" className="mt-2 text-sm">{storageNotice}</p>}
    </div> : <button type="button" onClick={() => setVisible(true)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm">Analytics preferences</button>}
  </aside>;
}
