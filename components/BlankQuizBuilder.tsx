"use client";
import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { blankQuiz } from "@/lib/blank-quiz";
import type { FormSchemaType } from "@/lib/schema";
import { readGuestDraft, recoverBuilderReload } from "@/lib/guest-draft";
import EditorStudio from "./EditorStudio";
import WorkspaceHeader from "./WorkspaceHeader";

export default function BlankQuizBuilder() {
  const initialized = useRef(false);
  const [form, setForm] = useState<FormSchemaType | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      // Reload this tab's blank draft, without replacing any earlier guest draft contents.
      const previous = recoverBuilderReload("/create/blank") ? sessionStorage.getItem("pippi-blank-draft") : null;
      const saved = previous ? readGuestDraft(localStorage, sessionStorage, previous) : null;
      const draft = saved ?? blankQuiz(`quiz-${nanoid(10)}`);
      localStorage.setItem(`heyquiz-draft:${draft.id}`, JSON.stringify(draft));
      if (!localStorage.getItem(`pippi-editor-mode:${draft.id}`)) localStorage.setItem(`pippi-editor-mode:${draft.id}`, "guided");
      sessionStorage.setItem("pippi-blank-draft", draft.id);
      localStorage.setItem("pippi-guest-draft", draft.id);
      // Keep SSR and the first client render on the same placeholder; storage and
      // draft ID creation must happen after mount, including the recoverable reload.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate the browser-only draft after storage succeeds.
      setForm(draft);
    } catch { setError("Your browser could not open a recoverable draft. Enable site storage, then reload this page."); }
  }, []);
  if (form) return <EditorStudio initialForm={form} guest />;
  return <><WorkspaceHeader guest /><main className="p-8"><p role={error ? "alert" : "status"}>{error || "Opening your blank canvas…"}</p>{error && <a href="/create" className="underline">Back to quiz creation</a>}</main></>;
}
