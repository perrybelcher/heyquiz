"use client";

import Link from "next/link";
import { ArrowUpRight, FilePlus2, LayoutTemplate, ListChecks, Sparkles } from "lucide-react";
import { clarityEvent } from "@/lib/clarity";

const paths = [
  { id: "blank", title: "Start blank", description: "Write your own questions on an empty canvas. You decide what goes in.", href: "/create/blank", icon: FilePlus2 },
  { id: "template", title: "Use a template", description: "Choose a ready-made quiz, then make the questions and results your own.", href: "/templates", icon: LayoutTemplate },
  { id: "guided", title: "Guided wizard", description: "Choose your goal and build step by step, without AI generation.", href: "/create/guided", icon: ListChecks },
  { id: "ai", title: "Create with AI", description: "Describe your idea and let AI write a first draft for you to review.", href: "/create/ai", icon: Sparkles },
] as const;

export default function CreationPaths({ busy = false, onBlank, onAI }: {
  busy?: boolean;
  onBlank?: () => void;
  onAI?: () => void;
}) {
  const cardClass = "group min-w-0 rounded-2xl border border-stone-200 bg-white p-4 text-left text-slate-900 shadow-sm transition-colors hover:border-[#a92335] hover:bg-[#fffaf8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a92335] disabled:cursor-wait disabled:opacity-60 sm:p-5";
  return <div role="group" aria-label="Ways to create a quiz" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {paths.map(({ id, title, description, href, icon: Icon }) => {
      const action = id === "blank" ? onBlank : id === "ai" ? onAI : undefined;
      const content = <>
        <span className="flex items-center gap-3 sm:flex-wrap">
          <span className="inline-flex shrink-0 rounded-xl bg-[#f8eeeb] p-2.5 text-[#922c3b]"><Icon size={21} aria-hidden="true" /></span>
          <span className="min-w-0 flex-1 text-base font-semibold tracking-tight sm:order-3 sm:basis-full">{title}</span>
          <ArrowUpRight size={17} className="ml-auto shrink-0 text-stone-500 group-hover:text-[#922c3b]" aria-hidden="true" />
        </span>
        <span className="mt-3 block text-sm leading-relaxed text-slate-600">{description}</span>
      </>;
      return action
        ? <button key={id} type="button" disabled={busy} onClick={() => { clarityEvent(`create_${id}`); action(); }} className={cardClass}>{content}</button>
        : <Link key={id} href={href} prefetch={false} aria-disabled={busy || undefined} tabIndex={busy ? -1 : undefined} onClick={event => { if (busy) event.preventDefault(); else clarityEvent(`create_${id}`); }} className={`${cardClass}${busy ? " cursor-wait opacity-60" : ""}`}>{content}</Link>;
    })}
  </div>;
}
