"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import type { FormSchemaType } from '@/lib/schema';
import { formatAnswer, orderedQuestions } from '@/lib/engine';
import { journeyDraftFingerprint, journeyFixtureStorageKey, MAX_JOURNEY_FIXTURES, type JourneyExpectation, type JourneyFixture } from '@/lib/journey-fixtures';
import { applyManualJourneyCase, manualJourneyQuestionKind, prepareManualJourneyCase, type ManualJourneyInput, type ManualJourneyReview } from '@/lib/manual-journey';

export interface ManualJourneyComposerHandle { cancel: () => boolean; close: () => void }
interface Props {
  form: FormSchemaType;
  count: number;
  libraryRaw: string | null;
  libraryUnavailable: boolean;
  onOpen: () => void;
  onPersist: (cases: JourneyFixture[], raw: string | null) => boolean;
  renderEvidence: (expected: JourneyExpectation) => ReactNode;
}

function focusBelowDialogHeader(target: HTMLElement | null) {
  if (!target) return;
  target.focus({ preventScroll: true });
  const dialog = target.closest('dialog'), header = dialog?.querySelector('header');
  if (dialog && header) dialog.scrollTop = Math.max(0, Math.min(dialog.scrollHeight - dialog.clientHeight, dialog.scrollTop + target.getBoundingClientRect().top - header.getBoundingClientRect().bottom - 16));
}

