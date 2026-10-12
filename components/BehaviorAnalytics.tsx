"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CLARITY_CONSENT_KEY, clarityLocationAllowed, readClarityConsent, startClarity, stopClarity } from "@/lib/clarity";

export default function BehaviorAnalytics() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");
  useEffect(() => {
    const allowed = process.env.NEXT_PUBLIC_CLARITY_ENABLED !== "false" && clarityLocationAllowed(location.href)
      && !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
    // Browser consent is external state; read it only after hydration.
    const refresh = () => { setEligible(allowed); setVisible(allowed && !readClarityConsent()); if (allowed) startClarity(); else stopClarity(); };
    refresh();
    const sync = (event: StorageEvent) => { if (event.key === CLARITY_CONSENT_KEY || event.key === null) { if (readClarityConsent() !== "granted") stopClarity(); refresh(); } };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [pathname]);
  function choose(value: "granted" | "denied") {
    if (value === "denied") stopClarity();
    try { localStorage.setItem(CLARITY_CONSENT_KEY, JSON.stringify({ value, expires: Date.now() + 180 * 86400000 })); }
    catch { setStorageNotice("Your browser could not save this preference. Recording stays off."); stopClarity(); return; }
    if (value === "granted") startClarity();
    setVisible(false);
  }
  if (!eligible) return null;
  return <aside aria-label="Behavior analytics preferences" data-clarity-mask="true" className="fixed bottom-3 right-3 z-[100] max-w-[calc(100vw-1.5rem)]">
    {visible ? <div className="w-96 max-w-full rounded-2xl border border-stone-300 bg-white p-5 text-slate-900 shadow-xl">
      <h2 className="text-base font-semibold">Help us make Pippi easier</h2>
      <p className="mt-2 text-sm leading-relaxed">Allow Microsoft Clarity to record masked clicks and scrolling in the quiz builder? Your quiz text and form entries are hidden. This is optional and is not used for advertising.</p>
      <a className="mt-2 inline-block text-sm underline" href="/privacy/analytics" target="_blank" rel="noreferrer">How behavior analytics works</a>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => choose("granted")} className="rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold">Allow analytics</button><button type="button" onClick={() => choose("denied")} className="rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold">No thanks</button></div>
      {storageNotice && <p role="status" className="mt-2 text-sm">{storageNotice}</p>}
    </div> : <button type="button" onClick={() => setVisible(true)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm">Analytics preferences</button>}
  </aside>;
}
