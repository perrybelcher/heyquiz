"use client";
import { useEffect, useState } from "react";
import WorkspaceHeader from "./WorkspaceHeader";
import CreationLanding from "./CreationLanding";
import { creationExamples } from "@/lib/creation-examples";
import { creationQuizType } from "@/lib/creation-quiz-type";
import { quizTypes, quizTypeDefinitions, type QuizType } from "@/lib/quiz-types";
import { outcomeCreationEnabled } from "@/lib/outcome-availability";
import { readGuestDraft } from "@/lib/guest-draft";

const enabledTypes = quizTypes.filter(type => outcomeCreationEnabled || quizTypeDefinitions[type].scored);
const defaultType = enabledTypes.includes("personality") ? "personality" : enabledTypes[0];
export default function CreationStart({ initialQuizType }: { initialQuizType?: QuizType }) {
  const [selectedType, setSelectedType] = useState<QuizType>(initialQuizType && enabledTypes.includes(initialQuizType) ? initialQuizType : defaultType);
  const [draft, setDraft] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => {
    function syncSelection() {
      const type = creationQuizType(new URLSearchParams(window.location.search).get("quizType"));
      setSelectedType(type ?? defaultType);
    }
    function syncDraft() {
      try {
        const saved = readGuestDraft(localStorage, sessionStorage);
        setDraft(saved ? { id: saved.id, title: saved.title || "Untitled quiz" } : null);
      } catch { setDraft(null); }
    }
    syncDraft();
    window.addEventListener("popstate", syncSelection);
    window.addEventListener("storage", syncDraft);
    window.addEventListener("focus", syncDraft);
    return () => {
      window.removeEventListener("popstate", syncSelection);
      window.removeEventListener("storage", syncDraft);
      window.removeEventListener("focus", syncDraft);
    };
  }, []);
  useEffect(() => {
    // Next client navigation may reuse this component with a new route selection.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize the validated server route prop.
    setSelectedType(initialQuizType && enabledTypes.includes(initialQuizType) ? initialQuizType : defaultType);
  }, [initialQuizType]);
  function selectType(type: QuizType) {
    if (!enabledTypes.includes(type) || selectedType === type) return;
    const url = new URL(window.location.href);
    url.searchParams.set("quizType", type);
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setSelectedType(type);
  }
  return <><WorkspaceHeader active="overview" /><CreationLanding selectedType={selectedType} enabledTypes={enabledTypes} example={creationExamples[selectedType]} draft={draft} onSelect={selectType}/></>;
}
