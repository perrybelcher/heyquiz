"use client";

import Link from "next/link";
import WorkspaceHeader from "./WorkspaceHeader";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, GraduationCap, LockKeyhole, Sparkles, Target } from "lucide-react";
import { creationAuthHref } from "@/lib/creation-auth-return";

export function AIAccountGate({ returnTo = "/create/ai" }: { returnTo?: "/create/ai" | "/create/marketing" }) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-9" aria-labelledby="ai-account-title">
      <LockKeyhole className="mb-4 text-red-800" aria-hidden="true" size={26} />
      <h2 id="ai-account-title" className="text-2xl font-semibold tracking-tight text-stone-900">A free account unlocks AI creation</h2>
      <p className="mt-3 max-w-xl leading-7 text-stone-600">Sign in or create your free account to generate and save a quiz with AI. All accounts are free. No charges or credit card required.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="hq-primary" href={creationAuthHref("/signup", returnTo)}>Create free account <ArrowRight size={17} aria-hidden="true" /></Link>
        <Link className="hq-secondary" href={creationAuthHref("/login", returnTo)}>Sign in to continue</Link>
      </div>
      <p className="mt-5 text-sm leading-6 text-stone-600">Prefer to start without an account? <Link className="font-semibold text-red-800 underline underline-offset-4" href="/create">Explore all creation options</Link>.</p>
    </section>
  );
}

export default function AIQuizBuilder({ signedIn, aiAvailable }: { signedIn: boolean; aiAvailable: boolean }) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const pending = useRef(false);
  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signedIn || !aiAvailable || pending.current || topic.trim().length < 3) return;
    pending.current = true;
    setBusy(true); setError(""); setNeedsSignIn(false);
    try {
      const response = await fetch("/api/agent/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), numQuestions: count }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNeedsSignIn(response.status === 401);
        throw new Error(typeof data.error === "string" ? data.error : "We couldn’t create your quiz. Please try again.");
      }
      const id = data?.form?.id;
      if (data.success !== true || typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(id) || data.editorUrl !== `/editor/${id}`) {
        throw new Error("The response could not be confirmed. Check your workspace before trying again; your draft may already have been saved.");
      }
      router.push(`/editor/${id}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "We couldn’t confirm creation. Check your workspace before trying again.");
      pending.current = false; setBusy(false);
    }
  }
  return (
    <><WorkspaceHeader active="overview" />
    <main className="pippi-app min-h-screen bg-[#faf8f5] px-5 py-7 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/create" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-red-800"><ArrowLeft size={16} aria-hidden="true" /> All creation options</Link>
        <header className="mb-8 mt-9">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-800"><Sparkles size={17} aria-hidden="true" /> A head start, with you in control</p>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">Create with AI</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">Choose what your quiz should do. AI creates an editable draft; you review and publish it when it’s ready.</p>
        </header>
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Link href="/create/marketing" className="group rounded-3xl border border-stone-200 bg-white p-6 transition hover:border-red-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-800">
            <Target className="mb-4 text-red-800" size={26} aria-hidden="true" />
            <h2 className="text-xl font-semibold text-stone-900">Recommend, segment, or assess</h2>
            <p className="mt-3 leading-6 text-stone-600">Start with your audience and offer. Build personalized recommendations or a useful scorecard.</p>
            <span className="mt-5 inline-flex items-center gap-2 font-semibold text-red-800">Create a marketing quiz <ArrowRight size={17} aria-hidden="true" /></span>
          </Link>
          <a href={signedIn ? "#knowledge-quiz" : "#ai-account-title"} className="rounded-3xl border border-stone-200 bg-white p-6 transition hover:border-red-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-800">
            <GraduationCap className="mb-4 text-red-800" size={26} aria-hidden="true" />
            <h2 className="text-xl font-semibold text-stone-900">Test knowledge</h2>
            <p className="mt-3 leading-6 text-stone-600">Describe a topic and get questions with correct-answer scoring. Great for learning and training.</p>
            <span className="mt-5 inline-flex items-center gap-2 font-semibold text-red-800">Create a knowledge quiz <ArrowRight size={17} aria-hidden="true" /></span>
          </a>
        </div>
        {!signedIn ? <AIAccountGate /> : (
          <section id="knowledge-quiz" className="scroll-mt-6 rounded-3xl border border-stone-200 bg-white p-6 sm:p-9" aria-labelledby="knowledge-title">
            <h2 id="knowledge-title" className="text-2xl font-semibold tracking-tight text-stone-900">What should your quiz cover?</h2>
            <p className="mt-3 leading-7 text-stone-600">Describe the topic, audience, and difficulty. We’ll save your generated draft and open it in the editor.</p>
            {!aiAvailable ? <div role="status" className="mt-6 rounded-2xl bg-stone-100 p-5 text-stone-700"><p>AI creation is temporarily unavailable. You can still start with a blank quiz or a template.</p><Link href="/create" className="mt-3 inline-block font-semibold text-red-800 underline">Choose another way to create</Link></div> : (
              <form onSubmit={generate} className="mt-6 space-y-5" aria-busy={busy}>
                <label className="block text-sm font-semibold text-stone-800">Quiz brief
                  <textarea className="hq-input mt-2 min-h-36" value={topic} onChange={(event) => setTopic(event.target.value)} minLength={3} maxLength={4000} required disabled={busy} aria-describedby="quiz-brief-hint" placeholder="For example: A beginner quiz on caring for indoor plants, for first-time plant owners." />
                </label>
                <p id="quiz-brief-hint" className="text-sm text-stone-600">Use 3–4,000 characters. Avoid including private customer information.</p>
                <label className="block max-w-xs text-sm font-semibold text-stone-800">Number of questions
                  <select className="hq-input mt-2" value={count} onChange={(event) => setCount(Number(event.target.value))} disabled={busy}>{[5, 10, 15, 20].map((value) => <option key={value} value={value}>{value} questions</option>)}</select>
                </label>
                {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900"><p>{error}</p><Link className="mt-2 inline-block font-semibold underline" href={needsSignIn ? creationAuthHref("/login", "/create/ai") : "/"}>{needsSignIn ? "Sign in to continue" : "Check your workspace"}</Link></div>}
                <button type="submit" className="hq-primary" disabled={busy || topic.trim().length < 3}><Sparkles size={17} aria-hidden="true" />{busy ? "Creating your draft…" : "Generate knowledge quiz"}</button>
                <p role="status" className="text-sm leading-6 text-stone-600">{busy ? "This may take a moment. Keep this page open while your quiz is created." : "Review the generated questions and answer key before publishing. Nothing goes live automatically."}</p>
              </form>
            )}
          </section>
        )}
      </div>
    </main></>
  );
}
