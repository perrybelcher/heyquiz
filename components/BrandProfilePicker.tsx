"use client";
import { useEffect, useState } from "react";
import { BookmarkPlus, FolderOpen, RefreshCw } from "lucide-react";
import { MarketingBriefSchema, type MarketingBrief } from "@/lib/marketing-brief";
import type { BrandProfile } from "@/lib/brand-profiles";

export default function BrandProfilePicker({ brief, onApply, disabled }: {
  brief: MarketingBrief; onApply: (brief: MarketingBrief) => void; disabled: boolean;
}) {
  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"apply" | "update" | null>(null);
  const profile = profiles.find(p => p.id === selected);
  async function refresh() {
    setBusy(true); setError(""); setPending(null);
    try {
      const response = await fetch("/api/brand-profiles", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Could not load profiles.");
      setProfiles(data.profiles);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load profiles."); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);
  async function save(update = false) {
    setError(""); setMessage(""); setPending(null);
    const parsed = MarketingBriefSchema.safeParse(brief);
    if (!parsed.success) { setError("Complete all three brief steps before saving a profile. " + parsed.error.issues.map(i => `${i.path.join(" → ")}: ${i.message}`).join(" · ")); return; }
    if (!name.trim()) { setError("Give this profile a name first."); return; }
    if (update && !profile) return;
    setBusy(true);
    try {
      const response = await fetch(update ? `/api/brand-profiles/${profile!.id}` : "/api/brand-profiles", {
        method: update ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, brief: parsed.data, ...(update ? { revision: profile!.revision } : {}) }),
      });
      const saved = await response.json();
      if (!response.ok) throw Error(saved.error || "Could not save profile.");
      setProfiles(current => [saved, ...current.filter(p => p.id !== saved.id)]);
      setSelected(saved.id); setName(saved.name);
      setMessage(update ? "Profile updated. Existing quizzes are unchanged." : "Profile saved to your account. Reuse it for your next quiz.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save profile."); }
    finally { setBusy(false); }
  }
  function apply() {
    if (!profile) return;
    onApply(structuredClone(profile.brief)); setPending(null); setMessage(`Applied ${profile.name}. You can edit this brief without changing the saved profile.`); setError("");
  }
  return <section aria-label="Brand and offer profiles" className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
    <div className="flex items-start gap-3"><FolderOpen className="text-red-800 shrink-0" size={22}/><div><h2 className="text-lg font-semibold">Your brand. Ready for the next quiz.</h2><p className="text-sm text-slate-600 mt-1">Save your audience, offer, voice, results, and next step as a reusable profile. Profiles are private to your account.</p></div></div>
    <div className="grid sm:grid-cols-2 gap-4"><label className="text-sm font-medium">Saved profile<select aria-label="Saved profile" className="hq-input mt-2" disabled={busy || disabled} value={selected} onChange={e=>{setSelected(e.target.value);setName(profiles.find(p=>p.id===e.target.value)?.name || "");setPending(null);setMessage("");}}><option value="">Choose a profile</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="text-sm font-medium">Profile name<input className="hq-input mt-2" maxLength={100} placeholder="e.g. SundayDesk · Home office shoppers" value={name} disabled={busy || disabled} onChange={e=>setName(e.target.value)}/></label></div>
    <div className="flex flex-wrap gap-2"><button type="button" className="hq-secondary" disabled={!profile || busy || disabled} onClick={()=>{setPending("apply");setMessage("");}}>Use selected profile</button><button type="button" className="hq-secondary" disabled={busy || disabled} onClick={()=>void save()}><BookmarkPlus size={16}/>Save as new profile</button><button type="button" className="hq-secondary" disabled={!profile || busy || disabled} onClick={()=>setPending("update")}>Update selected profile</button><button type="button" className="hq-secondary" aria-label="Refresh profiles" disabled={busy || disabled} onClick={()=>void refresh()}><RefreshCw size={16}/></button></div>
    {pending && profile && <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm space-y-3"><p>{pending === "apply" ? `Replace this brief with “${profile.name}”? Your current brief fields will be replaced.` : `Replace the saved “${profile.name}” profile with this brief? Existing quizzes will stay unchanged.`}</p><div className="flex gap-3"><button type="button" className="hq-primary" disabled={busy || disabled} onClick={()=>pending === "apply" ? apply() : void save(true)}>{pending === "apply" ? "Replace brief" : "Confirm profile update"}</button><button type="button" className="hq-secondary" onClick={()=>setPending(null)}>Cancel</button></div></div>}
    {busy && <p role="status" className="text-sm text-slate-500">Working…</p>}
    {message && <p role="status" className="text-sm text-green-800">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    <p className="text-xs text-slate-500">Complete the three brief steps below to save a profile. Applying one never generates or publishes a quiz automatically.</p>
  </section>;
}
