# Conversion analytics and optional tracking

Open a quiz's **Results** tab. The conversion dashboard appears above all-time response records.

## Dashboard

- 7/30/90-day and all-time start cohorts, with starts, completion rate, captured leads, opt-ins, median elapsed completion time, and percentage-point comparison to the previous calendar period.
- Daily starts/completions/leads, conversion journey, result segments, and question-level reach, eventual completion, and quiet-session counts.
- Question-performance CSV export and accessible daily counts table.
- Explicit empty, loading, error, and retry states. No illustrative data is mixed into a user's metrics.

A session is one start (a retake is another session), not a unique person. Date filters use UTC start dates; later events remain attributed to that start cohort. Today is partial. All-time trends show at most 90 days. Contact capture can occur before or after results, so leads are not treated as a fixed funnel stage. A click is not a sale.

A quiet session is unfinished with no observed question activity for at least 30 minutes. Its last observed question is the potential stopping point; this does not establish abandonment or causation. Skipped branches are not classified as drop-offs. Completion timing includes time away. Older attempts without analyticsVersion=1 do not contribute invented timestamps, clicks, or quiet-step rates. Preview sessions are excluded. Unlinked historical submissions remain in response records but do not distort cohort rates.

The owner-only analytics API returns aggregates, never raw contact or answer fields. Storage queries are owner-scoped. Results aggregate existing attempt/submission records; very large accounts will eventually need materialized daily aggregates instead of reading every owner attempt.

## External tracking

The Results tab includes Tracking & retargeting settings. Add a GA4 measurement ID and/or numeric Meta pixel ID, select events and question steps, enable, then publish. Empty question selection means all visible questions. Hidden questions are excluded.

Custom events: hq_quiz_start, hq_question_view, hq_quiz_complete, hq_lead_captured, hq_result_view, hq_offer_click. Parameters contain quiz_id and (for question views) question_id. No explicit answer text, contact fields, score, or result label is included.

External tracking is disabled by default. A separate visitor permission prompt gates vendor script loading. Decline loads no vendor scripts. Withdrawal calls the vendor consent APIs and blocks the HeyQuiz event sender; preview never loads scripts. Permission is requested afresh on page load. Event deduplication is scoped to a quiz session in sessionStorage; historical question steps are not replayed when consent is granted mid-quiz. A current result can be recorded on permission grant. Vendor scripts are fixed URLs; arbitrary pasted JavaScript is not accepted.

The visitor's external-tracking choice is separate from contact marketing consent. Internal session analytics remain available without advertising consent. Third-party SDKs can collect browser identifiers and page URLs. Avoid sensitive URL parameters, disable enhanced measurement/automatic events/advanced matching in vendor settings, and supply the appropriate privacy policy. Google event configuration strips query strings and referrers. This is not a promise that a third-party SDK cannot collect additional data.

Provider setup is not evidence of delivery. These changes were tested locally with vendor scripts intercepted; no production trackers, campaigns, or CRM lead deliveries were activated. Ad blockers and platform/browser policies can prevent delivery. Meta/GA audiences and conversions must be configured in those platforms. GTM, TikTok, server-side conversions, purchase attribution, and experiment reporting are not part of this release.

## Verification

- tests/analytics.cjs: cohort math, previews, history, branches, quiet sessions, timing, aggregate privacy.
- tests/tracking.cjs: IDs, consent gates, fixed script origins, event allowlists, payloads, withdrawal.
- tests/browser-analytics.cjs: local API access controls, deduplication, dashboard ranges, export, mobile layout, and error recovery.
- tests/browser-tracking.cjs: synthetic published local quiz with intercepted vendor scripts; decline, allow, step selection, withdrawal, actual result/offer click, preview exclusion, persisted settings.
- tests/owner-isolation.cjs includes analytics across owners.

Reference: https://developers.google.com/tag-platform/security/guides/consent and https://developers.google.com/analytics/devguides/collection/ga4/views . Meta SDK interface uses fbq init, consent, autoConfig, and trackSingleCustom; live Events Manager verification remains a later launch check.