/** Deliberate, browser-local synthetic inputs; no respondent field components or API calls. */
const ManualJourneyComposer = forwardRef<ManualJourneyComposerHandle, Props>(function ManualJourneyComposer({ form, count, libraryRaw, libraryUnavailable, onOpen, onPersist, renderEvidence }, ref) {
  const [open, setOpen] = useState(false), [name, setName] = useState(''), [acknowledged, setAcknowledged] = useState(false);
  const [input, setInput] = useState<ManualJourneyInput>({ answers: {}, typedAnswers: {} });
  const [review, setReview] = useState<ManualJourneyReview | null>(null), [error, setError] = useState('');
  const [reviewInputs, setReviewInputs] = useState<{ input: string; name: string } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null), heading = useRef<HTMLHeadingElement>(null), reviewHeading = useRef<HTMLHeadingElement>(null), nameInput = useRef<HTMLInputElement>(null), reviewButton = useRef<HTMLButtonElement>(null), reviewPanel = useRef<HTMLElement>(null);
  const frame = useRef<number | null>(null);
  const fingerprint = journeyDraftFingerprint(form), questions = orderedQuestions(form);
  const stale = Boolean(review && (review.draftFingerprint !== fingerprint || reviewInputs?.name !== name || reviewInputs?.input !== JSON.stringify(input) || review.libraryRaw !== libraryRaw || libraryUnavailable));

  // Restore only from the control being removed. A later focused control owns focus.
  function restore(target: HTMLElement | null) {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const previous = document.activeElement;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const active = document.activeElement;
      if (active !== previous && active !== document.body && active !== document.documentElement && active?.isConnected) return;
      const available = (el: HTMLElement | null): el is HTMLElement => Boolean(el?.isConnected && el.getClientRects().length && !el.matches(':disabled'));
      const destination = available(target) ? target : available(heading.current) ? heading.current : trigger.current;
      destination?.focus();
    });
  }
  function cancelReview() { setReview(null); setError(''); restore(reviewButton.current); }
  function close(restoreFocus = true) { setOpen(false); setReview(null); setError(''); if (restoreFocus) restore(trigger.current); }
  useImperativeHandle(ref, () => ({ cancel: () => { if (review) { cancelReview(); return true; } if (open) { close(); return true; } return false; }, close: () => close(false) }));
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  // Closing a review must leave focus restoration to its explicit handler.
  // Opening the composer and opening a review are separate focus transitions.
  useEffect(() => { if (open) focusBelowDialogHeader(heading.current); }, [open]);
  useEffect(() => { if (review) focusBelowDialogHeader(reviewHeading.current); }, [review]);

  function finite(questionId: string, value: string | string[] | boolean | undefined) {
    setInput(current => { const answers = { ...current.answers }; if (value === undefined) delete answers[questionId]; else answers[questionId] = value; return { ...current, answers }; });
    setError('');
  }
  function typed(questionId: string, type: 'number' | 'short_answer', value: string) {
    setInput(current => ({ ...current, typedAnswers: { ...current.typedAnswers, [questionId]: { type, value } } }));
    setAcknowledged(false); setError('');
  }
  function prepare() {
    try {
      if (!acknowledged) throw Error('Confirm that every value is synthetic test data before reviewing it.');
      if (libraryUnavailable) throw Error('Reload the saved library before reviewing a new case. Your inputs are still here.');
      const raw = localStorage.getItem(journeyFixtureStorageKey(form.id));
      if (raw !== libraryRaw) throw Error('The saved library changed. Reload saved cases, then review again. Your inputs are still here.');
      setReview(prepareManualJourneyCase(form, input, name, `case-${crypto.randomUUID()}`, raw)); setReviewInputs({ input: JSON.stringify(input), name }); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'This synthetic case could not be reviewed.'); }
  }
  function save(trustedInteraction: boolean) {
    if (!review) return;
    try {
      if (!acknowledged) throw Error('Confirm that these are synthetic values before saving.');
      if (stale) throw Error('The draft, inputs or saved library changed. Cancel this review and review again.');
      const raw = localStorage.getItem(journeyFixtureStorageKey(form.id));
      const next = applyManualJourneyCase(form, input, name, raw, review);
      // WebKit can leave the dialog focused after a genuine pointer click.
      // Respect that explicit action without treating an unrelated scripted
      // click as permission to take focus from another input.
      const shouldFocus = trustedInteraction || Boolean(reviewPanel.current?.contains(document.activeElement));
      if (!onPersist(next.cases, review.libraryRaw)) throw Error('Could not save this case. The previous library is unchanged; your inputs and review are still here.');
      setReview(null); setName(''); setError('');
      if (shouldFocus) restore(nameInput.current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'This reviewed case could not be saved.'); }
  }
  const labelFor = (id: string) => form.questions.find(question => question.id === id)?.title || id;
  return <section className="mt-5 min-w-0" aria-label="Manual synthetic journey">
    <button ref={trigger} type="button" className="hq-secondary" aria-expanded={open} onClick={() => { if (open) close(); else { onOpen(); setOpen(true); } }}>Add manual test case</button>
    {!open && <p className="mt-2 text-xs text-slate-600">Optional: try a specific number or short answer alongside your choices.</p>}
    {open && <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
      <h3 ref={heading} tabIndex={-1} className="font-semibold outline-none">Try one synthetic answer path</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">Use made-up values only. This checks one path in the current draft; it does not expand automatic finite-path coverage or prove that a recommendation is correct.</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">Saved numbers and text are plaintext in this browser and included in exported JSON. Never enter customer or personal data. Refresh or close older Pippi editor tabs first; an older tab can overwrite this shared library.</p>
      <label className="mt-4 block text-sm font-medium">Manual case name<input ref={nameInput} className="hq-input mt-2 w-full" maxLength={100} value={name} onChange={event => { setName(event.target.value); setError(''); }} /></label>
      <div className="mt-5 space-y-4">{questions.map((question, index) => {
        const kind = manualJourneyQuestionKind(question.type), value = input.answers[question.id];
        return <fieldset key={question.id} className="min-w-0 rounded-lg border border-stone-200 p-3"><legend className="max-w-full break-words px-1 text-sm font-semibold">{index + 1}. {question.title || 'Untitled question'}</legend><p className="mb-3 break-words text-xs text-slate-600">{question.type.replaceAll('_', ' ')} · {question.required ? 'Required if reached' : 'Optional'} · ID: {question.id}</p>
          {kind === 'single' && <><label htmlFor={`manual-value-${index}`} className="block text-sm">Synthetic choice</label><select id={`manual-value-${index}`} className="hq-input mt-1 w-full" value={typeof value === 'string' ? value : ''} onChange={event => finite(question.id, event.target.value || undefined)}><option value="">Unanswered</option>{question.options?.map(option => <option key={option.id} value={option.id}>{option.label || 'Unnamed answer'}</option>)}</select></>}
          {kind === 'multi' && <div className="space-y-2">{question.options?.map(option => <label key={option.id} className="flex items-start gap-2 break-words text-sm"><input type="checkbox" className="mt-1 shrink-0" checked={Array.isArray(value) && value.includes(option.id)} onChange={event => { const next = event.target.checked ? [...(Array.isArray(value) ? value : []), option.id] : (Array.isArray(value) ? value : []).filter(id => id !== option.id); finite(question.id, next.length ? next : undefined); }} />{option.label || 'Unnamed answer'}</label>)}<p className="text-xs text-slate-600">No selections means unanswered.</p></div>}
          {kind === 'boolean' && <><label htmlFor={`manual-value-${index}`} className="block text-sm">Synthetic response</label><select id={`manual-value-${index}`} className="hq-input mt-1 w-full" value={typeof value === 'boolean' ? String(value) : ''} onChange={event => finite(question.id, event.target.value === '' ? undefined : event.target.value === 'true')}><option value="">Unanswered</option><option value="true">Yes / checked</option><option value="false">No / unchecked</option></select></>}
          {(kind === 'number' || kind === 'short_answer') && <><label htmlFor={`manual-value-${index}`} className="block text-sm">{kind === 'number' ? 'Synthetic number' : 'Synthetic short answer'}</label><input id={`manual-value-${index}`} type="text" inputMode={kind === 'number' ? 'decimal' : 'text'} className="hq-input mt-1 w-full" value={input.typedAnswers[question.id]?.value || ''} onChange={event => typed(question.id, kind, event.target.value)} aria-describedby={`manual-limit-${index}`} /><span id={`manual-limit-${index}`} className="mt-2 block text-xs leading-relaxed text-slate-600">{kind === 'number' ? 'Up to 64 characters. Decimal or scientific notation; blank is unanswered. Bounds are checked, but step increments are not.' : 'Up to 256 characters. Plain single-line synthetic text; blank is unanswered.'}</span></>}
          {kind === 'display' && <p className="text-sm text-slate-600">Display or calculated step. No value is fabricated.</p>}
          {kind === 'unsupported' && <p className="text-sm text-slate-600">This input is not supported here. If required on this path it prevents saving; optional values remain untested. Check it separately in Preview.</p>}
        </fieldset>;
      })}</div>
      <label className="mt-5 flex items-start gap-2 text-sm leading-relaxed"><input type="checkbox" className="mt-1 shrink-0" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />I entered synthetic test values only, not customer or personal data.</label>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="hq-secondary" onClick={() => close()}>Close manual case</button><button ref={reviewButton} type="button" className="hq-primary" disabled={!acknowledged || !name.trim() || count >= MAX_JOURNEY_FIXTURES || libraryUnavailable} onClick={prepare}>Review manual result</button></div>
      <p className="mt-2 text-xs text-slate-600">{count}/{MAX_JOURNEY_FIXTURES} saved cases. Inputs stay here until you leave Journey testing or close this dialog; changing a prior answer may omit a later answer from the saved path.</p>
      {error && <p role="alert" className="mt-4 break-words text-sm text-red-800">{error}</p>}
      {review && <section ref={reviewPanel} aria-label="Review manual expected result" className="mt-5 min-w-0 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <h4 ref={reviewHeading} tabIndex={-1} className="font-semibold outline-none">Review this exact expected result</h4>
        <p className="mt-2 break-words text-sm">{review.fixture.name} · {review.actual.resultTitle}</p>
        <dl className="mt-3 space-y-2 text-sm"><div><dt className="font-semibold">Status</dt><dd>{review.fixture.expected.status.replaceAll('_', ' ')}</dd></div><div><dt className="font-semibold">Result or tier ID</dt><dd className="break-all">{review.fixture.expected.resultId || 'No named result'}</dd></div><div><dt className="font-semibold">Score</dt><dd>{review.fixture.expected.score === null ? 'No score' : `${review.fixture.expected.score}%`}</dd></div></dl>
        <h5 className="mt-4 font-semibold">Visible questions and answers in order</h5><ol className="mt-2 list-decimal space-y-3 pl-5 text-sm">{review.fixture.expected.questionIds.map(id => { const question = form.questions.find(item => item.id === id); return <li key={id} className="break-words"><span className="font-medium">{labelFor(id)}</span><span className="ml-2 break-all text-xs text-slate-600">{id}</span><p className="mt-1 whitespace-pre-wrap">{question ? formatAnswer(question, review.actual.answers[id]) || 'Unanswered / display step' : 'Question no longer available'}</p></li>; })}</ol>
        {renderEvidence(review.fixture.expected)}
        <p className="mt-4 break-words text-sm">Inputs omitted by this path: {review.omittedQuestionIds.map(labelFor).join(' · ') || 'None'}. Omitted values remain in the editor but will not be saved in this case.</p>
        <p className="mt-2 break-words text-sm">Unsupported inputs left untested: {review.unsupportedQuestionIds.map(labelFor).join(' · ') || 'None'}.</p>
        <p className="mt-3 text-xs leading-relaxed text-slate-600">Saving accepts this observed behavior as the expected baseline. It does not independently verify the correct answer, copy, design, integrations or conversion performance.</p>
        {stale && <p role="alert" className="mt-3 text-sm text-red-800">The draft, inputs or saved library changed. Cancel this review and review again; nothing has been saved.</p>}
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="hq-secondary" onClick={cancelReview}>Cancel manual review</button><button type="button" className="hq-primary" disabled={stale || !acknowledged} onClick={event => save(event.nativeEvent.isTrusted)}>Save reviewed expected result</button></div>
      </section>}
    </div>}
  </section>;
});
export default ManualJourneyComposer;
