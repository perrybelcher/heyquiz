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
  singleTypes,
  formatAnswer,
  type Answers,
} from "@/lib/engine";
import { retainFlowAnswers } from "@/lib/flow-answer-state";
import { quizThemeStyle } from "@/lib/theme-style";
import QuestionField from "./QuestionField";
import { playerPages } from "@/lib/player-pages";
import MarketingResultCard from "./MarketingResultCard";
import LeadCapture from "./LeadCapture";
import QuizTracking from "./QuizTracking";
import { metaTokenFor, freshMetaContext } from "@/lib/meta/browser";
import SaveResultLink from "./SaveResultLink";
import QuizLanding from "./QuizLanding";
import EmbedResizeReporter from "./EmbedResizeReporter";
import { useLandingVisit } from "@/hooks/useLandingVisit";
import { collectStartAttribution } from "@/lib/attribution";
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
  embed = false,
  experimentToken,
  experimentId,
}: {
  form: FormSchemaType;
  preview?: boolean;
  embed?: boolean;
  experimentToken?: string;
  experimentId?: string;
}) {
  const embedRoot = useRef<HTMLDivElement>(null);
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
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function cancelAutoAdvance() { if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current); autoAdvanceTimer.current = null; }
  useEffect(() => () => cancelAutoAdvance(), []);
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
  const screens = playerPages(active, visible);
  const screenIndex = Math.max(0, screens.findIndex(items => items.some(item => item.id === q?.id)));
  const screenQuestions = screens[screenIndex] || [];
  const grouped = active.settings.presentation === "page";
  const lastScreen = screenIndex === screens.length - 1;
  const savedSession = useSyncExternalStore(
    () => () => {},
    () => { try { return sessionStorage.getItem(storageKey); } catch { return null; } },
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
  const tokenForStart = useLandingVisit({ target: embedRoot, formId: form.id, preview, embed, experimentId, experimentToken, landingVisible: !session && !result && !resume, resumeStorageKey: resumeDismissed ? undefined : storageKey });
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
  const visibleScreenIds = screenQuestions.map(item => item.id).join("|");
  useEffect(() => {
    if (!session || !q || result) return;
    // Serial writes avoid competing updates to the same attempt on grouped pages.
    void (async () => { for (const questionId of visibleScreenIds.split("|")) await fetch(`/api/forms/${form.id}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: session.token, questionId }),
    }).catch(() => {}); })();
  }, [session?.token, visibleScreenIds, result, form.id]);
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
          token: session.token, metaToken: await metaTokenFor(form.id), metaContext: freshMetaContext(form.id),
          answers: retainFlowAnswers(session.form, latestAnswers.current),
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
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const visitToken = await tokenForStart();
      const res = await fetch(`/api/forms/${form.id}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preview, experimentToken, metaToken: await metaTokenFor(form.id), ...(visitToken ? { visitToken } : {}), ...(!preview ? { attribution: collectStartAttribution(window.location.href, document.referrer) } : {}) }),
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
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function next(nextAnswers: Answers = answers, freshChoice = false) {
    cancelAutoAdvance();
    if (!q || inFlight.current || busy) return;
    // Resolve with the newly selected value; React state may not have rendered yet.
    const nextPath = resolvePath(active, nextAnswers);
    const nextScreens = playerPages(active, nextPath.questions.filter(item => item.type !== "hidden"));
    const position = Math.max(0, nextScreens.findIndex(items => items.some(item => item.id === q.id)));
    const invalid = (nextScreens[position] || []).find(item => validationError(item, nextAnswers[item.id]));
    const validation = invalid ? `${invalid.title}: ${validationError(invalid, nextAnswers[invalid.id])}` : null;
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    if (
      !grouped && active.settings.feedbackMode === "immediate" &&
      (!feedback || freshChoice) &&
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
            answers: nextAnswers,
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
    if (position < nextScreens.length - 1) setCurrentId(nextScreens[position + 1][0].id);
    else if (nextPath.incomplete) setError("This answer has no destination yet. Please contact the quiz creator.");
    else if (active.settings.showReviewBeforeSubmit) setReview(true);
    else void submit();
  }
  function retake() {
    cancelAutoAdvance();
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
    try { sessionStorage.removeItem(storageKey); } catch {}
  }
  const theme = quizThemeStyle(active.theme);
  return (
    <div ref={embedRoot} data-quiz-embed={embed ? "true" : undefined} className={`hq-player flex flex-col ${embed ? "flex-none" : "min-h-screen"}`} style={theme}>
      <header className="min-h-20 gap-4 border-b border-slate-200/70 flex flex-wrap items-center justify-between px-5 py-4 sm:px-10" style={{backgroundColor: active.theme.cardColor || "#ffffff"}}>
        <div className="min-w-0 max-w-[65%]">
          {active.theme.logoUrl ? <img src={active.theme.logoUrl} alt={active.theme.logoAlt?.trim() || active.theme.brandName?.trim() || "Quiz logo"} className="max-w-full object-contain object-left" style={{height: active.theme.logoHeight || 40}} />
            : active.theme.brandName ? <span className="block break-words text-xl font-semibold" style={{fontFamily:theme["--hq-heading-font"]}}>{active.theme.brandName}</span>
            : !active.theme.hidePippiBranding ? <img src="/pippi-logo.svg" alt="pippi" className="h-7" /> : <span className="sr-only">{active.title}</span>}
          {(active.theme.logoUrl || active.theme.brandName) && !active.theme.hidePippiBranding && <span className="mt-1 block text-[10px] opacity-60">Powered by Pippi</span>}
        </div>
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
      <main className={`w-full ${!session && !result ? "max-w-5xl" : "max-w-3xl"} mx-auto px-5 py-12 sm:py-20 flex-1`}>
        {!session && !result ? (
          <QuizLanding form={active} busy={busy} error={error} onStart={() => void start()}
            resume={resume ? { label: resume.result ? "View your results" : "Resume your response", onResume: () => {
              setSession(resume);
              if (resume.result) setResult(resume.result);
              const restoredAnswers = retainFlowAnswers(resume.form, resume.answers);
              latestAnswers.current = restoredAnswers;
              setAnswers(restoredAnswers);
              setCurrentId(resume.currentId);
              setResumeDismissed(true);
            } } : undefined} />
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
                  {preview ? "Preview complete · No response recorded" : "Response received"}
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">
                  {result.matchedTier?.title ||
                    active.endingPage?.title ||
                    "Thank you. You’re all set."}
                </h1>
                <p className="mt-4 text-slate-500 leading-relaxed">
                  {preview ? "Your preview is complete. No response was recorded." : (result.matchedTier?.message ||
                    active.endingPage?.message ||
                    "Your answers have been saved successfully.")}
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
                              <p className="text-sm mt-1 font-medium">
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
              try { const response = await fetch(`/api/forms/${form.id}/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: session.token, metaToken: await metaTokenFor(form.id), metaContext: freshMetaContext(form.id), contact }) }); const data = await response.json(); if (!response.ok) throw Error(data.error || "Could not save. Please try again."); setContactDone(true); const updated = { ...result, contactCaptured: true }; setResult(updated); try { sessionStorage.setItem(storageKey, JSON.stringify({ ...session, answers: {}, result: updated })); } catch {} } catch (e) { setError(e instanceof Error ? e.message : "Could not save. Please try again."); } finally { setBusy(false); inFlight.current = false; }
            }} /></div>}
            {contactDone && <p className="text-sm text-slate-500 mb-4">Your results are ready below.</p>}
            {!preview && session && <SaveResultLink formId={form.id} token={session.token}/>}
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
                        ? `${Math.round(((screenIndex + 1) / Math.max(screens.length, 1)) * 100)}%`
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
                          : `${screenIndex + 1} of ${screens.length}`}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-300"
                      style={{
                        width: `${screens.length ? ((screenIndex + 1) / screens.length) * 100 : 0}%`,
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
                          cancelAutoAdvance();
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
                  {screenQuestions.map((field, fieldIndex) => { const Title = fieldIndex === 0 ? "h1" : "h2"; return <div key={field.id} className={fieldIndex ? "mt-8 pt-6 border-t border-slate-100" : ""}>
                    {!displayTypes.has(field.type) && <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-3">{grouped ? "" : `Question ${index + 1}`}{field.required ? " · Required" : ""}</p>}
                    <Title className="text-2xl font-semibold tracking-tight leading-tight mb-3">{field.title}</Title>
                    {field.description && <p className="text-slate-500 leading-relaxed mb-5">{field.description}</p>}
                    {!["heading", "banner"].includes(field.type) && <QuestionField q={field} value={answers[field.id]} answers={answers} token={session?.token || ""} onChange={value => {
                      cancelAutoAdvance();
                      const updated = retainFlowAnswers(active, { ...answers, [field.id]: value });
                      latestAnswers.current = updated;
                      setFeedback(null); setAnswers(updated); setError("");
                      if (!grouped && singleTypes.has(field.type) && value && !validationError(field, value)) {
                        autoAdvanceTimer.current = setTimeout(() => { void next(updated, true); }, 250);
                      }
                    }} />}
                  </div>; })}
                  {!grouped && singleTypes.has(q.type) && !feedback && <p className="mt-4 text-xs text-slate-500" role="status">{lastScreen && !active.settings.showReviewBeforeSubmit ? "Choosing an answer submits your response." : "Choose an answer to continue automatically. You can go back to change it."}</p>}
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
                      disabled={screenIndex === 0 || busy}
                      onClick={() => {
                        cancelAutoAdvance();
                        setFeedback(null);
                        setCurrentId(screens[screenIndex - 1][0].id);
                        setError("");
                      }}
                    >
                      <ArrowLeft size={16} /> Back
                    </button>
                    {(grouped || !singleTypes.has(q.type) || feedback || answers[q.id] || !q.required) ? <button
                      className="hq-primary"
                      disabled={busy}
                      onClick={() => void next()}
                    >
                      {busy
                        ? "Saving…"
                        : !grouped && active.settings.feedbackMode === "immediate" &&
                            !feedback
                          ? "Check answer"
                          : lastScreen
                            ? active.settings.showReviewBeforeSubmit
                              ? "Review answers"
                              : "Submit response"
                            : "Next"}
                      {lastScreen ? (
                        <Check size={17} />
                      ) : (
                        <ArrowRight size={17} />
                      )}
                    </button> : null}
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
      <QuizTracking experimentToken={experimentToken} form={active} preview={preview} sessionId={session?.token} questionId={!result ? q?.id : undefined} completed={Boolean(result)} leadCaptured={Boolean(result?.contactCaptured)} />
      {!active.theme.hidePippiBranding && <footer className="text-center text-xs py-7">
        Made with pippi · Designed for better conversations
      </footer>}
      {embed && <EmbedResizeReporter target={embedRoot} navigationKey={`${Boolean(session)}:${capturing}:${review}:${Boolean(result)}:${currentId}`} />}
    </div>
  );
}
