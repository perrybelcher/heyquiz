"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { FormSchemaType, Question } from "@/lib/schema";
import { orderedQuestions, singleTypes } from "@/lib/engine";
import { addGuidedAnswer, guidedChoiceTypes, moveGuidedAnswer, moveGuidedQuestion, removeGuidedAnswer, removeGuidedQuestion, renameGuidedAnswer, reviewGuidedRemoval } from "@/lib/guided-editing";
import type { GuidedChecklistTarget } from "@/lib/guided-checklist";
import { setBasicAssociation } from "@/lib/basic-editing";

type Props = { form: FormSchemaType; onChange: (form: FormSchemaType) => void; questionId: string; onAdvanced: () => void; onRoutes: () => void; onQuestionRemoved?: (id: string | null) => void; onFieldRef?: (target: GuidedChecklistTarget, element: HTMLInputElement | HTMLTextAreaElement | null) => void };
export default function BasicQuestionEditor({ form, onChange, questionId, onAdvanced, onRoutes, onQuestionRemoved, onFieldRef }: Props) {
  const [error, setError] = useState("");
  const q = form.questions.find(q => q.id === questionId);
  if (!q) return <p>Select a question from the outline.</p>;
  const questions = orderedQuestions(form), index = questions.findIndex(item => item.id === q.id);
  const m = form.marketing, knowledge = form.mode === "quiz" && !m;
  const targets = m?.kind === "scorecard" ? m.categories : m?.outcomes || [];
  const canExclude = !!m && m.kind !== "scorecard" && (!form.quizType || form.quizType === "product_finder");
  const update = (patch: Partial<Question>) => onChange({ ...form, questions: form.questions.map(item => item.id === q.id ? { ...item, ...patch } : item) });
  const edit = (action: () => FormSchemaType) => { try { onChange(action()); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Could not update this question."); } };
  const text = (label: string, key: keyof Question, multiline = false) => <label className="basic-field">{label}{multiline ? <textarea className="hq-input" value={String(q[key] || "")} onChange={e => update({ [key]: e.target.value })} /> : <input className="hq-input" value={String(q[key] || "")} onChange={e => update({ [key]: e.target.value })} />}</label>;
  const numeric = (label: string, key: "points" | "minVal" | "maxVal" | "stepVal" | "minRating" | "maxRating" | "pictureColumns" | "maxFiles" | "maxFileSizeMB", min?: number, max?: number) => <label className="basic-field">{label}<input className="hq-input" type="number" step="any" min={min} max={max} value={q[key] ?? ""} onChange={e => { const value = e.target.value; if (!value) update({ [key]: undefined }); else if (Number.isFinite(Number(value)) && (min === undefined || Number(value) >= min) && (max === undefined || Number(value) <= max)) update({ [key]: Number(value) }); }} /></label>;
  const remove = (answerId?: string) => {
    const review = reviewGuidedRemoval(form, q.id, answerId);
    if (review.blockers.length) { setError(review.blockers.join(" ")); return; }
    if (!window.confirm([`Remove this ${answerId ? "answer" : "question"}?`, ...review.changes, "The published quiz stays unchanged until you publish again."].join("\n\n"))) return;
    edit(() => answerId ? removeGuidedAnswer(form, q.id, answerId) : removeGuidedQuestion(form, q.id));
    if (!answerId) onQuestionRemoved?.(questions[index + 1]?.id || questions[index - 1]?.id || null);
  };
  return <div className="basic-question-editor basic-stack">
    <div className="basic-inline"><h1>Question {index + 1} of {questions.length}</h1><label className="basic-check"><input type="checkbox" checked={!!q.required} onChange={e => update({ required: e.target.checked })}/>Required</label></div>
    {error && <p role="alert">{error}</p>}
    <label className="basic-field">Question wording<textarea className="hq-input" ref={el => onFieldRef?.({ kind: "question-title", questionId: q.id }, el)} value={q.title} onChange={e => update({ title: e.target.value })}/></label>
    {text("Description / help text", "description", true)}
    {knowledge && <fieldset className="basic-card"><legend>Correct-answer scoring</legend>{numeric("Question points", "points", 0)}{text("Question explanation", "explanation", true)}{!q.options?.length && !["choice_matrix", "matrix_multiselect"].includes(q.type) && text("Correct answer", "correctAnswerText")}<p>Question points are awarded using the existing answer key. Clearing points leaves this question unscored.</p></fieldset>}
    {!!q.options?.length && <h2>Answer options</h2>}
    {q.options?.map((answer, answerIndex) => <fieldset className="basic-card basic-answer" key={answer.id}><legend>Answer {answerIndex + 1}</legend>
      <label className="basic-field">Answer wording<input className="hq-input" ref={el => onFieldRef?.({ kind: "answer-label", questionId: q.id, answerId: answer.id }, el)} value={answer.label} onChange={e => edit(() => renameGuidedAnswer(form, q.id, answer.id, e.target.value))}/></label>
      {knowledge && <><label className="basic-check"><input type="checkbox" checked={!!answer.isCorrect} onChange={e => update({ options: q.options!.map(item => item.id === answer.id ? { ...item, isCorrect: e.target.checked } : singleTypes.has(q.type) && e.target.checked ? { ...item, isCorrect: false } : item) })}/>Correct answer</label><label className="basic-field">Answer explanation<textarea className="hq-input" value={answer.explanation || ""} onChange={e => update({ options: q.options!.map(item => item.id === answer.id ? { ...item, explanation: e.target.value } : item) })}/></label></>}
      {(["picture_choice", "image_multiselect"].includes(q.type) || answer.imageUrl) && <label className="basic-field">Answer image URL<input className="hq-input" value={answer.imageUrl || ""} onChange={e => update({ options: q.options!.map(item => item.id === answer.id ? { ...item, imageUrl: e.target.value } : item) })}/></label>}
      {m && m.kind !== "qualification" && <div className="basic-stack" aria-label={`Answer ${answerIndex + 1} associations`}>
        {m.rules.filter(r => r.questionId === q.id && r.answerId === answer.id).map(rule => <div className="basic-association basic-card" key={rule.id}>
          <strong>{targets.find(t => t.id === rule.targetId)?.title || "Missing result — review this mapping"}</strong>
          <label className="basic-field">Points<input className="hq-input" type="number" min={0} max={100} step="any" disabled={rule.effect === "exclude"} value={rule.effect === "add" ? rule.points : ""} onChange={e => edit(() => setBasicAssociation(form, q.id, answer.id, rule.targetId, e.target.value, rule.id))}/></label>
          {canExclude && <label className="basic-check"><input type="checkbox" checked={rule.effect === "exclude"} onChange={e => edit(() => setBasicAssociation(form, q.id, answer.id, rule.targetId, e.target.checked ? "exclude" : "", rule.id))}/>Exclude this result, regardless of points</label>}
          <label className="basic-field">Reason (optional)<input className="hq-input" maxLength={1000} value={rule.reason} onChange={e => onChange({ ...form, marketing: { ...m, rules: m.rules.map(r => r.id === rule.id ? { ...r, reason: e.target.value } : r) } })}/></label>
          <button type="button" className="hq-secondary" onClick={() => onChange({ ...form, marketing: { ...m, rules: m.rules.filter(r => r.id !== rule.id) } })}>Remove association</button>
        </div>)}
        {!m.rules.some(r => r.questionId === q.id && r.answerId === answer.id) && <p>No association: this answer is neutral.</p>}
        <label className="basic-field">Add {m.kind === "scorecard" ? "category" : "result"}<select className="hq-input" value="" onChange={e => { if (e.target.value) edit(() => setBasicAssociation(form, q.id, answer.id, e.target.value, "0")); }}><option value="">Choose an additional {m.kind === "scorecard" ? "category" : "result"}</option>{targets.filter(t => !m.rules.some(r => r.questionId === q.id && r.answerId === answer.id && r.targetId === t.id)).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
        <p className="basic-hint">Points range from 0–100. Zero is scored; clearing points removes the association. An answer can support multiple results.</p>
      </div>}
      {guidedChoiceTypes.has(q.type) && <div className="basic-inline"><button type="button" className="hq-secondary" aria-label={`Move answer ${answerIndex + 1} up`} disabled={answerIndex === 0} onClick={() => edit(() => moveGuidedAnswer(form, q.id, answer.id, -1))}><ArrowUp size={16}/>Move up</button><button type="button" className="hq-secondary" aria-label={`Move answer ${answerIndex + 1} down`} disabled={answerIndex === q.options!.length - 1} onClick={() => edit(() => moveGuidedAnswer(form, q.id, answer.id, 1))}><ArrowDown size={16}/>Move down</button><button type="button" className="hq-secondary" disabled={q.options!.length <= 2} aria-label={`Remove answer ${answerIndex + 1}`} onClick={() => remove(answer.id)}><Trash2 size={16}/>Remove</button></div>}
    </fieldset>)}
    {guidedChoiceTypes.has(q.type) && <button type="button" className="hq-secondary" onClick={() => edit(() => addGuidedAnswer(form, q.id))}><Plus size={16}/>Add answer</button>}
    {m?.kind === "qualification" && <section className="basic-card"><h2>Qualification routes</h2><p>Eligibility uses conditions rather than points. Missing or unknown answers do not satisfy a condition.</p><ul>{m.qualificationRules?.filter(r => r.conditions.some(c => c.questionId === q.id)).map(r => <li key={r.id}>{m.outcomes.find(o => o.id === r.outcomeId)?.title || "Missing route"} · {r.match} conditions</li>)}</ul><button type="button" className="hq-secondary" onClick={onRoutes}>Edit route conditions in Results</button></section>}
    <details className="basic-card"><summary>Question settings</summary><div className="basic-stack">
      <p>Field type: {q.type.replaceAll("_", " ")}. Specialist configuration remains available in Advanced.</p>
      {text("Placeholder", "placeholder")}
      {!!q.options?.length && <label className="basic-check"><input type="checkbox" checked={!!q.shuffleOptions} onChange={e => update({ shuffleOptions: e.target.checked })}/>Shuffle answers for participants</label>}
      {["number", "currency", "slider"].includes(q.type) && <>{numeric("Minimum value", "minVal")}{numeric("Maximum value", "maxVal")}{numeric("Step size", "stepVal")}{q.type === "currency" && text("Currency symbol", "currencySymbol")}</>}
      {["rating", "opinion_scale", "emoji_rating"].includes(q.type) && <>{numeric("Lowest rating", "minRating")}{numeric("Highest rating", "maxRating")}</>}
      {["rating", "opinion_scale", "slider", "nps", "emoji_rating"].includes(q.type) && <>{(["low", "high"] as const).map(key => <label className="basic-field" key={key}>{key === "low" ? "Low" : "High"} rating label<input className="hq-input" value={q.ratingLabels?.[key] || ""} onChange={e => update({ ratingLabels: { ...q.ratingLabels, [key]: e.target.value } })}/></label>)}{q.type === "nps" && <p>NPS uses a fixed 0–10 range.</p>}</>}
      {["picture_choice", "image_multiselect"].includes(q.type) && <>{numeric("Image columns", "pictureColumns", 1, 6)}<label className="basic-field">Image shape<select className="hq-input" value={q.pictureAspectRatio || "landscape"} onChange={e => update({ pictureAspectRatio: e.target.value as Question["pictureAspectRatio"] })}><option value="landscape">Landscape</option><option value="square">Square</option><option value="portrait">Portrait</option></select></label></>}
      {["file_upload", "image_upload"].includes(q.type) && <>{numeric("Maximum files", "maxFiles", 1)}{numeric("Maximum file size (MB)", "maxFileSizeMB", 1, 25)}</>}
      {["image_display", "banner"].includes(q.type) && text("Image URL", "mediaUrl")}
      {q.type === "video_embed" && text("Video URL", "videoUrl")}
      {q.type === "subheading" && text("Supporting text", "subheadingText", true)}
      {q.type === "rich_text" && text("Rich text content", "richTextContent", true)}
      {q.type === "terms" && <>{text("Terms text", "termsText", true)}{text("Terms URL", "termsUrl")}</>}
      {["short_answer", "paragraph", "email", "phone", "website", "number"].includes(q.type) && <p className="basic-hint">Validation follows this field type and its required setting. Email, website and numeric inputs use the existing participant validation.</p>}
      {["choice_matrix", "matrix_multiselect"].includes(q.type) && <><p>Matrix rows and columns can be changed in Advanced. Existing answer keys remain active.</p>{knowledge && q.rows?.map(row => <fieldset className="basic-card" key={row}><legend>Correct answer for {row}</legend>{q.columns?.map(column => { const key = q.matrixAnswerKey?.[row]; const selected = Array.isArray(key) ? key : key ? [key] : []; return <label className="basic-check" key={column}><input type={q.type === "choice_matrix" ? "radio" : "checkbox"} name={`matrix-key-${q.id}-${row}`} checked={selected.includes(column)} onChange={e => update({ matrixAnswerKey: { ...q.matrixAnswerKey, [row]: q.type === "choice_matrix" ? column : e.target.checked ? [...selected, column] : selected.filter(value => value !== column) } })}/>{column}</label>; })}</fieldset>)}</>}

      {q.type === "ranking" && <label className="basic-field">Items to rank (one per line)<textarea className="hq-input" value={(q.items || []).join("\n")} onChange={e => update({ items: e.target.value.split("\n") })}/></label>}
      {q.type === "scheduler" && <label className="basic-field">Available time slots (one per line)<textarea className="hq-input" value={(q.timeSlots || []).join("\n")} onChange={e => update({ timeSlots: e.target.value.split("\n") })}/></label>}
      {["date", "date_range", "datetime"].includes(q.type) && <>{(["start", "end"] as const).map(key => <label className="basic-field" key={key}>{key === "start" ? "Earliest date" : "Latest date"}<input className="hq-input" type="date" value={q.dateRange?.[key] || ""} onChange={e => update({ dateRange: { ...q.dateRange, [key]: e.target.value || undefined } })}/></label>)}</>}
      {form.settings.presentation === "page" && !!form.pages?.length && <label className="basic-field">Page<select className="hq-input" value={q.pageId || form.pages[0].id} onChange={e => { const pageId = e.target.value, updated = form.questions.map(item => item.id === q.id ? { ...item, pageId } : item); onChange({ ...form, questions: updated, pages: form.pages!.map(page => ({ ...page, questionIds: updated.filter(item => (item.pageId || form.pages![0].id) === page.id).map(item => item.id) })) }); }}>{form.pages.map((page, i) => <option key={page.id} value={page.id}>{page.title || `Page ${i + 1}`}</option>)}</select></label>}
      <div className="basic-inline"><button type="button" className="hq-secondary" disabled={index === 0} onClick={() => edit(() => moveGuidedQuestion(form, q.id, -1))}>Move question up</button><button type="button" className="hq-secondary" disabled={index === questions.length - 1} onClick={() => edit(() => moveGuidedQuestion(form, q.id, 1))}>Move question down</button><button type="button" className="hq-secondary" onClick={() => remove()}>Remove question</button></div>
      <button type="button" className="hq-secondary" onClick={onAdvanced}>Open this question in Advanced</button>
    </div></details>
  </div>;
}
