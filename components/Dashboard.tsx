"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import WorkspaceWelcome from "./WorkspaceWelcome";
import CreationPaths from "./CreationPaths";
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
  X,
  Plus,
  ArrowRight,
} from "lucide-react";
import type { FormSchemaType } from "@/lib/schema";
import { blankQuiz } from "@/lib/blank-quiz";
import { marketingTemplate } from "@/lib/marketing-templates";
import type { MarketingConfig } from "@/lib/marketing";
import WorkspaceHeader from "./WorkspaceHeader";
import { useInterfaceVersion } from "./v2/InterfaceContext";
export default function Dashboard({
  initialForms,
}: {
  initialForms: FormSchemaType[];
}) {
  const v2 = useInterfaceVersion() === "v2";
  const [forms, setForms] = useState(initialForms),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [agent, setAgent] = useState(false),
    [aiGoal, setAIGoal] = useState<"choose" | "knowledge">("choose"),
    [topic, setTopic] = useState(""),
    [count, setCount] = useState(5),
    [menu, setMenu] = useState<string | null>(null);
  const menuTrigger = useRef<HTMLButtonElement | null>(null);
  const aiDialog = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!agent) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = aiDialog.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); setAgent(false); }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("keydown", keyboard); previous?.focus(); };
  }, [agent, busy]);
  useEffect(() => {
    if (!menu) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Element && !event.target.closest("[data-quiz-menu]")) setMenu(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenu(null); menuTrigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [menu]);
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
        : blankQuiz(id);
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
    <div className={v2 ? "v2-page min-h-screen" : "pippi-app min-h-screen bg-[#f8f9f5] text-slate-900"}>
      <WorkspaceHeader active="overview" />
      <main className={v2 ? "v2-page-inner" : "max-w-7xl mx-auto px-5 py-7 sm:px-10 sm:py-10"}>
        {v2 ? <>
          <header className="v2-page-heading"><div><h1>Your quizzes <span className="v2-beta">Beta</span></h1><p>Create, refine, and share your next conversation.</p></div><div className="v2-heading-actions"><Link href="/templates" className="v2-button">Browse templates</Link><Link href="/create" className="v2-button v2-button-primary"><Plus size={16} aria-hidden="true" />Create quiz</Link></div></header>
          <div className="v2-quiz-summary"><dl aria-label="Workspace overview"><div><dt>Total quizzes</dt><dd>{forms.length}</dd></div><div><dt>Published</dt><dd>{forms.filter(form => form.publishedAt).length}</dd></div><div><dt>In progress</dt><dd>{forms.filter(form => !form.publishedAt).length}</dd></div></dl>{forms[0] && <Link className="v2-recent-link" href={`/editor/${forms[0].id}`}><span>Continue: {forms[0].title}</span><ArrowRight size={15} aria-hidden="true" /></Link>}</div>
          {!forms.length && <section className="mb-8" aria-label="Create your first quiz"><CreationPaths busy={busy} onBlank={() => void create()} onAI={() => { setError(""); setAIGoal("choose"); setAgent(true); }} /></section>}
        </> : <WorkspaceWelcome busy={busy} onCreate={kind=>void create(undefined,kind)} onAI={()=>{setError("");setAIGoal("choose");setAgent(true);}} recentQuiz={forms[0]} projectCount={forms.length} publishedCount={forms.filter(f=>f.publishedAt).length} />}
        {error && !agent && (
          <p role="alert" className="hq-error mb-6">
            {error}
          </p>
        )}
        <div className={`flex flex-col sm:flex-row justify-between gap-5 mb-6 ${v2 ? "v2-quiz-toolbar" : ""}`}>
          <nav
            aria-label="Filter quizzes"
            className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit max-w-full overflow-x-auto"
          >
            {[
              ["all", "All quizzes"],
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
              aria-label="Search your quizzes"
              placeholder="Search quizzes…"
              className="hq-input !pl-10 !py-2.5 !text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        {filtered.length && v2 ? <div className="v2-quiz-list" aria-label="Your quizzes">
          <div className="v2-quiz-list-head" aria-hidden="true"><span>Quiz</span><span>Status</span><span>Questions</span><span className="v2-quiz-updated">Last updated</span><span>Preview</span><span /></div>
          {filtered.map(form => <article key={form.id} className="v2-quiz-row">
            <Link className="v2-quiz-title" href={`/editor/${form.id}`}><span className="v2-quiz-icon">{form.mode === "quiz" ? <Layers size={18} aria-hidden="true" /> : <FileText size={18} aria-hidden="true" />}</span><div><h2>{form.title}</h2><p>{form.description || "Ready for your next question."}</p></div></Link>
            <span className={`v2-quiz-status ${form.publishedAt ? "is-published" : ""}`}>{form.publishedAt ? "Published" : "Draft"}</span>
            <span className="v2-quiz-meta">{form.questions.length} {form.questions.length === 1 ? "question" : "questions"}</span>
            <span className="v2-quiz-meta v2-quiz-updated">{form.updatedAt && Number.isFinite(Date.parse(form.updatedAt)) ? new Date(form.updatedAt).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : "Not yet saved"}</span>
            <Link className="v2-quiz-link" href={`/play/${form.id}${form.publishedAt ? "" : "?preview=1"}`} target="_blank" rel="noopener noreferrer">{form.publishedAt ? "View live" : "Preview"}<ArrowUpRight size={13} aria-hidden="true" /></Link>
            <button type="button" className="hq-icon" data-quiz-menu aria-label={`Actions for ${form.title}`} aria-expanded={menu === form.id} onClick={event => { menuTrigger.current = event.currentTarget; setMenu(menu === form.id ? null : form.id); }}><MoreHorizontal size={18} aria-hidden="true" /></button>
            {menu === form.id && <div data-quiz-menu className="v2-quiz-menu"><button type="button" disabled={busy} onClick={() => void create(form)}><Copy size={15} aria-hidden="true" />Duplicate</button><button type="button" className="text-rose-700" onClick={() => void remove(form.id)}><Trash2 size={15} aria-hidden="true" />Delete quiz</button></div>}
          </article>)}
        </div> : filtered.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((f) => (
              <article
                key={f.id}
                className="quiz-library-card bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-md transition relative group"
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
                        data-quiz-menu
                        aria-expanded={menu === f.id}
                        aria-label={`Actions for ${f.title}`}
                        className="hq-icon text-slate-400"
                        onClick={event => { menuTrigger.current = event.currentTarget; setMenu(menu === f.id ? null : f.id); }}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </div>
                  {menu === f.id && (
                    <div data-quiz-menu className="absolute right-5 top-16 z-10 bg-white rounded-xl border shadow-lg p-2 min-w-40">
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
                  {f.title.trim().toLowerCase() === "untitled quiz" && <p className="mt-3 text-xs text-[#922c3b]">Give this quiz a name in the editor so you can find it again.{f.updatedAt && Number.isFinite(Date.parse(f.updatedAt)) ? ` Updated ${new Date(f.updatedAt).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC.` : ""}</p>}
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
                    Continue editing
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
              {query ? "No matching quizzes" : "A fresh start"}
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              {query
                ? "Try another search or filter."
                : "Create your first quiz to get started."}
            </p>
          </div>
        )}
        {forms.length > 0 && <details className="mt-8 rounded-2xl border border-stone-200 bg-white p-5">
          <summary className="cursor-pointer font-semibold">Start another quiz</summary>
          <div className="mt-5"><CreationPaths busy={busy} onBlank={() => void create()} onAI={() => { setError(""); setAIGoal("choose"); setAgent(true); }} /></div>
        </details>}
      </main>
      {agent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-title"
          className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm grid place-items-center p-5"
        >
          <section ref={aiDialog} className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 sm:p-8">
            <div className="flex justify-between mb-6">
              <Sparkles className="text-indigo-600" />
              <button
                aria-label="Close AI builder"
                disabled={busy}
                onClick={() => setAgent(false)}
              >
                <X />
              </button>
            </div>
            <h2 id="ai-title" className="text-2xl font-semibold mb-3">
              {aiGoal === "choose" ? "What should your quiz do?" : "Create a knowledge quiz"}
            </h2>
            {aiGoal === "choose" ? <div className="space-y-4">
              <p className="text-sm text-slate-600">Start with your goal. We will ask for the right details before writing your draft.</p>
              <a href="/create/marketing" className="block rounded-2xl border border-red-200 bg-red-50 p-5 hover:border-red-400 focus-visible:outline-2 focus-visible:outline-red-800">
                <span className="block font-semibold">Recommend, segment, or assess</span>
                <span className="mt-2 block text-sm text-slate-600">Product finders, audience quizzes, and scorecards built around your audience, offer, and voice.</span>
                <span className="mt-4 block text-sm font-semibold text-red-800">Start with my business →</span>
              </a>
              <button type="button" className="w-full rounded-2xl border border-slate-200 p-5 text-left hover:border-slate-400" onClick={() => { setAIGoal("knowledge"); setError(""); }}>
                <span className="block font-semibold">Test knowledge</span>
                <span className="mt-2 block text-sm text-slate-600">Create questions with correct answers for learning, training, or trivia.</span>
                <span className="mt-4 block text-sm font-semibold">Choose a topic →</span>
              </button>
              <p className="text-sm text-slate-500">Prefer to write it yourself? <a href="/templates" className="underline">Browse templates</a> or <button type="button" className="underline" disabled={busy} onClick={() => { setAgent(false); void create(); }}>start blank</button>.</p>
            </div> : <>
            <button type="button" disabled={busy} className="mb-5 text-sm text-red-800 underline" onClick={() => { setAIGoal("choose"); setError(""); }}>← Choose a different goal</button>
            <p className="text-sm text-slate-500 mb-6">
              Describe the topic and learner level. This creates correct-answer scoring. For personalized recommendations, choose the business option instead.
            </p>
            <textarea
              className="hq-input min-h-32"
              aria-label="Quiz brief"
              placeholder="A beginner gardening knowledge quiz about soil, watering, and plant care. Explain why each correct answer is right…"
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
              {busy ? "Building your quiz…" : "Generate knowledge quiz"}
            </button>
            </>}
          </section>
        </div>
      )}
    </div>
  );
}
