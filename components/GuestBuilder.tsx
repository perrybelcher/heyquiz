"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { type FormSchemaType } from "@/lib/schema";
import { outcomeTemplate } from "@/lib/outcome-templates";
import QuizTypeChooser from "./QuizTypeChooser";
import type { QuizType } from "@/lib/quiz-types";
import { readGuestDraft, recoverBuilderReload } from "@/lib/guest-draft";
import EditorStudio from "./EditorStudio";
import WorkspaceHeader from "./WorkspaceHeader";
export default function GuestBuilder({mode = "guided",initialQuizType}:{mode?:"guided"|"resume";initialQuizType?:QuizType}) {
  const [quizType,setQuizType]=useState(initialQuizType);
  const [form,setForm]=useState<FormSchemaType|null>(null);
  const [ready,setReady]=useState(false);
  const [title,setTitle]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{
    try {
      const requested=new URLSearchParams(window.location.search).get("draft");
      const id=mode==="resume"?(requested&&/^[a-zA-Z0-9_-]{1,128}$/.test(requested)?requested:localStorage.getItem("pippi-guest-draft")):recoverBuilderReload("/create/guided")?sessionStorage.getItem("pippi-guided-draft"):null;
      const saved=id?readGuestDraft(localStorage,sessionStorage,id):null;
      if(saved) {
        // Only an explicit resume or this wizard tab's reload reopens a draft.
        // Starting a new wizard must never silently reopen an unrelated quiz.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- One-time synchronization with browser storage.
        setForm(saved);
      }
    }catch{}
    setReady(true);
  },[mode]);
  function start(kind:QuizType) {
    const id=`quiz-${nanoid(10)}`;
    const draft=outcomeTemplate(kind,id);
    if(title.trim())draft.title=title.trim();
    draft.theme={...draft.theme,primaryColor:"#c62121",backgroundColor:"#faf9f6"};
    try{
      localStorage.setItem(`heyquiz-draft:${id}`,JSON.stringify(draft));
      localStorage.setItem(`pippi-editor-mode:${id}`,"guided");
      sessionStorage.setItem("pippi-guided-draft",id);
      localStorage.setItem("pippi-guest-draft",id);
    }catch{setError("Your browser could not store this draft. Enable site storage, then try again so your work can be recovered.");return;}
    setForm(draft);
  }
  if(form)return <EditorStudio initialForm={form} guest />;
  if(!ready)return <><WorkspaceHeader guest /><p className="p-8">Opening your quiz builder…</p></>;
  if(mode==="resume")return <><WorkspaceHeader guest /><main className="min-h-screen bg-[#faf8f4] px-5 py-16 text-slate-900"><div className="mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white p-8"><h1 className="text-2xl font-semibold">No browser draft to resume</h1><p className="mt-3 text-slate-600">Your saved account quizzes are in your workspace. You can also choose how to start a new quiz.</p><div className="mt-6 flex flex-wrap gap-4"><Link prefetch={false} className="hq-primary" href="/create">Create a quiz</Link><Link prefetch={false} className="hq-secondary" href="/">My workspace</Link></div></div></main></>;
  return <><WorkspaceHeader guest /><main className="min-h-screen bg-[#faf9f6] px-5 py-12 text-gray-900"><div className="mx-auto max-w-3xl">
    <Link prefetch={false} href="/welcome"><Image width={144} height={48} src="/pippi-logo.svg" alt="pippi home" className="mb-10 w-36" /></Link>
    <p className="mb-3 text-sm font-semibold text-red-800">GUIDED WIZARD</p><h1 className="text-4xl font-semibold tracking-tight">What should your quiz do?</h1><p className="mt-4 text-gray-600">Choose a goal, then work through your questions, results, design, and publishing one step at a time. You write the copy; no AI generation is needed.</p>
    <p className="mt-5 flex flex-wrap gap-4"><Link prefetch={false} href="/create" className="font-semibold text-red-800 underline">← All ways to create</Link><Link prefetch={false} href="/create/blank" className="font-semibold text-red-800 underline">Prefer a blank canvas?</Link></p>
    {error&&<p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    <label className="mt-7 block text-sm font-semibold">Quiz name <span className="font-normal text-gray-500">(optional)</span><input value={title} maxLength={200} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Find your perfect fit" className="mt-2 w-full rounded-xl border bg-white p-3 font-normal" /></label>
    <div className="mt-6"><QuizTypeChooser selected={quizType} onSelect={setQuizType}/>{quizType&&<button className="hq-primary mt-5" onClick={()=>start(quizType)}>Review possible results →</button>}</div>
    <p className="mt-6 text-sm text-gray-500">Free to build. Create a free account to save and publish. No credit card. Marketing templates contain fictional examples—replace them with your own products and advice.</p>
  </div></main></>;
}
