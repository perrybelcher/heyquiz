"use client";
import { useEffect, useRef, useState } from 'react';
import { TrackingSchema, type TrackingEvent } from '@/lib/tracking';
import { trackerConsent, sendTrackingEvent } from '@/lib/browser-tracking';
import type { FormSchemaType } from '@/lib/schema';
export default function QuizTracking({ form, preview, sessionId, questionId, completed, leadCaptured }: {
    form: FormSchemaType;
    preview: boolean;
    sessionId?: string;
    questionId?: string;
    completed: boolean;
    leadCaptured: boolean;
}) {
    const [consent, setConsent] = useState<boolean | null>(null), [open, setOpen] = useState(true);
    const sent = useRef(new Set<string>()), allowed = useRef(false);
    const parsed = TrackingSchema.safeParse(form.tracking);
    const config = parsed.success && parsed.data.enabled && !preview ? parsed.data : null;
    const configKey = JSON.stringify(config);
    useEffect(() => {
        const current = JSON.parse(configKey);
        if (!current)
            return;
        trackerConsent(current, consent === true);
        allowed.current = consent === true;
        return () => { allowed.current = false; trackerConsent(current, false); };
    }, [configKey, consent]);
    useEffect(() => {
        const current = JSON.parse(configKey);
        if (!current || consent !== true || !sessionId)
            return;
        const storageKey = `heyquiz:tracking-events:${form.id}`;
        try {
            const prior = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
            if (Array.isArray(prior))
                for (const key of prior.slice(-1000))
                    if (typeof key === 'string')
                        sent.current.add(key);
        }
        catch { }
        function emit(event: TrackingEvent, step?: string) { const key = `${sessionId}:${event}:${step || ''}`; if (sent.current.has(key))
            return; sent.current.add(key); try {
            sessionStorage.setItem(storageKey, JSON.stringify([...sent.current].slice(-1000)));
        }
        catch { } sendTrackingEvent(current, event, form.id, step); }
        // Do not replay historical steps when permission is granted later.
        if (!completed) {
            emit('quiz_start');
            if (questionId)
                emit('question_view', questionId);
        }
        if (completed) {
            emit('quiz_complete');
            emit('result_view');
        }
        if (leadCaptured)
            emit('lead_captured');
        const click = () => { if (allowed.current)
            emit('offer_click'); };
        window.addEventListener('heyquiz-offer-click', click);
        return () => window.removeEventListener('heyquiz-offer-click', click);
    }, [configKey, consent, sessionId, questionId, completed, leadCaptured, form.id]);
    if (!config)
        return null;
    return <div className="max-w-3xl w-full mx-auto px-5 pb-5">{open ? <section aria-label="Optional tracking preferences" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-sm">Your tracking choice</h2><p className="text-xs text-slate-500 leading-relaxed mt-2">Allow {config.ga4Id && config.metaPixelId ? 'Google Analytics and Meta' : config.ga4Id ? 'Google Analytics' : 'Meta'} to measure quiz activity and support personalized advertising using cookies and browser identifiers? You can take this quiz without allowing it. {config.privacyUrl && <a className="underline" href={config.privacyUrl} target="_blank" rel="noopener noreferrer">Privacy policy</a>}</p><div className="flex flex-wrap gap-3 mt-4">{[[false, 'Decline'], [true, 'Allow tracking']].map(([value, label]) => <button key={String(label)} className="px-4 py-2 text-xs rounded-lg border border-slate-300" onClick={() => { setConsent(value === true); setOpen(false); }}>{label}</button>)}</div></section> : <button className="text-xs text-slate-500 underline" onClick={() => setOpen(true)}>Tracking preferences · {consent ? 'allowed' : 'declined'}</button>}</div>;
}
