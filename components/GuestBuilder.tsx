"use client";
import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { FormSchema, type FormSchemaType } from "@/lib/schema";
import { marketingTemplate } from "@/lib/marketing-templates";
import EditorStudio from "./EditorStudio";
const choices = [
  ["product_finder", "Recommend a product", "Match answers to the best product or offer. Product scoring is ready to customize."],
  ["scorecard", "Create a scorecard", "Give different answers different points and show scores by category."],
  ["segmentation", "Understand your audience", "Group people by their needs and guide each group to a relevant next step."],
  ["quiz", "Test knowledge", "Mark correct answers and award points for what someone knows."],
] as const;
export default function GuestBuilder() {
  const [form,setForm]=useState<FormSchemaType|null>(null);
  const [ready,setReady]=useState(false);
  const [title,setTitle]=useState("");
  useEffect(()=>{
    try {const id=localStorage.getItem("pippi-guest-draft");if(id)setForm(FormSchema.parse(JSON.parse(localStorage.getItem(`heyquiz-draft:${id}`)||"null")));}catch{}
    setReady(true);
  },[]);
  function start(kind:typeof choices[number][0]) {
    const id=`quiz-${nanoid(10)}`;
    const draft=kind==="quiz"?FormSchema.parse({id,title:title.trim()||"My knowledge quiz",mode:"quiz",questions:[{id:nanoid(8),type:"multiple_choice",title:"What would you like to ask?",required:true,points:10,options:[{id:"a",label:"First option",isCorrect:true},{id:"b",label:"Second option",isCorrect:false}]}]}):marketingTemplate(kind,id);
    if(title.trim())draft.title=title.trim();
    draft.theme={...draft.theme,primaryColor:"#c62121",backgroundColor:"#faf9f6"};
    try{localStorage.setItem("pippi-guest-draft",id);localStorage.setItem(`heyquiz-draft:${id}`,JSON.stringify(draft));}catch{}
    setForm(draft);
  }
  if(form)return <EditorStudio initialForm={form} guest />;
  if(!ready)return <p className="p-8">Opening your quiz builder…</p>;
  return <main className="min-h-screen bg-[#faf9f6] px-5 py-12 text-gray-900"><div className="mx-auto max-w-3xl">
    <a href="/welcome"><img src="/pippi-logo.svg" alt="pippi home" className="mb-10 w-36" /></a>
    <p className="mb-3 text-sm font-semibold text-red-700">LET’S BUILD SOMETHING USEFUL</p><h1 className="text-4xl font-semibold tracking-tight">What should your quiz do?</h1><p className="mt-4 text-gray-600">Choose a goal. We’ll set up the questions, scoring, and results so you can make them yours.</p>
    <label className="mt-7 block text-sm font-semibold">Quiz name <span className="font-normal text-gray-500">(optional)</span><input value={title} maxLength={200} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Find your perfect fit" className="mt-2 w-full rounded-xl border bg-white p-3 font-normal" /></label>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">{choices.map(([kind,name,description])=><button key={kind} onClick={()=>start(kind)} className="rounded-2xl border border-gray-200 bg-white p-6 text-left hover:border-red-600 focus-visible:outline-2 focus-visible:outline-red-600"><span className="text-lg font-semibold">{name}</span><span className="mt-2 block text-sm leading-relaxed text-gray-600">{description}</span><span className="mt-4 block text-sm font-semibold text-red-700">Start building →</span></button>)}</div>
    <p className="mt-6 text-sm text-gray-500">Free to build. Create a free account to save and publish. No credit card. Marketing templates contain fictional examples—replace them with your own products and advice.</p>
  </div></main>;
}
