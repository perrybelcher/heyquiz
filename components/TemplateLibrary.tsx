"use client";
import { useEffect, useState } from "react";
import { readGuestDraft, recoverBuilderReload } from "@/lib/guest-draft";
import type { QuizType } from "@/lib/quiz-types";
import type { FormSchemaType } from "@/lib/schema";
import UnifiedTemplateLibrary from "./UnifiedTemplateLibrary";
import EditorStudio from "./EditorStudio";
export default function TemplateLibrary({initialQuizType}:{initialQuizType?:QuizType}) {
 const [form,setForm]=useState<FormSchemaType|null>(null);
 const [error,setError]=useState("");
  useEffect(()=>{if(!recoverBuilderReload("/templates"))return;try{const id=sessionStorage.getItem("pippi-template-draft");const saved=id?readGuestDraft(localStorage,sessionStorage,id):null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore this tab's explicit template draft after hydration.
    if(saved)setForm(saved);
  }catch{}},[]);
  function storeDraft(draft: FormSchemaType) {
    try {
      localStorage.setItem(`heyquiz-draft:${draft.id}`, JSON.stringify(draft));
      localStorage.setItem("pippi-guest-draft", draft.id);
      sessionStorage.setItem("pippi-template-draft",draft.id);
      localStorage.setItem(`pippi-editor-mode:${draft.id}`,"guided");
      setForm(draft);
    } catch { setError("Your browser could not store this draft. Enable site storage before starting so your work can be recovered."); }
  }
 if(form)return <EditorStudio initialForm={form} guest/>;
 return <UnifiedTemplateLibrary initialQuizType={initialQuizType} onCreate={storeDraft} error={error}/>;
}
