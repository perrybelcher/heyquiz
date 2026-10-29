"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Monitor, Sparkles } from "lucide-react";
import { switchWorkspaceInterface } from "@/lib/workspace-navigation";
import { reportInterfaceEvent } from "@/lib/interface-telemetry";

type Preference = { preferredVersion: "v1" | "v2" | null; effectiveVersion: "v1" | "v2"; eligible: boolean; revision: number };
function validPreference(value: unknown): value is Preference {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<Preference>;
  return (data.preferredVersion === null || data.preferredVersion === "v1" || data.preferredVersion === "v2") && (data.effectiveVersion === "v1" || data.effectiveVersion === "v2") && typeof data.eligible === "boolean" && Number.isSafeInteger(data.revision) && Number(data.revision) >= 0;
}
async function readPreference(): Promise<Preference> {
  const response = await fetch("/api/profile/interface", { cache: "no-store" });
  const data: unknown = await response.json();
  if (!response.ok || !validPreference(data)) throw new Error("Could not load your interface preference. Please retry.");
  return data;
}

export default function InterfacePreference({ accountKey, disabled = false }: { accountKey?: string; disabled?: boolean }) {
  const [preference, setPreference] = useState<Preference | null>(null);
  const [selected, setSelected] = useState<"v1" | "v2">("v1");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  const saving = useRef(false);
  async function load() {
    try {
      const data = await readPreference();
      if (active.current) { setPreference(data); setSelected(data.effectiveVersion); }
    } catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : "Could not load your interface preference."); }
    finally { if (active.current) setLoading(false); }
  }
  useEffect(() => {
    active.current = true;
    let disposed = false;
    void readPreference().then(data => {
      if (!disposed) { setPreference(data); setSelected(data.effectiveVersion); setLoading(false); }
    }, cause => { if (!disposed) { setError(cause instanceof Error ? cause.message : "Could not load your interface preference."); setLoading(false); } });
    return () => { disposed = true; active.current = false; };
  }, [accountKey]);
  async function change() {
    if (!preference || disabled || saving.current || !accountKey || selected === "v2" && !preference.eligible) return;
    saving.current = true; setBusy(true); setError("");
    try {
      const changed = await switchWorkspaceInterface(async () => {
        const response = await fetch("/api/profile/interface", { method: "PATCH", cache: "no-store", headers: { "Content-Type": "application/json", "X-Pippi-Account": accountKey }, body: JSON.stringify({ preferredVersion: selected, revision: preference.revision }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Your interface preference could not be saved. Please retry.");
        if (!validPreference(data) || data.preferredVersion !== selected) throw new Error("Your interface preference could not be confirmed. Reload the preference before retrying.");
        if (preference.effectiveVersion === "v2" && selected === "v1") reportInterfaceEvent("switch_to_classic", preference.effectiveVersion);
        setPreference(data);
        return true;
      }, "/profile");
      if (!changed) setError("The interface was not switched. Finish your current changes, then try again.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not switch interfaces."); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section className="interface-preference rounded-2xl border border-[#e4e5de] bg-white p-5 sm:p-7" aria-labelledby="interface-preference-title">
    <h2 id="interface-preference-title" className="text-lg font-semibold">Interface</h2>
    <p className="mt-2 text-sm text-slate-500">Choose how your workspace looks. Your quizzes and published links stay the same.</p>
    {loading && <p role="status" className="mt-4 text-sm text-slate-500">Loading interface preference…</p>}
    {preference && <>
      <fieldset className="mt-5 grid gap-3 sm:grid-cols-2" disabled={loading || busy || disabled || !accountKey}>
        <legend className="sr-only">Workspace interface</legend>
        {(["v1", "v2"] as const).map(version => <label key={version} className={`interface-choice relative flex cursor-pointer gap-3 rounded-xl border p-4 ${selected === version ? "border-[#862d3d] bg-[#faf3f4]" : "border-stone-200"} ${version === "v2" && !preference.eligible ? "cursor-not-allowed opacity-60" : ""}`}>
          <input type="radio" name="workspace-interface" value={version} checked={selected === version} disabled={version === "v2" && !preference.eligible} onChange={() => setSelected(version)} className="mt-1 accent-[#862d3d]" />
          <span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-semibold text-sm">{version === "v1" ? <Monitor size={16} /> : <Sparkles size={16} />}{version === "v1" ? "Classic" : "New interface"}{version === "v2" && <span className="rounded bg-[#f3e7e9] px-1.5 py-0.5 text-[10px] text-[#862d3d]">Beta</span>}</span><span className="mt-2 block text-xs leading-relaxed text-slate-500">{version === "v1" ? "The familiar Pippi workspace." : "A focused workspace with a redesigned quiz editor."}</span>{preference.effectiveVersion === version && <span className="mt-3 flex items-center gap-1 text-xs font-medium text-[#862d3d]"><Check size={13} />Current interface</span>}</span>
        </label>)}
      </fieldset>
      {!preference.eligible && <p className="mt-3 text-sm text-slate-500">The new interface is currently available to invited testers.</p>}
      <button type="button" className="hq-primary mt-5" disabled={loading || busy || disabled || !accountKey || selected === preference.effectiveVersion && preference.preferredVersion === selected} onClick={() => void change()}>{busy ? "Switching…" : selected === preference.effectiveVersion ? "Save preference" : "Save and switch interface"}</button>
    </>}
    {error && <div className="mt-4" role="alert"><p className="hq-error">{error}</p><button type="button" className="hq-secondary mt-3" disabled={busy || loading} onClick={() => { setLoading(true); setError(""); void load(); }}>Reload preference</button></div>}
  </section>;
}
