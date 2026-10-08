"use client";
import { useState } from "react";
import Link from "next/link";
import WorkspaceWelcome from "./WorkspaceWelcome";
import { nanoid } from "nanoid";
import {
  Search,
  ArrowUpRight,
  MoreHorizontal,
  Copy,
  Trash2,
  Sparkles,
  Layers,
  FileText,
  LogOut,
  X,
} from "lucide-react";
import type { FormSchemaType } from "@/lib/schema";
import { marketingTemplate } from "@/lib/marketing-templates";
import type { MarketingConfig } from "@/lib/marketing";
export default function Dashboard({
  initialForms,
}: {
  initialForms: FormSchemaType[];
}) {
  const [forms, setForms] = useState(initialForms),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [agent, setAgent] = useState(false),
    [topic, setTopic] = useState(""),
    [count, setCount] = useState(5),
    [menu, setMenu] = useState<string | null>(null);
  const filtered = forms.filter(
    (f) =>
      (filter === "all" || f.mode === filter) &&
      `${f.title} ${f.description || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function create(copy?: FormSchemaType, kind?: MarketingConfig["kind"]) {
    setBusy(true);
    setError("");
    const id = `quiz-${nanoid(10)}`;
    const form: FormSchemaType = kind
      ? marketingTemplate(kind, id)
      : copy
        ? {
            ...copy,
            id,
            title: `${copy.title} (copy)`,
            revision: 0,
            publishedAt: undefined,
          }
        : {
            id,
            title: "Untitled quiz",
            description: "A new conversation starts with a good question.",
            mode: "quiz",
            theme: {
              primaryColor: "#4f46e5",
              backgroundColor: "#f6f7fb",
              layout: "step",
            },
            settings: {
              showProgressBar: true,
              showReviewBeforeSubmit: true,
              showAnswerKeyOnFinish: true,
              allowRetake: true,
              passingScorePercentage: 70,
            },
            questions: [
              {
                id: `q-${nanoid(8)}`,
                type: "multiple_choice",
                title: "What would you like to ask?",
                required: true,
                points: 10,
                options: [
                  { id: "a", label: "First option", isCorrect: true },
                  { id: "b", label: "Second option", isCorrect: false },
                ],
              },
            ],
            outcomeTiers: [],
          };
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.assign(`/editor/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create quiz.");
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this quiz and its published link?")) return;
    try {
      const res = await fetch(`/api/forms/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setForms((prev) => prev.filter((f) => f.id !== id));
      setMenu(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete quiz.");
    }
  }
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, numQuestions: count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.assign(`/editor/${data.form.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-[#f8f9f5] text-slate-900">
      <header className="h-20 bg-[#f8f9f5] border-b border-[#e4e5de] flex items-center justify-between px-6 sm:px-10">
        <img src="/quiznick-logo-v2.png" alt="Quiznick" className="h-8" />
        <div className="flex items-center gap-4">
          <nav aria-label="Workspace navigation" className="hidden sm:flex items-center gap-6 text-sm text-slate-500"><a href="#quiz-starters" className="hover:text-slate-900">Quiz starters</a><a href="#your-quizzes" className="hover:text-slate-900">My quizzes</a></nav>
          <button
            className="hq-icon text-slate-400"
            aria-label="Sign out"
            onClick={async () => {
              await fetch("/api/auth", { method: "DELETE" });
              window.location.assign("/login");
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-5 py-7 sm:px-10 sm:py-10">
        <WorkspaceWelcome busy={busy} onCreate={kind=>void create(undefined,kind)} onAI={()=>{setError("");setAgent(true);}} projectCount={forms.length} publishedCount={forms.filter(f=>f.publishedAt).length} />
        {error && !agent && (
          <p role="alert" className="hq-error mb-6">
            {error}
          </p>
        )}
        <div className="flex flex-col sm:flex-row justify-between gap-5 mb-6">
          <nav
            aria-label="Filter forms"
            className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit max-w-full overflow-x-auto"
          >
            {[
              ["all", "All forms"],
              ["quiz", "Quizzes"],
              ["survey", "Surveys"],
              ["form", "Forms"],
            ].map(([id, name]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                aria-pressed={filter === id}
                className={`text-sm whitespace-nowrap rounded-lg px-4 py-2 transition ${filter === id ? "bg-white shadow-sm font-medium" : "text-slate-500"}`}
              >
                {name}
              </button>
            ))}
          </nav>
          <label className="relative sm:w-72">
            <Search
              className="absolute left-3 top-3.5 text-slate-400"
              size={16}
            />
            <input
              aria-label="Search your forms"
              placeholder="Search forms…"
              className="hq-input !pl-10 !py-2.5 !text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        {filtered.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((f) => (
              <article
                key={f.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-md transition relative group"
              >
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center">
                      {f.mode === "quiz" ? (
                        <Layers size={20} />
                      ) : (
                        <FileText size={20} />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full text-[11px] px-2.5 py-1 font-medium ${f.publishedAt ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                      >
                        {f.publishedAt ? "Published" : "Draft"}
                      </span>
                      <button
                        aria-label={`Actions for ${f.title}`}
                        className="hq-icon text-slate-400"
                        onClick={() => setMenu(menu === f.id ? null : f.id)}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </div>
                  {menu === f.id && (
                    <div className="absolute right-5 top-16 z-10 bg-white rounded-xl border shadow-lg p-2 min-w-40">
                      <button
                        className="w-full flex gap-2 text-sm p-2 hover:bg-slate-50"
                        onClick={() => void create(f)}
                      >
                        <Copy size={15} /> Duplicate
                      </button>
                      <button
                        className="w-full flex gap-2 text-sm text-rose-600 p-2 hover:bg-rose-50"
                        onClick={() => void remove(f.id)}
                      >
                        <Trash2 size={15} /> Delete quiz
                      </button>
                    </div>
                  )}
                  <Link href={`/editor/${f.id}`} className="block">
                    <h2 className="text-lg font-semibold leading-snug mb-2 group-hover:text-indigo-700">
                      {f.title}
                    </h2>
                    <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 min-h-10">
                      {f.description || "Ready for your next question."}
                    </p>
                  </Link>
                  <p className="text-xs text-slate-400 mt-6">
                    {f.questions.length} questions ·{" "}
                    {f.mode === "quiz"
                      ? "Quiz"
                      : f.mode === "survey"
                        ? "Survey"
                        : "Form"}
                  </p>
                </div>
                <footer className="px-6 py-4 border-t border-slate-100 flex justify-between text-sm">
                  <Link
                    href={`/editor/${f.id}`}
                    className="font-medium text-indigo-600"
                  >
                    Open editor
                  </Link>
                  <Link
                    href={`/play/${f.id}${f.publishedAt ? "" : "?preview=1"}`}
                    target="_blank"
                    className="text-slate-500 flex gap-1 items-center"
                  >
                    {f.publishedAt ? "View live" : "Preview"}
                    <ArrowUpRight size={15} />
                  </Link>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 py-20 text-center">
            <Search className="mx-auto text-slate-300 mb-4" />
            <h2 className="font-medium">
              {query ? "No matching forms" : "A fresh start"}
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              {query
                ? "Try another search or filter."
                : "Create your first form to get started."}
            </p>
          </div>
        )}
      </main>
      {agent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-title"
          className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm grid place-items-center p-5"
        >
          <section className="w-full max-w-xl bg-white rounded-3xl p-8">
            <div className="flex justify-between mb-6">
              <Sparkles className="text-indigo-600" />
              <button
                aria-label="Close AI builder"
                onClick={() => setAgent(false)}
              >
                <X />
              </button>
            </div>
            <h2 id="ai-title" className="text-2xl font-semibold mb-3">
              What would you like to create?
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Describe your audience, topic, and what a good result looks like.
            </p>
            <textarea
              className="hq-input min-h-32"
              aria-label="Quiz brief"
              placeholder="A short quiz that helps first-time gardeners understand which growing style fits their space and schedule…"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <label className="flex justify-between items-center my-5 text-sm">
              Number of questions
              <select
                className="hq-input !w-24"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {[5, 10, 15, 20].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            {error && (
              <p role="alert" className="hq-error mb-4">
                {error}
              </p>
            )}
            <button
              className="hq-primary w-full"
              disabled={busy || topic.trim().length < 3}
              onClick={() => void generate()}
            >
              <Sparkles size={17} />
              {busy ? "Building your quiz…" : "Generate quiz"}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
