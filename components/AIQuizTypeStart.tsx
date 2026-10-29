"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import WorkspaceHeader from "./WorkspaceHeader";
import QuizTypeChooser from "./QuizTypeChooser";
import { creationTypeHref } from "@/lib/creation-quiz-type";

/** Direct AI links follow the same outcome-first selection as the main creator. */
export default function AIQuizTypeStart() {
  const router = useRouter();
  return <><WorkspaceHeader active="overview" /><main className="mx-auto max-w-6xl space-y-6 px-5 py-10"><Link className="text-sm font-semibold text-red-800 underline" href="/create">All creation options</Link><header><h1 className="text-3xl font-semibold">What should your AI quiz deliver?</h1><p className="mt-3 text-slate-600">Choose the desired result. AI will propose a draft for you to review before editing questions.</p></header><QuizTypeChooser onSelect={type=>router.push(creationTypeHref("/create/ai",type))}/></main></>;
}
