"use client";
import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { FormSchema, type FormSchemaType } from "@/lib/schema";
import EditorStudio from "./EditorStudio";

// Stable device-local identity lets a visitor resume after email confirmation.
export default function GuestBuilder() {
  const [form, setForm] = useState<FormSchemaType | null>(null);
  useEffect(() => {
    let draft: FormSchemaType | null = null;
    try {
      const id = localStorage.getItem("pippi-guest-draft");
      if (id) draft = FormSchema.parse(JSON.parse(localStorage.getItem(`heyquiz-draft:${id}`) || "null"));
    } catch { /* Invalid or unavailable storage falls back to a new draft. */ }
    if (!draft) draft = FormSchema.parse({
      id: `quiz-${nanoid(10)}`, title: "Untitled quiz", mode: "quiz",
      description: "A new conversation starts with a good question.",
      theme: { primaryColor: "#c62121", backgroundColor: "#faf9f6", layout: "step" },
      questions: [{ id: `q-${nanoid(8)}`, type: "multiple_choice", title: "What would you like to ask?", required: true, points: 10,
        options: [{ id: "a", label: "First option", isCorrect: true }, { id: "b", label: "Second option", isCorrect: false }] }],
    });
    try {
      localStorage.setItem("pippi-guest-draft", draft.id);
      localStorage.setItem(`heyquiz-draft:${draft.id}`, JSON.stringify(draft));
    } catch { /* The editor still works in memory when storage is unavailable. */ }
    setForm(draft);
  }, []);
  return form ? <EditorStudio initialForm={form} guest /> : <p className="p-8">Opening your quiz builder…</p>;
}
