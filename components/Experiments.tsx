"use client";
import WorkspaceHeader from "./WorkspaceHeader";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FlaskConical, ArrowLeft, RefreshCw, Copy, Pause, Play, ClipboardCheck } from "lucide-react";
import ExperimentEvidenceCard from "@/components/ExperimentEvidenceCard";
import { EXPERIMENT_EVIDENCE_HEADER, EXPERIMENT_EVIDENCE_PROOF_LIMIT, parseExperimentEvidence, parseExperimentEvidenceResponse, type ExperimentEvidence, type ExperimentEvidenceHandoff } from "@/lib/experiment-evidence";
import { ExperimentLaunchSchema, experimentMetricLabels, experimentMetricRate, experimentPlanObservation, type ExperimentLaunch, type ExperimentMetricCounts, type ExperimentPlan, type ExperimentPrimaryMetric } from "@/lib/experiment-plan";

type Published = { id: string; title: string; captureEnabled: boolean; snapshotKey: string };
type Test = { id: string; name: string; active: boolean; titles: string[]; stats: ExperimentMetricCounts[]; plan?: ExperimentPlan; evidence?: ExperimentEvidence };
type Listing = { forms: Published[]; experiments: Test[] };
type Review = { launch: ExperimentLaunch; titles: string[]; evidence?: ExperimentEvidence; evidenceKey?: string };
type EvidenceRead = { key: string; evidence: ExperimentEvidence | null; error: string };
const percent = (rate: number | null) => rate === null ? "Not measured" : `${rate.toFixed(1)}%`;

function PlanSummary({ plan }: { plan: ExperimentPlan }) {
  return <dl className="mt-4 space-y-4 text-sm">
    <div><dt className="font-semibold">Hypothesis</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-700">{plan.hypothesis}</dd></div>
    <div><dt className="font-semibold">Intended one change</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-700">{plan.intendedChange}</dd></div>
    <div><dt className="font-semibold">Primary metric</dt><dd className="mt-1 text-slate-700">{experimentMetricLabels[plan.primaryMetric]} per assigned browser that starts the quiz.</dd></div>
    <div><dt className="font-semibold">Completion guardrail</dt><dd className="mt-1 text-slate-700">{plan.completionFloor === undefined ? "No completion floor set." : `Review observed completion below ${plan.completionFloor}%. This is a review signal, not proof of harm or a stopping rule.`}</dd>{plan.primaryMetric === "completions" && plan.completionFloor !== undefined && <dd className="mt-1 text-slate-600">The floor uses the same metric as your primary goal; it is not an independent measure.</dd>}</div>
    <div><dt className="font-semibold">Review reminder</dt><dd className="mt-1 text-slate-700">{plan.reviewDate ? `${plan.reviewDate} (UTC). A date to review the evidence; no automatic stop or notification.` : "No review date set."}</dd></div>
  </dl>;
}

