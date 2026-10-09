"use client";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
  useMemo,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  RotateCcw,
  CheckCircle2,
  Send,
  Eye,
} from "lucide-react";
import type {
  FormSchemaType,
  QuizSubmissionResult,
  QuestionGradingResult,
} from "@/lib/schema";
import {
  resolvePath,
  validationError,
  displayTypes,
  formatAnswer,
  type Answers,
} from "@/lib/engine";
import { quizThemeStyle } from "@/lib/theme-style";
import QuestionField from "./QuestionField";
import MarketingResultCard from "./MarketingResultCard";
import LeadCapture from "./LeadCapture";
import QuizTracking from "./QuizTracking";
import type { ContactInput } from "@/lib/contacts";
interface Session {
  result?: QuizSubmissionResult;
  token: string;
  form: FormSchemaType;
  startedAt: number;
  answers: Answers;
  currentId: string;
}
export default function QuizPlayer({
  form,
  preview = false,
  experimentToken,
  experimentId,
}: {
  form: FormSchemaType;
  preview?: boolean;
  experimentToken?: string;
  experimentId?: string;
}) {
  const [capturing, setCapturing] = useState(false), [contactDone, setContactDone] = useState(false);
  const [loadedAt] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<QuestionGradingResult | null>(null);
  const [session, setSession] = useState<Session | null>(null),
    [answers, setAnswers] = useState<Answers>({}),
    [currentId, setCurrentId] = useState(""),
    [review, setReview] = useState(false),
    [result, setResult] = useState<QuizSubmissionResult | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [remaining, setRemaining] = useState<number | null>(null),
    [resumeDismissed, setResumeDismissed] = useState(false);
  const inFlight = useRef(false),
    latestAnswers = useRef(answers);
  useEffect(() => {
    latestAnswers.current = answers;
  }, [answers]);
  const active = session?.form || form;
  let path: ReturnType<typeof resolvePath>;
  try {
    path = resolvePath(active, answers);
  } catch {
    path = { questions: [] };
  }
  const visible = path.questions.filter((q) => q.type !== "hidden"),
    index = Math.max(
      0,
      visible.findIndex((q) => q.id === currentId),
    ),
    q = visible[index],
    storageKey = `heyquiz:${form.id}:${experimentId || (preview ? "preview" : "live")}`;
  const savedSession = useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem(storageKey),
    () => null,
  );
  const resume = useMemo(() => {
    if (!savedSession || resumeDismissed) return null;
    try {
      const saved: Session = JSON.parse(savedSession);
      return saved.startedAt + 86400000 > loadedAt ? saved : null;
    } catch {
      return null;
    }
  }, [savedSession, resumeDismissed, loadedAt]);
  useEffect(() => {
    if (!session || result) return;
    try {
      const safe = Object.fromEntries(
        Object.entries(answers).filter(
          ([id]) =>
            active.questions.find((q) => q.id === id)?.type !== "password",
        ),
      );
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ ...session, answers: safe, currentId }),
      );
    } catch {}
  }, [session, answers, currentId, result, storageKey, active]);
  useEffect(() => {
    if (!session || !q || result) return;
    void fetch(`/api/forms/${form.id}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: session.token, questionId: q.id }),
    }).catch(() => {});
  }, [session?.token, q?.id, result, form.id]);
  const trackResult = useCallback((event: "result_view" | "offer_click") => {
    if (!session || preview) return;
    if (event === "offer_click") window.dispatchEvent(new Event("heyquiz-offer-click"));
    void fetch(`/api/forms/${form.id}/progress`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: session.token, event }), keepalive: true,
    }).catch(() => {});
  }, [session, preview, form.id]);
  useEffect(() => { if (result) trackResult("result_view"); }, [result, trackResult]);
  const submit = useCallback(async (contact?: ContactInput | null) => {
    if (!session || inFlight.current) return;
    if (session.form.capture?.enabled && session.form.capture.placement === "before_results" && contact === undefined) { setCapturing(true); return; }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/forms/${form.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: session.token,
          answers: latestAnswers.current,
          contact,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Could not save your response.");
      setResult(data);
      setCapturing(false);
      try { sessionStorage.setItem(storageKey, JSON.stringify({ ...session, answers: {}, result: data })); } catch {}
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not submit. Your answers are still here.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [session, form.id, storageKey]);
  useEffect(() => {
    if (!session || result || !session.form.settings.timerMinutes) return;
    const deadline =
      session.startedAt + session.form.settings.timerMinutes * 60000;
    let expired = false;
    const tick = () => {
      const value = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(value);
      if (value === 0 && !expired) {
        expired = true;
        void submit();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session, result, submit]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/forms/${form.id}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preview, experimentToken }),
        }),
        data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const initial: Answers = {};
      const params = new URLSearchParams(location.search);
      for (const question of data.form
        .questions as FormSchemaType["questions"]) {
        if (question.type === "hidden")
          initial[question.id] =
            params.get(question.hiddenParamName || "") || "";
        if (question.type === "ranking")
          initial[question.id] = question.items || [];
        if (question.type === "slider")
          initial[question.id] = question.minVal ?? 0;
        if (question.type === "color_picker") initial[question.id] = "#4f46e5";
      }
      const first =
        resolvePath(data.form, initial).questions.find(
          (q) => q.type !== "hidden",
        )?.id || "";
      setAnswers(initial);
      setCurrentId(first);
      setSession({ ...data, answers: initial, currentId: first });
      setResumeDismissed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start.");
    } finally {
      setBusy(false);
    }
  }
  async function next() {
    if (!q) return;
    const validation = validationError(q, answers[q.id]);
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    if (
      active.settings.feedbackMode === "immediate" &&
      !feedback &&
      !displayTypes.has(q.type)
    ) {
      setBusy(true);
      try {
        const response = await fetch(`/api/forms/${form.id}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: session?.token,
            questionId: q.id,
            answers,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (data?.maxPoints > 0) {
          setFeedback(data);
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Feedback could not load.");
        return;
      } finally {
        setBusy(false);
      }
    }
    setFeedback(null);
    if (index < visible.length - 1) setCurrentId(visible[index + 1].id);
    else if (active.settings.showReviewBeforeSubmit) setReview(true);
    else void submit();
  }
  function retake() {
    setFeedback(null);
    setSession(null);
    setCapturing(false); setContactDone(false);
    setResult(null);
    setAnswers({});
    setCurrentId("");
    setReview(false);
    setResumeDismissed(true);
    setRemaining(null);
    setError("");
    sessionStorage.removeItem(storageKey);
  }
  const theme = quizThemeStyle(active.theme);
  return (
    <div className="hq-player min-h-screen flex flex-col" style={theme}>
      <header className="h-20 border-b border-slate-200/70 bg-white/85 flex items-center justify-between px-5 sm:px-10">
        <img src="/pippi-logo.svg" alt="pippi" className="h-7" />
        <div className="flex items-center gap-4 text-xs text-slate-500">
          {preview && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-3 py-1.5">
              <Eye size={13} /> Preview · responses aren’t saved
            </span>
          )}
          {remaining !== null && session && !result && (
            <span className="flex gap-1.5 items-center font-mono">
              <Clock size={14} />
              {Math.floor(remaining / 60)}:
              {String(remaining % 60).padStart(2, "0")}
            </span>
          )}
        </div>
      </header>
      <main className="w-full max-w-3xl mx-auto px-5 py-12 sm:py-20 flex-1">
        {!session && !result ? (
          <section className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            {active.coverPage?.imageUrl && (
              <img
                src={active.coverPage.imageUrl}
                alt="Quiz cover"
                className="h-56 w-full object-cover"
              />
            )}
            <div className="p-7 sm:p-12">
              <p className="text-xs uppercase tracking-[.18em] text-indigo-600 font-semibold mb-5">
                {active.mode === "quiz"
                  ? "A little curiosity goes a long way"
                  : "We’d love to hear from you"}
              </p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
                {active.coverPage?.enabled
                  ? active.coverPage.title
                  : active.title}
              </h1>
              <p className="text-slate-500 mt-5 leading-relaxed">
                {active.coverPage?.subtitle || active.description}
              </p>
              <div className="flex gap-5 text-sm text-slate-500 mt-7">
                <span>
                  {
                    active.questions.filter((q) => !displayTypes.has(q.type))
                      .length
                  }{" "}
                  questions
                </span>
                {active.coverPage?.estimatedMinutes && (
                  <span>About {active.coverPage.estimatedMinutes} minutes</span>
                )}
              </div>
              {error && (
                <p role="alert" className="hq-error mt-5">
                  {error}
                </p>
              )}
              {active.capture?.enabled && active.capture.required && <p className="text-sm text-slate-500 mt-5">Contact details are required to view your results. Marketing emails are optional.</p>}
              <div className="flex gap-3 mt-9">
                {resume && (
                  <button
                    className="hq-primary"
                    onClick={() => {
                      setSession(resume);
                      if (resume.result) setResult(resume.result);
                      setAnswers(resume.answers);
                      setCurrentId(resume.currentId);
                      setResumeDismissed(true);
                    }}
                  >
                    {resume.result ? "View your results" : "Resume your response"} <ArrowRight size={17} />
                  </button>
                )}
                <button
                  disabled={busy}
                  className={resume ? "hq-secondary" : "hq-primary"}
                  onClick={() => void start()}
                >
                  {busy
                    ? "Preparing…"
                    : resume
                      ? "Start over"
                      : active.coverPage?.buttonText || "Let’s begin"}
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </section>
        ) : capturing && active.capture ? (
          <LeadCapture config={active.capture} busy={busy} error={error} onSubmit={value => void submit(value)} onSkip={active.capture.required ? undefined : () => void submit(null)} />
        ) : result ? (
          <section className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 text-center shadow-sm">
            {result.marketing ? (
              <MarketingResultCard result={result.marketing} onOfferClick={() => trackResult("offer_click")} />
            ) : (
              <>
                <div className="mx-auto grid place-items-center rounded-2xl bg-emerald-50 text-emerald-600 w-16 h-16 mb-6">
                  <CheckCircle2 size={32} />
                </div>
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">
                  Response received
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">
                  {result.matchedTier?.title ||
                    active.endingPage?.title ||
                    "Thank you. You’re all set."}
                </h1>
                <p className="mt-4 text-slate-500 leading-relaxed">
                  {result.matchedTier?.message ||
                    active.endingPage?.message ||
                    "Your answers have been saved successfully."}
                </p>
                {result.totalPointsPossible > 0 && (
                  <div className="mt-8">
                    <div className="text-6xl font-semibold tracking-tight text-indigo-600">
                      {result.percentageScore}
                      <span className="text-3xl">%</span>
                    </div>
                    <p className="text-slate-500 mt-2">
                      {result.totalPointsEarned} of {result.totalPointsPossible}{" "}
                      points
                    </p>
                  </div>
                )}
                {active.settings.showAnswerKeyOnFinish &&
                  result.grading.length > 0 && (
                    <details className="text-left mt-8 border-t border-slate-100 pt-6">
                      <summary className="font-medium cursor-pointer">
                        Review your answers
                      </summary>
                      <div className="mt-4 space-y-4">
                        {result.grading.map((g) => (
                          <div
                            key={g.questionId}
                            className="p-4 bg-slate-50 rounded-xl"
                          >
                            <p className="font-medium">{g.questionTitle}</p>
                            <p className="text-sm text-slate-600 mt-2">
                              Your answer: {g.userAnswer}
                            </p>
                            {g.correctAnswer && (
                              <p className="text-sm mt-1 text-emerald-700">
                                Answer: {g.correctAnswer}
                              </p>
                            )}
                            {g.explanation && (
                              <p className="text-sm text-slate-500 mt-2">
                                {g.explanation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
              </>
            )}
            {(active.endingPage?.allowRetake ??
              active.settings.allowRetake) && (
              <button className="hq-secondary mt-8" onClick={retake}>
                <RotateCcw size={16} /> Take it again
              </button>
            )}
            {!result.marketing &&
              (result.matchedTier?.ctaUrl || active.endingPage?.redirectUrl) &&
              /^https?:\/\//.test(
                result.matchedTier?.ctaUrl ||
                  active.endingPage?.redirectUrl ||
                  "",
              ) && (
                <a
                  className="hq-primary mt-8 ml-3"
                  onClick={() => trackResult("offer_click")}
                  href={
                    result.matchedTier?.ctaUrl || active.endingPage?.redirectUrl
                  }
                >
                  {result.matchedTier?.ctaText ||
                    active.endingPage?.buttonText ||
                    "Continue"}
                  <ArrowRight size={16} />
                </a>
              )}
            {active.capture?.enabled && active.capture.placement === "after_results" && !contactDone && !result.contactCaptured && <div className="mt-8"><LeadCapture config={active.capture} busy={busy} error={error} onSkip={() => setContactDone(true)} onSubmit={async contact => {
              if (!session || inFlight.current) return; inFlight.current = true; setBusy(true); setError("");
              try { const response = await fetch(`/api/forms/${form.id}/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: session.token, contact }) }); const data = await response.json(); if (!response.ok) throw Error(data.error || "Could not save. Please try again."); setContactDone(true); const updated = { ...result, contactCaptured: true }; setResult(updated); try { sessionStorage.setItem(storageKey, JSON.stringify({ ...session, answers: {}, result: updated })); } catch {} } catch (e) { setError(e instanceof Error ? e.message : "Could not save. Please try again."); } finally { setBusy(false); inFlight.current = false; }
            }} /></div>}
            {contactDone && <p className="text-sm text-slate-500 mb-4">Your results are ready below.</p>}
          </section>
        ) : review ? (
          <section className="bg-white rounded-3xl border border-slate-200 p-8">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3">
              One last look
            </p>
            <h1 className="text-3xl font-semibold mb-7">Review your answers</h1>
            <div className="divide-y divide-slate-100">
              {visible
                .filter((q) => !displayTypes.has(q.type))
                .map((question) => (
                  <div key={question.id} className="py-4 flex gap-4">
                    <div className="flex-1">
                      <p className="font-medium">{question.title}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        {formatAnswer(question, answers[question.id])}
                      </p>
                    </div>
                    <button
                      className="text-sm text-indigo-600"
                      onClick={() => {
                        setCurrentId(question.id);
                        setReview(false);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                ))}
            </div>
            {error && (
              <p role="alert" className="hq-error">
                {error}
              </p>
            )}
            <button
              className="hq-primary mt-7"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? "Saving…" : "Submit response"}
              <Send size={16} />
            </button>
          </section>
        ) : (
          <section>
            {active.settings.showProgressBar !== false &&
              active.settings.progressBarMode !== "none" && (
                <div className="mb-8">
                  <div className="flex justify-between text-xs text-slate-500 mb-3">
                    <span>
                      {active.pages?.find((p) => p.id === q?.pageId)?.title ||
                        active.title}
                    </span>
                    <span>
                      {active.settings.progressBarMode === "percentage" ||
                      !active.settings.progressBarMode
                        ? `${Math.round(((index + 1) / Math.max(visible.length, 1)) * 100)}%`
                        : active.settings.progressBarMode === "pages" &&
                            active.pages?.length
                          ? `Page ${
                              Math.max(
                                0,
                                active.pages.findIndex(
                                  (p) => p.id === q?.pageId,
                                ),
                              ) + 1
                            } of ${active.pages.length}`
                          : `${index + 1} of ${visible.length}`}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-300"
                      style={{
                        width: `${visible.length ? ((index + 1) / visible.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            {active.settings.enablePageJumps &&
              (active.pages?.length || 0) > 1 && (
                <nav
                  aria-label="Quiz pages"
                  className="flex gap-2 flex-wrap mb-5"
                >
                  {active.pages?.map((page) => {
                    const target = visible.findIndex(
                      (item) => item.pageId === page.id,
                    );
                    return target < 0 ? null : (
                      <button
                        key={page.id}
                        disabled={busy || target > index}
                        className="hq-secondary"
                        onClick={() => {
                          setCurrentId(visible[target].id);
                          setFeedback(null);
                          setError("");
                        }}
                      >
                        {page.title}
                      </button>
                    );
                  })}
                </nav>
              )}
            <div
              key={q?.id}
              className="hq-question-enter bg-white border border-slate-200 shadow-sm rounded-3xl p-7 sm:p-10"
            >
              {q ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-5">
                    Question {index + 1}
                    {q.required && !displayTypes.has(q.type)
                      ? " · Required"
                      : ""}
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight mb-3">
                    {q.title}
                  </h1>
                  {q.description && (
                    <p className="text-slate-500 leading-relaxed mb-7">
                      {q.description}
                    </p>
                  )}
                  <div className="mt-7">
                    <QuestionField
                      key={q.id}
                      q={q}
                      value={answers[q.id]}
                      answers={answers}
                      token={session?.token || ""}
                      onChange={(value) => {
                        setFeedback(null);
                        setAnswers((prev) => ({ ...prev, [q.id]: value }));
                        setError("");
                      }}
                    />
                  </div>
                  {feedback && (
                    <div
                      role="status"
                      className="rounded-xl bg-indigo-50 p-4 mt-5"
                    >
                      <p className="font-semibold">
                        {feedback.isCorrect ? "Correct!" : "Not quite."}
                      </p>
                      <p className="text-sm mt-1">
                        {feedback.explanation || feedback.correctAnswer}
                      </p>
                    </div>
                  )}
                  {error && (
                    <p role="alert" className="hq-error mt-5">
                      {error}
                    </p>
                  )}
                  <div className="flex justify-between items-center mt-9 pt-6 border-t border-slate-100">
                    <button
                      className="hq-secondary"
                      disabled={index === 0 || busy}
                      onClick={() => {
                        setFeedback(null);
                        setCurrentId(visible[index - 1].id);
                        setError("");
                      }}
                    >
                      <ArrowLeft size={16} /> Back
                    </button>
                    <button
                      className="hq-primary"
                      disabled={busy}
                      onClick={next}
                    >
                      {busy
                        ? "Saving…"
                        : active.settings.feedbackMode === "immediate" &&
                            !feedback
                          ? "Check answer"
                          : index === visible.length - 1
                            ? active.settings.showReviewBeforeSubmit
                              ? "Review answers"
                              : "Submit response"
                            : "Continue"}
                      {index === visible.length - 1 ? (
                        <Check size={17} />
                      ) : (
                        <ArrowRight size={17} />
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <p>
                  No questions are available. Please contact the quiz owner.
                </p>
              )}
            </div>
          </section>
        )}
      </main>
      <QuizTracking form={active} preview={preview} sessionId={session?.token} questionId={!result ? q?.id : undefined} completed={Boolean(result)} leadCaptured={Boolean(result?.contactCaptured)} />
      <footer className="text-center text-xs text-slate-400 py-7">
        Made with pippi · Designed for better conversations
      </footer>
    </div>
  );
}
