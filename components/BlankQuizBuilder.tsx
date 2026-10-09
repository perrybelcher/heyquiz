"use client";
import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { blankQuiz } from "@/lib/blank-quiz";
import { FormSchema, type FormSchemaType } from "@/lib/schema";
import EditorStudio from "./EditorStudio";

export default function BlankQuizBuilder() {
  const initialized = useRef(false);
  const [form, setForm] = useState<FormSchemaType | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      // Reload this tab's blank draft, without replacing any earlier guest draft contents.
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const previous = navigation?.type === "reload" ? sessionStorage.getItem("pippi-blank-draft") : null;
      const saved = previous && localStorage.getItem(`heyquiz-draft:${previous}`);
      const draft = saved ? FormSchema.parse(JSON.parse(saved)) : blankQuiz(`quiz-${nanoid(10)}`);
      localStorage.setItem(`heyquiz-draft:${draft.id}`, JSON.stringify(draft));
      localStorage.setItem(`pippi-editor-mode:${draft.id}`, "advanced");
      sessionStorage.setItem("pippi-blank-draft", draft.id);
      localStorage.setItem("pippi-guest-draft", draft.id);
      setForm(draft);
    } catch { setError("Your browser could not open a recoverable draft. Enable site storage, then reload this page."); }
  }, []);
  if (form) return <EditorStudio initialForm={form} guest />;
  return <main className="p-8"><p role={error ? "alert" : "status"}>{error || "Opening your blank canvas…"}</p>{error && <a href="/create" className="underline">Back to quiz creation</a>}</main>;
}
