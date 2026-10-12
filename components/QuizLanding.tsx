"use client";

import { ArrowRight, Check } from "lucide-react";
import type { FormSchemaType } from "@/lib/schema";
import { displayTypes } from "@/lib/engine";
import { safeLandingImageUrl } from "@/lib/landing";
import ResultVideo from "./ResultVideo";

export type QuizLandingProps = {
  form: FormSchemaType;
  busy: boolean;
  error?: string;
  onStart: () => void;
  resume?: { label: string; onResume: () => void };
};

/** The editor preview and public introduction share one renderer. All start
 * buttons delegate to the player's existing attempt/capture/tracking flow. */
export default function QuizLanding({ form, busy, error, onStart, resume }: QuizLandingProps) {
  const cover = form.coverPage?.enabled ? form.coverPage : undefined;
  const image = cover?.imageUrl && safeLandingImageUrl(cover.imageUrl) ? cover.imageUrl : undefined;
  const split = cover?.layout === "split" && Boolean(image);
  const questionCount = form.questions.filter(question => !displayTypes.has(question.type)).length;
  const card = "rounded-[var(--hq-radius,24px)] border border-slate-200 overflow-hidden";
  const buttonLabel = cover?.buttonText || "Let’s begin";
  const actions = (label = buttonLabel) => <div className="flex flex-wrap items-center gap-3">
    {resume && <button type="button" disabled={busy} className="hq-primary" onClick={resume.onResume}>{resume.label}<ArrowRight size={16} aria-hidden="true"/></button>}
    <button type="button" disabled={busy} className={resume ? "hq-secondary" : "hq-primary"} onClick={onStart}>{busy ? "Preparing…" : resume ? "Start over" : label}<ArrowRight size={16} aria-hidden="true"/></button>
  </div>;
  return <div className="@container/landing space-y-6 text-left" data-landing-layout={cover?.layout || "compact"}>
    <section className={`${card} ${split ? "grid @min-[700px]/landing:grid-cols-2" : ""}`} style={{ backgroundColor: "var(--hq-card, #fff)" }}>
      {image && <img src={image} alt={cover?.imageAlt || "Quiz cover"} className={split ? "h-64 w-full object-cover @min-[700px]/landing:h-full @min-[700px]/landing:min-h-96" : "h-56 w-full object-cover sm:h-72"}/>}
      <div className="min-w-0 p-6 sm:p-10 lg:p-12">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[.16em]" style={{ color: "var(--hq-primary)" }}>{form.marketing?.kind === "scorecard" ? "Your personalized assessment" : form.marketing ? "Find your next step" : "A little curiosity goes a long way"}</p>
        <h1 className="break-words text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{cover?.title || form.title}</h1>
        {(cover?.subtitle || form.description) && <p className="mt-5 break-words whitespace-pre-line leading-relaxed opacity-75">{cover?.subtitle || form.description}</p>}
        <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm opacity-65">
          {cover?.showQuestionCount !== false && <span>{questionCount} {questionCount === 1 ? "question" : "questions"}</span>}
          {Boolean(cover?.estimatedMinutes && cover.estimatedMinutes > 0) && <span>About {cover!.estimatedMinutes} minutes</span>}
        </div>
        {error && <p role="alert" className="hq-error mt-5">{error}</p>}
        {form.capture?.enabled && form.capture.required && <p className="mt-5 text-sm opacity-70">Contact details are required to view your results. Marketing emails are optional.</p>}
        <div className="mt-8">{actions()}</div>
      </div>
    </section>
    {cover?.sections?.map(section => {
      const heading = section.title && <h2 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{section.title}</h2>;
      const content = section.body && <p className="break-words whitespace-pre-line leading-relaxed opacity-75">{section.body}</p>;
      if (section.type === "faq") return <details key={section.id} className={`${card} p-6 sm:p-8`} style={{ backgroundColor: "var(--hq-card, #fff)" }}><summary className="cursor-pointer break-words font-semibold">{section.title || "Common question"}</summary><div className="mt-4">{content}</div></details>;
      if (section.type === "testimonial") return <figure key={section.id} className={`${card} p-6 sm:p-10`} style={{ backgroundColor: "var(--hq-card, #fff)" }}><blockquote className="break-words whitespace-pre-line text-xl leading-relaxed">{section.body}</blockquote>{section.title && <figcaption className="mt-5 text-sm font-semibold">{section.title}</figcaption>}</figure>;
      return <section key={section.id} className={`${card} space-y-5 p-6 sm:p-10`} style={{ backgroundColor: "var(--hq-card, #fff)" }}>
        {heading}{content}
        {section.type === "benefits" && <ul className="grid gap-4 @min-[600px]/landing:grid-cols-2">{section.items.map((item, index) => <li key={index} className="flex items-start gap-3"><span className="mt-0.5" style={{ color: "var(--hq-primary)" }}><Check size={18} aria-hidden="true"/></span><span className="break-words">{item}</span></li>)}</ul>}
        {section.type === "video" && <ResultVideo url={section.url} title={section.label || section.title || "a quick introduction"}/>}
        {section.type === "start" && actions(section.label || buttonLabel)}
      </section>;
    })}
  </div>;
}