export default function Experiments({ handoff = null, handoffError = "" }: { handoff?: ExperimentEvidenceHandoff | null; handoffError?: string }) {
  const handoffKey = JSON.stringify(handoff);
  const [removedHandoff, setRemovedHandoff] = useState<string | null>(null);
  const attached = handoff && removedHandoff !== handoffKey ? handoff : null;
  const [data, setData] = useState<Listing>({ forms: [], experiments: [] });
  const [name, setName] = useState(""), [manualA, setA] = useState(handoff?.formId || ""), [b, setB] = useState("");
  const a = attached?.formId || manualA;
  const [planChoice, setWithPlan] = useState(Boolean(handoff)), [hypothesis, setHypothesis] = useState(handoff ? "Clarifying this step may help more participants finish, if its wording is difficult to understand." : ""), [intendedChange, setIntendedChange] = useState("");
  const withPlan = Boolean(attached) || planChoice;
  const [primaryMetric, setPrimaryMetric] = useState<ExperimentPrimaryMetric>("completions"), [floor, setFloor] = useState(""), [reviewDate, setReviewDate] = useState("");
  const [reviewState, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const listingRequest = useRef(0);
  const [listingReady, setListingReady] = useState(false);
  const [evidenceRead, setEvidenceRead] = useState<EvidenceRead | null>(null);
  const [evidenceLoadingKey, setEvidenceLoadingKey] = useState<string | null>(null);
  const evidenceRequest = useRef(0), evidenceAbort = useRef<AbortController | null>(null), autoEvidenceKey = useRef("");
  // The bearer stays only in this volatile ref: never URL, props, storage, display or logging.
  const evidenceProof = useRef<{ key: string; value: string } | null>(null);
  const sourceSnapshot = data.forms.find(form => form.id === attached?.formId)?.snapshotKey || "";
  const evidenceKey = attached ? `${handoffKey}:${sourceSnapshot}` : "";
  const evidenceLoading = evidenceLoadingKey === evidenceKey;
  const currentEvidence = evidenceRead?.key === evidenceKey ? evidenceRead.evidence : null;
  const evidenceError = evidenceRead?.key === evidenceKey ? evidenceRead.error : "";
  const evidenceReady = Boolean(currentEvidence && !evidenceLoading);
  const review = reviewState && Boolean(attached) === Boolean(reviewState.evidence) && (!attached || reviewState.evidenceKey === evidenceKey && evidenceReady) ? reviewState : null;
  const evidenceContext = useRef({ attached, key: evidenceKey, sourceSnapshot });
  useLayoutEffect(() => { evidenceContext.current = { attached, key: evidenceKey, sourceSnapshot }; }, [attached, evidenceKey, sourceSnapshot]);
  function invalidateEvidence(message: string) {
    evidenceRequest.current++; evidenceAbort.current?.abort(); evidenceProof.current = null;
    setEvidenceLoadingKey(null); setReview(null);
    setEvidenceRead({ key: evidenceContext.current.key, evidence: null, error: message });
  }
  const readEvidence = useCallback(async () => {
    const context = evidenceContext.current;
    if (!context.attached) return;
    const request = ++evidenceRequest.current;
    evidenceAbort.current?.abort(); const controller = new AbortController(); evidenceAbort.current = controller;
    evidenceProof.current = null; setReview(null); setEvidenceLoadingKey(context.key); setEvidenceRead(null); setError(""); setNotice("");
    try {
      if (!context.sourceSnapshot) throw new Error("The source quiz is not currently published. Publish it with the selected wording, then refresh published versions, or remove this evidence.");
      const response = await fetch(`/api/forms/${encodeURIComponent(context.attached.formId)}/experiment-evidence`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(context.attached.selector), signal: controller.signal, cache: "no-store" });
      const body: unknown = await response.json();
      if (request !== evidenceRequest.current || controller.signal.aborted || evidenceContext.current.key !== context.key) return;
      if (!response.ok) throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Could not verify the selected evidence. Refresh explicitly or remove it to plan manually.");
      const { evidence } = parseExperimentEvidenceResponse(body);
      const requested = context.attached.selector;
      if (evidence.formId !== context.attached.formId || evidence.questionId !== requested.questionId || evidence.wordingKey !== requested.wordingKey || evidence.sourceSnapshot !== context.sourceSnapshot || evidence.requested.range !== requested.range || JSON.stringify(evidence.requested.filters) !== JSON.stringify(requested.filters)) throw new Error("The evidence does not match the selected published version and cohort. Refresh the versions and evidence before reviewing.");
      const proof = response.headers.get(EXPERIMENT_EVIDENCE_HEADER);
      if (!proof || proof.length > EXPERIMENT_EVIDENCE_PROOF_LIMIT || /[\r\n]/.test(proof)) throw new Error("Evidence verification is unavailable. Refresh explicitly, or remove the evidence to plan manually.");
      evidenceProof.current = { key: context.key, value: proof };
      setEvidenceRead({ key: context.key, evidence, error: "" });
    } catch (reason) {
      if (request === evidenceRequest.current && !controller.signal.aborted && evidenceContext.current.key === context.key) setEvidenceRead({ key: context.key, evidence: null, error: reason instanceof Error ? reason.message : "Could not verify the evidence." });
    } finally { if (request === evidenceRequest.current && evidenceContext.current.key === context.key) setEvidenceLoadingKey(null); }
  }, []);
  const versionAControl = useRef<HTMLSelectElement>(null), reviewScrollFrame = useRef<number | null>(null);
  useEffect(() => () => { if (reviewScrollFrame.current !== null) cancelAnimationFrame(reviewScrollFrame.current); }, []);
  function revealReviewAction(control: HTMLButtonElement) {
    if (reviewScrollFrame.current !== null) cancelAnimationFrame(reviewScrollFrame.current);
    if (!control.matches(":focus-visible")) return;
    // Some native focus scrolling leaves a few pixels clipped. Never move focus,
    // or scroll on behalf of a control the creator has already left.
    reviewScrollFrame.current = requestAnimationFrame(() => {
      reviewScrollFrame.current = null;
      if (!control.isConnected || document.activeElement !== control || !control.matches(":focus-visible")) return;
      const bounds = control.getBoundingClientRect();
      if (bounds.top < 0 || bounds.bottom > innerHeight || bounds.left < 0 || bounds.right > innerWidth) control.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    });
  }
  const inFlight = useRef(false), reviewHeading = useRef<HTMLHeadingElement>(null), setupButton = useRef<HTMLButtonElement>(null), errorBox = useRef<HTMLParagraphElement>(null);
  const load = useCallback(async () => {
    const request = ++listingRequest.current;
    try {
      const response = await fetch("/api/experiments"), body = await response.json();
      if (request !== listingRequest.current) return false;
      if (!response.ok) throw new Error(body.error || "Could not load experiments.");
      const next = body as Listing;
      if (!next || !Array.isArray(next.forms) || !Array.isArray(next.experiments)) throw new Error("Could not read the experiment list. Refresh results to try again.");
      // New aggregate fields are validated before display; malformed evidence is never accepted as reviewed data.
      next.experiments = next.experiments.map(test => test.evidence === undefined ? test : { ...test, evidence: parseExperimentEvidence(test.evidence) });
      setData(next); setListingReady(true); return true;
    } catch (reason) { if (request !== listingRequest.current) return false; throw reason; }
  }, []);
  useEffect(() => {
    let mounted = true;
    const sequence = listingRequest;
    void Promise.resolve().then(() => mounted && load()).catch(reason => { if (mounted) setError(reason instanceof Error ? reason.message : "Could not load experiments."); });
    return () => { mounted = false; sequence.current++; };
  }, [load]);
  useEffect(() => {
    if (!listingReady || !attached || autoEvidenceKey.current === handoffKey) return;
    autoEvidenceKey.current = handoffKey;
    void Promise.resolve().then(() => readEvidence());
  }, [listingReady, attached, handoffKey, readEvidence]);
  useEffect(() => {
    const request = evidenceRequest, controller = evidenceAbort, proof = evidenceProof;
    return () => { request.current++; controller.current?.abort(); proof.current = null; };
  }, [evidenceKey]);
  useEffect(() => { if (review) reviewHeading.current?.focus(); }, [review]);
  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);
  const selected = [data.forms.find(form => form.id === a), data.forms.find(form => form.id === b)];
  const canCapture = selected.every(form => form?.captureEnabled);

  async function change(url: string, method: "POST" | "PATCH", body: unknown, confirmation?: Review) {
    if (inFlight.current) return;
    if (method === "POST" && attached && (!confirmation?.evidence || confirmation.evidenceKey !== evidenceKey || !evidenceReady || evidenceProof.current?.key !== evidenceKey)) { setReview(null); setError("Refresh and review the supporting evidence before launching this test."); return; }
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json", ...(confirmation?.evidence && evidenceProof.current ? { [EXPERIMENT_EVIDENCE_HEADER]: evidenceProof.current.value } : {}) }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) {
        if (confirmation?.evidence && [400, 401, 403, 404, 409, 410, 422].includes(response.status)) invalidateEvidence("The supporting evidence needs a new review. Refresh published versions and evidence, or remove it; your hypothesis and intended change have been kept.");
        throw new Error(result.error || "Please try again.");
      }
      // The write succeeded. A later refresh failure must not invite a duplicate launch.
      if (method === "POST") { setReview(null); setName(""); setA(""); setB(""); if (attached) { setRemovedHandoff(handoffKey); evidenceProof.current = null; window.history.replaceState(window.history.state, "", "/experiments"); } }
      setNotice(method === "POST" ? "Experiment created. Share its test link to split visitors between the frozen versions." : "Experiment updated.");
      try { await load(); } catch { setError("Your change was saved, but the list could not refresh. Use Refresh results to see it."); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Please try again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  function cancelReview() { setReview(null); requestAnimationFrame(() => setupButton.current?.focus()); }
  function prepare() {
    setError(""); setNotice("");
    if (attached && !evidenceReady) { setError("Refresh the supporting evidence before reviewing this test, or remove it to use the manual plan."); return; }
    const candidate = {
      name, a, b,
      ...(withPlan ? {
        plan: { version: 1, hypothesis, intendedChange, primaryMetric, ...(floor !== "" ? { completionFloor: Number(floor) } : {}), ...(reviewDate ? { reviewDate } : {}) },
        reviewedSnapshots: selected.map(form => form?.snapshotKey),
      } : {}),
    };
    const parsed = ExperimentLaunchSchema.safeParse(candidate);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Check your test plan."); return; }
    if (withPlan && primaryMetric === "leads" && !canCapture) { setError("Captured-contact rate needs contact capture enabled in both published versions. Choose completion rate or update and republish your quizzes."); return; }
    if (withPlan) setReview({ launch: parsed.data, titles: selected.map(form => form!.title), ...(attached && currentEvidence ? { evidence: currentEvidence, evidenceKey } : {}) });
    else void change("/api/experiments", "POST", parsed.data);
  }
  async function refresh() {
    if (inFlight.current) return;
    setReview(null); setError("");
    if (attached) invalidateEvidence("Published versions refreshed. Refresh evidence explicitly, then review your plan again. Your text has been kept.");
    try { if (await load()) setNotice("Published versions and results refreshed. Review your plan again before launching."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not refresh experiments."); }
  }
  function removeEvidence() {
    invalidateEvidence(""); setA(attached?.formId || manualA); setRemovedHandoff(handoffKey);
    setNotice("Supporting evidence removed. Your plan text is unchanged; you can choose both versions manually.");
    window.history.replaceState(window.history.state, "", "/experiments");
    requestAnimationFrame(() => versionAControl.current?.focus());
  }
  return <><WorkspaceHeader active="more" /><main className="mx-auto w-full min-w-0 max-w-6xl px-5 py-10 text-slate-900">
    <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16} aria-hidden="true"/>Workspace</Link>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-semibold text-red-800"><FlaskConical size={18} aria-hidden="true"/>Conversion experiments</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Find the words that work.</h1><p className="mt-3 max-w-2xl text-slate-600">Compare two published quiz versions with an approximately 50/50 random split. Change one thing at a time for a clearer comparison.</p></div><button className="hq-secondary" disabled={busy} onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true"/>Refresh results</button></div>
    {handoffError && <p role="alert" className="my-5 rounded-xl bg-amber-50 p-4 text-amber-900">{handoffError}</p>}
    {error && <p ref={errorBox} tabIndex={-1} role="alert" className="my-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {notice && <p role="status" className="my-5 rounded-xl bg-green-50 p-4 text-green-800">{notice}</p>}
    <form className="my-8 rounded-2xl border bg-white p-5 sm:p-6" onSubmit={event => { event.preventDefault(); if (review) void change("/api/experiments", "POST", review.launch, review); else prepare(); }}>
      <h2 className="text-xl font-semibold">Create an A/B test</h2><p className="mt-2 text-sm text-slate-600">Duplicate your quiz, change the question or result copy, then publish both versions. Launching freezes both versions for this test; later editor changes won’t affect it.</p>
      {attached && <section aria-label="Evidence selection" className="my-5 min-w-0 space-y-4">
        <p className="text-sm text-slate-700">The selected Results step is attached to Version A. Choose and publish your comparison quiz separately; Pippi does not create or change a variant for you.</p>
        {evidenceLoading ? <p role="status" className="rounded-xl border border-stone-200 p-4 text-sm text-slate-700">Verifying the published step and its session cohort…</p> : currentEvidence ? review ? <p className="text-sm text-slate-700">The verified observation is included in your launch review below.</p> : <ExperimentEvidenceCard evidence={currentEvidence}/> : <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{evidenceError || "This evidence has not been verified for the selected published version. Refresh evidence to continue."}</p>}
        <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => void readEvidence()} className="hq-secondary"><RefreshCw size={16} aria-hidden="true"/>Refresh evidence</button><button type="button" disabled={busy} onClick={removeEvidence} className="hq-secondary">Remove evidence</button></div>
        <p className="text-xs leading-relaxed text-slate-600">Refreshing replaces the observation and cancels any launch review; your hypothesis and intended change stay as written. Verification expires after 15 minutes. If the exact wording or publication is unavailable, resolve it in Results or remove the evidence to plan manually.</p>
      </section>}
      <fieldset disabled={busy || Boolean(review)} className="min-w-0">
        <legend className="sr-only">Choose versions and optional plan</legend>
        <div className="my-5 grid grid-cols-1 gap-4 md:grid-cols-3"><label className="text-sm font-medium">Test name<input className="mt-2 block w-full rounded-lg border p-3" required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Result headline test"/></label>{([['A', a, setA], ['B', b, setB]] as const).map(([label, value, set]) => <label key={label} className="min-w-0 text-sm font-medium">Version {label}<select title={data.forms.find(form => form.id === value)?.title} ref={label === "A" ? versionAControl : undefined} aria-label={`Version ${label}`} disabled={Boolean(attached) && label === "A"} required className="mt-2 block w-full min-w-0 max-w-full truncate rounded-lg border p-3" value={value} onChange={event => set(event.target.value)}><option value="">Choose a published quiz</option>{attached && label === "A" && !data.forms.some(form => form.id === a) && <option value={a}>Selected source is unavailable</option>}{data.forms.map(form => <option key={form.id} value={form.id}>{form.title} · {form.id.slice(-6)}</option>)}</select></label>)}</div>
        <label className="flex items-start gap-3 text-sm font-semibold"><input type="checkbox" className="mt-0.5" disabled={Boolean(attached)} checked={withPlan} onChange={event => setWithPlan(event.target.checked)}/>Record a test plan before launch (recommended)</label>
        <p className="mt-2 text-sm text-slate-600">Write down what you expect, what you will change and how you will assess it. The plan stays fixed with the test.</p>
        {withPlan && <div className="mt-5 space-y-5 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:p-5">
          <label className="block text-sm font-semibold">Hypothesis<textarea required maxLength={600} rows={3} className="mt-2 block w-full rounded-lg border bg-white p-3 font-normal" value={hypothesis} onChange={event => setHypothesis(event.target.value)} placeholder="If we clarify the first question, more participants may finish because it takes less effort to understand."/></label>
          <label className="block text-sm font-semibold">Intended one change<textarea required maxLength={600} rows={3} className="mt-2 block w-full rounded-lg border bg-white p-3 font-normal" value={intendedChange} onChange={event => setIntendedChange(event.target.value)} placeholder="Shorten the first question while keeping its answer choices, meaning and scoring."/></label>
          <p className="text-xs text-slate-600">Your description is recorded as written. Pippi does not verify that the two versions differ in only one way, or change their scoring for you.</p>
          <label className="block text-sm font-semibold">Primary metric<select className="mt-2 block w-full rounded-lg border bg-white p-3 font-normal" value={primaryMetric} onChange={event => setPrimaryMetric(event.target.value as ExperimentPrimaryMetric)}><option value="completions">Completion rate</option><option value="leads" disabled={!canCapture}>Captured-contact rate</option></select></label>
          <p className="text-xs text-slate-600">Both metrics use assigned browsers that start the quiz. A captured contact is not a marketing opt-in, qualified lead or purchase. {!canCapture && "Captured-contact rate is available only when both selected published versions have contact capture enabled."}</p>
          <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-semibold">Completion floor (%) — optional<input aria-label="Completion floor (%) — optional" aria-describedby="experiment-floor-help" type="number" min={0} max={100} step="any" className="mt-2 block w-full rounded-lg border bg-white p-3 font-normal" value={floor} onChange={event => setFloor(event.target.value)}/><span id="experiment-floor-help" className="mt-2 block text-xs font-normal text-slate-600">An observed rate below this floor prompts a review. It does not automatically stop the test.</span></label><label className="block min-w-0 text-sm font-semibold">Review date (UTC) — optional<input aria-label="Review date (UTC) — optional" aria-describedby="experiment-review-date-help" type="date" className="mt-2 block w-full min-w-0 rounded-lg border bg-white p-3 font-normal" value={reviewDate} onChange={event => setReviewDate(event.target.value)}/><span id="experiment-review-date-help" className="mt-2 block text-xs font-normal text-slate-600">A reminder shown here. No automatic stop, notification or claim of sufficient data.</span></label></div>
        </div>}
        {!review && <button ref={setupButton} disabled={data.forms.length < 2 || Boolean(attached && !evidenceReady)} className="hq-primary mt-5">{withPlan ? "Review test plan" : "Launch test"}</button>}
      </fieldset>
      {data.forms.length < 2 && <p className="mt-3 text-sm text-slate-600">You need two published quizzes to launch a test.</p>}
      {review?.launch.plan && <section aria-labelledby="experiment-review-title" onKeyDown={event => { if (event.key === "Escape" && !busy) { event.preventDefault(); cancelReview(); } }} className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 sm:p-5">
        <h3 ref={reviewHeading} tabIndex={-1} id="experiment-review-title" className="flex items-center gap-2 text-lg font-semibold"><ClipboardCheck size={20} aria-hidden="true"/>Review before launching</h3><p className="mt-3 break-words text-sm font-semibold">{review.launch.name}</p><ul className="mt-2 space-y-1 break-words text-sm text-slate-700"><li>Version A: {review.titles[0]}</li><li>Version B: {review.titles[1]}</li></ul><PlanSummary plan={review.launch.plan}/>{review.evidence && <div className="mt-5"><ExperimentEvidenceCard evidence={review.evidence}/></div>}<p className="mt-4 text-sm text-slate-700">Confirm the plan and these published versions. They will be fixed for this test. No visitor is assigned until someone opens its experiment link.</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={busy} className="hq-secondary scroll-my-4" onFocus={event => revealReviewAction(event.currentTarget)} onClick={cancelReview}>Back to plan</button><button disabled={busy} className="hq-primary scroll-my-4" onFocus={event => revealReviewAction(event.currentTarget)}>{busy ? "Launching…" : "Confirm and launch test"}</button></div>
      </section>}
    </form>
    <p className="mb-6 text-sm text-slate-600">Results count assigned browsers that started through the experiment link. Repeat attempts count once per metric. Assignment lasts up to 90 days; clearing cookies or switching devices creates a new visitor. Ordinary quiz links and previews are excluded. Pausing stops new starts; existing sessions can finish.</p>
    <div className="space-y-6">{data.experiments.map(test => <section key={test.id} className="min-w-0 rounded-2xl border bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-xl font-semibold">{test.name}</h2><p className="mt-1 text-sm text-slate-600">{test.active ? "Running" : "Paused"} · Fixed versions · 50/50 allocation</p></div><div className="flex flex-wrap gap-2"><button disabled={busy} className="hq-secondary" onClick={async () => { try { await navigator.clipboard.writeText(`${location.origin}/experiment/${test.id}`); setNotice("Experiment link copied."); } catch { setError("Copy the experiment URL shown below."); } }}><Copy size={16} aria-hidden="true"/>Copy test link</button><button disabled={busy} className="hq-secondary" onClick={() => void change(`/api/experiments/${test.id}`, "PATCH", { active: !test.active })}>{test.active ? <Pause size={16} aria-hidden="true"/> : <Play size={16} aria-hidden="true"/>}{test.active ? "Pause" : "Resume"}</button></div></div>
      <Link href={`/experiment/${test.id}`} className="mt-4 block break-all text-sm text-red-800">/experiment/{test.id}</Link>
      {test.evidence && <div className="mt-5"><ExperimentEvidenceCard evidence={test.evidence} frozen/></div>}
      {test.plan ? <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-4"><h3 className="font-semibold">Plan recorded before launch</h3><PlanSummary plan={test.plan}/>{experimentPlanObservation(test.plan, test.stats[0]).reviewDue && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Review date reached. Review the evidence when useful; the test continues until you pause it. The date does not establish a winner.</p>}{test.plan.completionFloor !== undefined && <ul aria-label="Observed completion guardrail" className="mt-4 space-y-2 text-sm">{test.stats.map((counts, index) => { const observation = experimentPlanObservation(test.plan!, counts); return <li key={index} className={observation.floor === "below" ? "text-amber-900" : "text-slate-700"}>Version {index === 0 ? "A" : "B"}: {counts.visitors ? `${counts.completions} / ${counts.visitors} completed — ${observation.floor === "below" ? "below" : "at or above"} your ${test.plan!.completionFloor}% floor.` : "Not measured; no assigned browsers have started."}</li>; })}</ul>}<p className="mt-3 text-xs text-slate-600">Observed counts are descriptive. A floor or date is not a statistical decision rule, and passing it does not establish safety or a winner.</p></div> : <p className="mt-5 rounded-xl bg-stone-50 p-4 text-sm text-slate-600">No plan recorded before launch. These results have no saved primary metric or guardrail.</p>}
      <div role="region" aria-label={`Results for ${test.name}`} tabIndex={0} className="mt-5 overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-red-800"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-600">{['Version', 'Assigned browser starts', 'Completed', 'Captured contacts', 'Offer clicks'].map((label, index) => <th scope="col" key={label} className="p-3 font-medium">{label}{test.plan?.primaryMetric === (index === 2 ? "completions" : index === 3 ? "leads" : "") && <span className="mt-1 block text-xs font-semibold text-red-800">Primary metric</span>}</th>)}</tr></thead><tbody>{test.stats.map((counts, index) => <tr key={index} className="border-b"><th scope="row" className="p-3 font-semibold">{index === 0 ? 'A' : 'B'} · {test.titles[index]}</th><td className="p-3 tabular-nums">{counts.visitors}</td>{(['completions', 'leads', 'clicks'] as const).map(metric => <td key={metric} className={`p-3 tabular-nums ${test.plan?.primaryMetric === metric ? "bg-red-50" : ""}`}>{counts[metric]} <span className="block text-slate-600">{percent(experimentMetricRate(counts[metric], counts.visitors))}</span></td>)}</tr>)}</tbody></table></div>
      <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{test.stats.some(counts => counts.visitors < 100) ? "Early data: at least one version has fewer than 100 assigned browser starts. There is not enough evidence to judge a winner." : "Directional results only. Starter count alone does not establish a winner; check conversion counts, traffic quality and statistical uncertainty before acting."} Avoid stopping at the first apparent improvement.</p><p className="mt-3 text-xs text-slate-600">Rates use assigned browser starts; offer clicks are not purchases. Later completions can change these counts, and deleting retained contact records can reduce captured-contact counts. Rounded rates are for display; the completion floor uses the underlying fraction.</p>
    </section>)}</div>
  </main></>;
}
