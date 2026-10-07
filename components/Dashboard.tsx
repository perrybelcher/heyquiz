"use client";
import { useState } from "react";
import Link from "next/link";
import { nanoid } from "nanoid";
import {
  Plus,
  Search,
  ArrowUpRight,
  MoreHorizontal,
  Copy,
  Trash2,
  Sparkles,
  Layers,
  FileText,
  LogOut,
  ArrowRight,
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
    <div className="min-h-screen bg-[#f7f8fb] text-slate-900">
      <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 sm:px-10">
        <img src="/logo.png" alt="HeyQuiz" className="h-8" />
        <div className="flex items-center gap-4">
          <span className="hidden sm:block text-sm text-slate-500">
            Your workspace
          </span>
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
      <main className="max-w-6xl mx-auto px-6 py-12 sm:px-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
          <div>
            <p className="text-xs uppercase tracking-[.18em] text-indigo-600 font-semibold mb-3">
              Ask better. Learn more.
            </p>
            <h1 className="text-4xl font-semibold tracking-tight">
              Your quizzes & forms
            </h1>
            <p className="text-slate-500 mt-3">
              Turn a good question into your next great insight.
            </p>
          </div>
          <button
            disabled={busy}
            className="hq-primary"
            onClick={() => void create()}
          >
            <Plus size={18} /> Create new
          </button>
        </div>
        <section className="grid md:grid-cols-[1.6fr_1fr] gap-5 mb-10">
          <div className="bg-[#eef0ff] border border-indigo-100 rounded-2xl p-7 flex gap-5">
            <div className="rounded-xl bg-white w-12 h-12 shrink-0 grid place-items-center text-indigo-600">
              <Sparkles size={23} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Start with an idea</h2>
              <p className="text-sm text-slate-600 mt-2 max-w-lg leading-relaxed">
                Describe what you want to learn. AI can turn your topic into an
                editable quiz, with questions and answer keys.
              </p>
              <button
                className="mt-5 text-sm text-indigo-700 font-semibold flex items-center gap-2"
                onClick={() => {
                  setError("");
                  setAgent(true);
                }}
              >
                Create with AI <ArrowRight size={16} />
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-7">
            <p className="text-xs uppercase tracking-wider text-slate-400 mb-3">
              Built for your next conversation
            </p>
            <div className="text-3xl font-semibold">51 field types</div>
            <p className="text-sm text-slate-500 mt-3 leading-relaxed">
              Branching, scoring, real attachments, and a clear view of every
              response.
            </p>
          </div>
        </section>
        <section aria-label="Marketing quiz templates" className="mb-10">
          <div className="flex flex-wrap justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold">
              Start with a marketing quiz
            </h2>
            <p className="text-sm text-slate-500">
              Editable examples · no live offers or email required
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {(
              [
                [
                  "product_finder",
                  "Product finder",
                  "Match needs to a product, with clear reasons.",
                ],
                [
                  "segmentation",
                  "Buyer segmentation",
                  "Find a priority and recommend a useful next step.",
                ],
                [
                  "scorecard",
                  "Category scorecard",
                  "Assess separate areas with honest coverage.",
                ],
              ] as const
            ).map(([kind, title, description]) => (
              <button
                key={kind}
                disabled={busy}
                onClick={() => void create(undefined, kind)}
                className="text-left bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-400 transition"
              >
                <h3 className="font-semibold">{title} →</h3>
                <p className="text-sm text-slate-500 mt-2">{description}</p>
              </button>
            ))}
          </div>
        </section>
        {error && !agent && (
          <p role="alert" className="hq-error mb-6">
            {error}
          </p>
        )}
        <div className="flex flex-col sm:flex-row justify-between gap-5 mb-6">
          <nav
            aria-label="Filter forms"
            className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit"
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
                className={`text-sm rounded-lg px-4 py-2 transition ${filter === id ? "bg-white shadow-sm font-medium" : "text-slate-500"}`}
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
              placeholder="A beginner quiz on sustainable gardening for new homeowners…"
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
