# Batch 7: campaign, journey and analytics verification

Completed locally on 12 October 2026. No deployment, production records, real email, provider calls, purchases or credentials were changed.

## What changed

- Six existing starters now include original landing sections, useful conditional result guidance, neutral paths and individual setup checklists. All 43 template IDs and blank creation remain available. Real offer links deliberately start empty.
- Saved journey cases now check category scores, null states, answer coverage and ordered resolved sections. Older cases keep their original assertions until a creator explicitly reviews and adds the new checks. Editorial changes are distinguished from behavior changes.
- Results can isolate exact source, campaign and frozen publication-version cohorts. All session metrics, previous-period comparisons, historical answer/wording views and question CSV use the same cohort. Unknown history stays unknown. Landing visits lack those dimensions, so their panel is hidden while a cohort filter is active.

## Validation and defects fixed

Final build: `build-batch-7-focus-final.log`, successful TypeScript and 32 static routes. Isolated compiled server: http://127.0.0.1:3163, exec session 82016, `server-batch-7-focus-final.log`. The source remains outside Git; the archive is a local checkpoint, not a pushed commit.

Unit evidence includes general 25, hand-calculated scoring/analytics 7, landing 22, existing analytics 30, cohort 11, mocked cohort route 4, expanded journey 13, and 32 literal campaign/category/section expectations. Existing journey checks, 43-template/64,000-path catalog regression and 768 legacy product paths also passed. Scoped lint has no errors; existing image-element warnings remain.

Nine distinct browser suites passed, including the focus suite in Chrome, Firefox and WebKit (11 runs across those distinct suites, excluding earlier/repeated runs): new analytics cohorts, old answer/source analytics, old landing visits, six campaign flows, template discovery, expanded journey cases, existing ConversationMap, dedicated dialog focus, and the independent accessibility/reflow suite. Campaign checks included all six saved/publication snapshots, six native PDFs, one full click-through with skipped optional capture, all three saved-report layouts and insufficient-information categories. Browser tests used synthetic isolated records only.

Independent accessibility testing covered the populated analytics report, enriched template details and expanded journey cases at 1440, 640, 390 and 320 CSS pixels. The final 12 scans show zero automated WCAG A/AA violations and no page-level horizontal overflow. The 640 CSS-pixel view approximates reflow at 200% of a 1280px viewport; it is not a real browser zoom test. The report header's 16 gradient contrast nodes require manual interpretation; its unchanged colors retain the conservative minimum 4.90:1 calculation documented in batch 4. This is not screen-reader or accessibility certification.

Actual findings were repaired rather than suppressed:

1. Tiny summary/coverage labels and the template footer lacked sufficient contrast; colors were darkened.
2. Narrow question/answer tables could not be scrolled with the keyboard; both now have named focusable regions and visible focus outlines. Actual ArrowRight scrolling passed at 320px.
3. Closing ConversationMap dropped focus to the page on both desktop and mobile. The dialog now closes while connected, then restores a connected opener or responsive replacement without stealing focus from an editor/modal opened through navigation. Three engines passed 16 checks each, including Escape, close button, breakpoint changes and theme navigation.
4. Generic containers carrying accessibility names now have meaningful group semantics.

Preserved test-only failures: PDF extraction inserted whitespace before punctuation (normalized only extraction whitespace, while checking full copy/order); a result title shared text with a secondary heading (scoped the test to H1); and the root test initially queried a desktop-only action at mobile width (now uses More). Earlier failure logs remain alongside final passes.

Root visually inspected mobile cohort controls, template detail and saved cases, a desktop campaign landing, and rendered onboarding/unknown-score report pages. The new PDF content is readable and preserves unknown scores. Some existing scorecard category description/advice wording repeats; a later editorial pass can distinguish context from the action without changing scoring.

## Evidence and limits

`../pippi-overnight-2026-10-12/compiled-verification-batch-7/final-status.json` maps exact logs. Feature notes: `overnight-template-campaigns.md`, `overnight-journey-expectations.md`, `overnight-analytics-cohorts.md`.

The six campaigns are editable starting points; creators still supply real offers, destinations and privacy information. The other 37 starters keep their earlier content. Saved journey cases remain browser-local and finite-choice, not synced release gates or delivery tests. Analytics still scans retained owner records; these filters do not add database indexing, attributed landing dimensions or cross-device attribution. Native PDF and synthetic email limitations from batches 5–6 still apply. Nothing here verifies current cloud authentication mail or the deployed site.
