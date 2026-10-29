"use client";

import { useState } from "react";
import type { FormSchemaType } from "@/lib/schema";
import type { MarketingResult } from "@/lib/marketing";
import { orderedQuestions, type Answers } from "@/lib/engine";
import { quizThemeStyle } from "@/lib/theme-style";
import QuestionField from "../QuestionField";
import QuizLanding from "../QuizLanding";
import MarketingResultCard from "../MarketingResultCard";

/** A content projection for appearance only. It does not evaluate an answer path. */
export function appearanceResult(form: FormSchemaType, resultId?: string): MarketingResult | undefined {
  const marketing = form.marketing;
  if (!marketing) return undefined;
  const outcome = marketing.outcomes.find(item => item.id === resultId) || marketing.outcomes[0];
  const category = marketing.categories.find(item => item.id === resultId);
  const band = marketing.scorecard?.bands.find(item => item.id === resultId);
  return {
    quizType: form.quizType,
    kind: marketing.kind,
    status: marketing.kind === "scorecard" ? "scored" : outcome ? "matched" : "no_match",
    title: marketing.kind === "scorecard" ? band?.title || marketing.scorecard?.title || "Your scorecard" : outcome?.title || marketing.fallbackTitle,
    message: marketing.kind === "scorecard" ? marketing.scorecard?.message || "Each category reflects the answers supplied." : outcome?.description || marketing.fallbackMessage,
    outcomeId: marketing.kind === "scorecard" ? undefined : outcome?.id,
    advice: marketing.kind === "scorecard" ? band?.advice : outcome?.advice,
    ctaLabel: marketing.kind === "scorecard" ? band?.ctaLabel : outcome?.ctaLabel,
    ctaUrl: marketing.kind === "scorecard" ? band?.ctaUrl : outcome?.ctaUrl,
    presentation: marketing.presentation,
    reasons: [],
    // No answer evidence is invented to make an independently selected result appear reachable.
    categories: marketing.kind === "scorecard" ? (category ? [category] : marketing.categories).map(item => ({ id: item.id, title: item.title, description: item.description, score: null, answered: 0, applicable: new Set(marketing.rules.filter(rule => rule.targetId === item.id).map(rule => rule.questionId)).size, minAnswers: item.minAnswers })) : [],
    ...(marketing.kind === "scorecard" && marketing.scorecard ? { overallScore: null } : {}),
    resultSections: marketing.resultSections?.filter(section => !section.condition || (section.condition.type === "outcome" && section.condition.outcomeId === outcome?.id)),
  };
}

export default function BasicVisitorPreview(props: { form: FormSchemaType; step: number; questionId?: string; resultId?: string }) {
  // Local answer state is discarded when the selected preview changes. It is never passed to onChange or any transport.
  return <PreviewContent key={`${props.form.id}:${props.step}:${props.questionId || ""}:${props.resultId || ""}`} {...props}/>;
}

function PreviewContent({ form, step, questionId, resultId }: { form: FormSchemaType; step: number; questionId?: string; resultId?: string }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [message, setMessage] = useState("");
  const questions = orderedQuestions(form);
  const question = questions.find(item => item.id === questionId) || questions[0];
  const index = question ? questions.findIndex(item => item.id === question.id) : -1;
  const result = appearanceResult(form, resultId);
  const tier = form.outcomeTiers.find(item => item.id === resultId) || form.outcomeTiers[0];
  const tierCtaUrl = tier?.ctaUrl || form.endingPage?.redirectUrl || "";
  const tierCtaLabel = tier?.ctaText || form.endingPage?.buttonText || "Continue";
  const theme = quizThemeStyle(form.theme);
  const resultPreview = step === 2;
  const welcomePreview = step === 0 || step === 3 || step === 4;
  const quietAction = () => setMessage("Appearance preview only. Use the header Preview button to test the complete journey.");
  return <div className="basic-preview-frame">
    <p className="basic-help">{resultPreview ? "Appearance preview · this does not demonstrate a matching answer path." : "Visitor preview · answers stay in this panel and are not saved."}</p>
    <div className="hq-player basic-preview-content" style={theme} onClickCapture={event => { if ((event.target as Element).closest("a")) { event.preventDefault(); event.stopPropagation(); quietAction(); } }}>
      <div className="basic-preview-brand">{form.theme.logoUrl ? <img src={form.theme.logoUrl} alt={form.theme.logoAlt || form.theme.brandName || "Quiz logo"} style={{ maxWidth: "100%", height: form.theme.logoHeight || 40, objectFit: "contain" }}/> : form.theme.brandName ? <strong>{form.theme.brandName}</strong> : !form.theme.hidePippiBranding ? <img src="/pippi-logo.svg" alt="Pippi" width={78} height={34}/> : null}</div>
      {resultPreview ? result ? <MarketingResultCard result={result}/> : <section className="basic-preview-question"><p className="basic-help">{form.mode === "quiz" ? `Feedback for ${tier?.minScorePercent ?? 0}–${tier?.maxScorePercent ?? 100}%` : "Completion message"}</p><h2>{tier?.badge && <span className="basic-result-badge">{tier.badge} </span>}{tier?.title || form.endingPage?.title || "Thank you!"}</h2><p>{tier?.message || form.endingPage?.message || "Your answers have been received."}</p>{/^https?:\/\//.test(tierCtaUrl) && <a className="hq-primary" href={tierCtaUrl}>{tierCtaLabel}</a>}</section> : welcomePreview ? <QuizLanding form={form} busy={false} onStart={quietAction}/> : question ? <section className="basic-preview-question">
        {form.settings.showProgressBar !== false && form.settings.progressBarMode !== "none" && <div className="basic-preview-progress"><progress aria-label="Preview progress" max={questions.length} value={index + 1}/><span>{index + 1} of {questions.length}</span></div>}
        <p className="basic-help">Question {index + 1} of {questions.length}{question.required ? " · Required" : ""}</p>
        <h2>{question.title || "Your question"}</h2>{question.description && <p>{question.description}</p>}
        {["file_upload", "image_upload", "audio_recorder"].includes(question.type) ? <div className="basic-note">{question.type === "audio_recorder" ? "Audio recording: microphone access and uploads are disabled here. Test this field in the full preview." : "Upload appearance: visitors can choose a file in the full preview. Uploads are disabled here."}</div> : question.type === "captcha" ? <div className="basic-note">Security challenge: test this field in the full preview. No challenge request is made here.</div> : question.type === "video_embed" ? <div className="basic-note">Video appearance: use the full preview to play this video. The external video player is not loaded here.</div> : <QuestionField q={question} value={answers[question.id]} answers={answers} token="" onChange={value => setAnswers(current => ({ ...current, [question.id]: value }))}/>}
        <div className="basic-actions"><button className="hq-primary" type="button" onClick={quietAction}>Next</button></div>
      </section> : <p>Add a question to see its preview.</p>}
    </div>
    {message && <p role="status" className="basic-help">{message}</p>}
  </div>;
}
