"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FlaskConical, ArrowLeft, RefreshCw, Copy, Pause, Play } from "lucide-react";
type Stats = { visitors:number; completions:number; leads:number; clicks:number };
type Test = { id:string; name:string; active:boolean; titles:string[]; stats:Stats[] };
export default function Experiments() {
  const [data,setData] = useState<{forms:{id:string;title:string}[];experiments:Test[]}>({forms:[],experiments:[]});
  const [name,setName] = useState(""), [a,setA] = useState(""), [b,setB] = useState("");
  const [busy,setBusy] = useState(false), [error,setError] = useState(""), [notice,setNotice] = useState("");
  const load = useCallback(async () => { const r = await fetch("/api/experiments"); const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); },[]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/experiments").then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); if (!cancelled) setData(d); }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  },[]);
  async function change(url:string, method:string, body:unknown) {
    setBusy(true); setError(""); setNotice("");
    try { const r=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); const d=await r.json(); if(!r.ok) throw new Error(d.error); await load(); setNotice(method==="POST" ? "Experiment created. Share its test link to split visitors between versions." : "Experiment updated."); }
    catch(e) { setError(e instanceof Error ? e.message : "Please try again."); } finally { setBusy(false); }
  }
  return <main className="w-full min-w-0 max-w-6xl mx-auto px-5 py-10 text-slate-900">
    <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16}/>Workspace</Link>
    <div className="flex flex-wrap justify-between gap-4 items-center mt-8"><div><p className="text-red-800 flex items-center gap-2 text-sm font-semibold"><FlaskConical size={18}/>Conversion experiments</p><h1 className="text-4xl font-semibold tracking-tight mt-3">Find the words that work.</h1><p className="mt-3 text-slate-600 max-w-2xl">Compare two published quiz versions with an approximately 50/50 random split. Change one thing at a time for a clearer comparison.</p></div><button className="hq-secondary" disabled={busy} onClick={()=>load().catch(e=>setError(e.message))}><RefreshCw size={16}/>Refresh results</button></div>
    {error && <p role="alert" className="p-4 my-5 rounded-xl bg-red-50 text-red-800">{error}</p>}
    {notice && <p role="status" className="p-4 my-5 rounded-xl bg-green-50 text-green-800">{notice}</p>}
    <form className="bg-white border rounded-2xl p-6 my-8" onSubmit={e=>{e.preventDefault();void change("/api/experiments","POST",{name,a,b});}}>
      <h2 className="text-xl font-semibold">Create an A/B test</h2><p className="mt-2 text-sm text-slate-600">Duplicate your quiz, change the question or result copy, then publish both versions. Launching freezes both versions for this test; later editor changes won’t affect it.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-5"><label className="text-sm font-medium">Test name<input className="block w-full border rounded-lg p-3 mt-2" required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Result headline test"/></label>{([['A',a,setA],['B',b,setB]] as const).map(([label,value,set])=><label key={label} className="text-sm font-medium">Version {label}<select aria-label={`Version ${label}`} required className="block w-full border rounded-lg p-3 mt-2" value={value} onChange={e=>set(e.target.value)}><option value="">Choose a published quiz</option>{data.forms.map(f=><option key={f.id} value={f.id}>{f.title} · {f.id.slice(-6)}</option>)}</select></label>)}</div>
      <button disabled={busy || data.forms.length<2} className="hq-primary">Launch test</button>{data.forms.length<2 && <p className="mt-3 text-sm text-slate-500">You need two published quizzes to launch a test.</p>}
    </form>
    <p className="text-sm text-slate-500 mb-6">Results count unique browsers that started through the experiment link. Repeat attempts count once per metric. Assignment lasts up to 90 days; clearing cookies or switching devices creates a new visitor. Ordinary quiz links and previews are excluded. Pausing stops new starts; existing sessions can finish.</p>
    <div className="space-y-6">{data.experiments.map(t=><section key={t.id} className="border rounded-2xl bg-white p-6"><div className="flex flex-wrap gap-3 items-center justify-between"><div><h2 className="text-xl font-semibold">{t.name}</h2><p className="text-sm text-slate-500 mt-1">{t.active ? "Running" : "Paused"} · Fixed versions · 50/50 allocation</p></div><div className="flex flex-wrap gap-2"><button disabled={busy} className="hq-secondary" onClick={async()=>{try{await navigator.clipboard.writeText(`${location.origin}/experiment/${t.id}`);setNotice("Experiment link copied.");}catch{setError("Copy the experiment URL shown below.");}}}><Copy size={16}/>Copy test link</button><button disabled={busy} className="hq-secondary" onClick={()=>change(`/api/experiments/${t.id}`,"PATCH",{active:!t.active})}>{t.active ? <Pause size={16}/> : <Play size={16}/>}{t.active ? "Pause" : "Resume"}</button></div></div>
      <Link href={`/experiment/${t.id}`} className="block mt-4 text-sm text-red-800 break-all">/experiment/{t.id}</Link>
      <div className="overflow-x-auto mt-5"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500">{['Version','Visitors','Completed','Leads','Offer clicks'].map(h=><th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead><tbody>{t.stats.map((s,i)=><tr key={i} className="border-b"><td className="p-3 font-semibold">{i===0?'A':'B'} · {t.titles[i]}</td><td className="p-3">{s.visitors}</td>{(['completions','leads','clicks'] as const).map(k=><td key={k} className="p-3">{s[k]} <span className="text-slate-500">({s.visitors ? (s[k]/s.visitors*100).toFixed(1) : '0.0'}%)</span></td>)}</tr>)}</tbody></table></div>
      <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{t.stats.some(s=>s.visitors<100) ? "Early data: at least one version has fewer than 100 visitors. There is not enough evidence to judge a winner." : "Directional results only. Visitor count alone does not establish a winner; check conversion counts, traffic quality, and statistical uncertainty before acting."} Decide your primary metric before sending traffic and avoid stopping at the first apparent lift.</p>
    </section>)}</div>
  </main>;
}
