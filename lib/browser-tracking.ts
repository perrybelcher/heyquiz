import type { TrackingConfig, TrackingEvent } from "./tracking";
type Pixel = ((...args: unknown[]) => void) & {
    queue: unknown[][];
    callMethod?: (...args: unknown[]) => void;
    loaded: boolean;
    version: string;
    push?: Pixel;
};
type TrackerWindow = Window & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: Pixel;
    _fbq?: Pixel;
};
const initialized = new Set<string>();
const consented = new Set<string>();
const configId = (config: TrackingConfig) => `${config.ga4Id}:${config.metaPixelId}`;
function script(id: string, src: string) { if (document.getElementById(id))
    return; const node = document.createElement('script'); node.id = id; node.src = src; node.async = true; document.head.appendChild(node); }
export function trackerConsent(config: TrackingConfig, allowed: boolean) {
    if (allowed)
        consented.add(configId(config));
    else
        consented.delete(configId(config));
    const w = window as TrackerWindow;
    if (config.ga4Id) {
        (w as unknown as Record<string, unknown>)[`ga-disable-${config.ga4Id}`] = !allowed;
        if (allowed && !w.gtag) {
            w.dataLayer = w.dataLayer || [];
            // Google's command queue uses Arguments objects, as in the vendor snippet.
            // eslint-disable-next-line prefer-rest-params
            w.gtag = function () { w.dataLayer!.push(arguments); };
            w.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
        }
        if (w.gtag) {
            const value = allowed ? 'granted' : 'denied';
            w.gtag('consent', 'update', { analytics_storage: value, ad_storage: value, ad_user_data: value, ad_personalization: value });
        }
        if (allowed && !initialized.has(config.ga4Id)) {
            initialized.add(config.ga4Id);
            w.gtag!('js', new Date());
            w.gtag!('config', config.ga4Id, { send_page_view: false, page_location: location.origin + location.pathname, page_referrer: '', page_title: 'Quiznick', allow_enhanced_conversions: false });
            script('hq-ga4', 'https://www.googletagmanager.com/gtag/js?id=' + config.ga4Id);
        }
    }
    if (config.metaPixelId) {
        if (allowed && !w.fbq) {
            const f: Pixel = Object.assign(function (...args: unknown[]) { if (f.callMethod)
                f.callMethod(...args);
            else
                f.queue.push(args); }, { queue: [] as unknown[][], loaded: true, version: '2.0' });
            f.push = f;
            w.fbq = f;
            w._fbq = f;
        }
        if (w.fbq)
            w.fbq('consent', allowed ? 'grant' : 'revoke');
        if (allowed && !initialized.has(config.metaPixelId)) {
            initialized.add(config.metaPixelId);
            w.fbq!('set', 'autoConfig', false, config.metaPixelId);
            w.fbq!('init', config.metaPixelId);
            script('hq-meta', 'https://connect.facebook.net/en_US/fbevents.js');
        }
    }
}
export function sendTrackingEvent(config: TrackingConfig, event: TrackingEvent, quizId: string, questionId?: string) {
    if (!consented.has(configId(config)) || !config.enabled || !config.events.includes(event))
        return;
    if (event === 'question_view' && config.questionIds.length && !config.questionIds.includes(questionId || ''))
        return;
    const w = window as TrackerWindow, params = { quiz_id: quizId, ...(questionId ? { question_id: questionId } : {}) };
    if (config.ga4Id)
        w.gtag?.('event', 'hq_' + event, { ...params, send_to: config.ga4Id, page_location: location.origin + location.pathname, page_referrer: '', page_title: 'Quiznick' });
    if (config.metaPixelId)
        w.fbq?.('trackSingleCustom', config.metaPixelId, 'hq_' + event, params);
}
