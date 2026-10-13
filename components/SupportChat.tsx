"use client";
import Link from "next/link";
import { useId, useRef, useState, useSyncExternalStore } from "react";
import { Send, BookOpen } from "lucide-react";
import { guideAnswer } from "@/lib/support-guidance";
import { helpArticles, searchHelp } from "@/lib/help-content";
const subscribe=()=>()=>{};
type Message = {role:"user"|"assistant";content:string;sources?:{title:string;href:string}[];mode?:string};
export default function SupportChat() {
  const id=useId();
  const locationInfo=useSyncExternalStore(subscribe,()=>window.location.pathname+window.location.search,()=>"");
  const local=useSyncExternalStore(subscribe,()=>["127.0.0.1","localhost"].includes(window.location.hostname),()=>false);
  const articleSlug=locationInfo.split("?")[0].split("/help/")[1] || new URLSearchParams(locationInfo.split("?")[1]).get("article") || undefined;
  const article=helpArticles.find(a=>a.slug===articleSlug);
  const [question,setQuestion]=useState("");
  const [messages,setMessages]=useState<Message[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [signIn,setSignIn]=useState(false);
  const inFlight=useRef(false);
  const end=useRef<HTMLDivElement>(null);
  const suggestions = searchHelp(question).slice(0,3);
  async function ask(event:React.FormEvent) {
    event.preventDefault();
    if(inFlight.current || question.trim().length<3)return;
    const value=question.trim();
    inFlight.current=true;setBusy(true);setError("");setSignIn(false);
    try {
      const res=await fetch("/api/support/chat",{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(30000),body:JSON.stringify({message:value,article:article?.slug,history:messages.slice(-6).map(({role,content})=>({role,content:content.slice(0,1800)}))})});
      const data=await res.json();
      if(res.status===401){
        const matches=searchHelp(value);
        const articles=(article?[article,...matches.filter(a=>a.slug!==article.slug)]:matches).slice(0,3);
        setMessages(prev=>[...prev,{role:"user",content:value},{role:"assistant",content:guideAnswer(articles,"These are instructions from the Pippi guide. Sign in for a personalized AI explanation."),sources:articles.map(a=>({title:a.title,href:`/help/${a.slug}`})),mode:"guide"}]);
        setQuestion("");setSignIn(true);return;
      }
      if(!res.ok){setSignIn(res.status===401);throw Error(res.status===401?"Sign in to use AI chat. These guides are available without an account.":data.error||"Could not reach support. Your question is still here; please try again.");}
      setMessages(prev=>[...prev,{role:"user",content:value},{role:"assistant",content:data.answer,sources:data.sources,mode:data.mode}]);
      setQuestion("");
      requestAnimationFrame(()=>end.current?.scrollIntoView({block:"nearest",behavior:"smooth"}));
    } catch(e) {
      setError(e instanceof Error && e.name==="TimeoutError" ? "The assistant took too long. Your question is still here. Try again or open a guide." : e instanceof Error ? e.message : "Could not load an answer. Please try again.");
    } finally {inFlight.current=false;setBusy(false);}
  }
  return <div data-clarity-mask="true" className="text-slate-900">
    {local&&<p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">You are in the local test preview. AI may be disconnected here. <a href="https://www.pippiapp.com/help" className="font-semibold underline">Open live Pippi support ↗</a></p>}
    <div className="rounded-2xl bg-stone-50 p-4 text-sm leading-relaxed">Hi! What are you trying to do in Pippi? I can guide you through building, scoring and publishing, using the help articles below.</div>
    <p className="mt-3 text-xs leading-relaxed text-slate-500">AI assistant, not a human agent. I cannot access your account or make changes. Questions and recent chat are sent to Google to answer. Leave out passwords, keys and customer details.</p>
    <div role="log" aria-label="Support conversation" aria-live="polite" className="mt-4 space-y-4">{messages.map((message,index)=><div key={index} className={`rounded-2xl p-4 ${message.role==="user"?"ml-5 bg-[#681d27] text-white":"mr-2 border border-stone-200 bg-white"}`}><p className="mb-2 text-xs font-semibold">{message.role==="user"?"You":message.mode==="guide"?"Pippi guide":"Pippi AI"}</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{message.content}</p>{message.sources?.map(source=><Link key={source.href} href={source.href} target="_blank" rel="noopener" className="mt-3 block text-sm font-semibold text-red-800 underline">{source.title} ↗</Link>)}</div>)}{busy&&<p role="status" className="rounded-xl bg-stone-50 p-3 text-sm text-slate-600">Looking through the user guide…</p>}<div ref={end}/></div>
    <form onSubmit={ask} className="mt-4">
      <label htmlFor={id} className="text-sm font-semibold">Your question</label>
      <textarea id={id} maxLength={1500} minLength={3} required value={question} onChange={e=>setQuestion(e.target.value)} placeholder="How do I put name and email on one page?" className="mt-2 min-h-24 w-full resize-y rounded-xl border border-stone-300 bg-white p-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-red-800"/>
      {error&&<div role="alert" className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{error}{signIn&&<Link href="/login" target="_blank" rel="noopener" className="ml-1 underline">Sign in ↗</Link>}</div>}
      {signIn&&<p className="mt-3 text-sm text-slate-600">For follow-up AI help, <Link href="/login" target="_blank" rel="noopener" className="font-semibold text-red-800 underline">sign in to your free account ↗</Link>. The full guides remain available here.</p>}
      {signIn&&<nav aria-label="Suggested support guides" className="mt-3 grid gap-2">{suggestions.map(a=><Link key={a.slug} href={`/help/${a.slug}`} target="_blank" rel="noopener" className="text-sm text-red-800 underline">{a.title} ↗</Link>)}</nav>}
      <div className="mt-3 flex items-center justify-between gap-3"><button type="button" onClick={()=>{setMessages([]);setError("");setSignIn(false);}} disabled={busy} className="text-xs text-slate-600 underline disabled:opacity-50">Clear conversation</button><button disabled={busy||question.trim().length<3} className="inline-flex items-center gap-2 rounded-xl bg-[#681d27] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"><Send size={15} aria-hidden="true"/>{busy?"Thinking…":"Ask the assistant"}</button></div>
    </form>
    <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4"><Link href="/help" target="_blank" rel="noopener" className="inline-flex items-center gap-2 text-xs font-semibold text-red-800"><BookOpen size={14}/>Browse all guides ↗</Link><p className="text-[11px] text-slate-500">Chat clears when you reload.</p></footer>
  </div>;
}
