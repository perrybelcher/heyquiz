# Batch 8 — contact cohorts, reviewed tests and richer campaigns

Completed locally on 12 October 2026. Current combined compiled server: `http://127.0.0.1:3163`, session6462, build `build-batch-8-final.log`. Evidence index: `../pippi-overnight-2026-10-12/compiled-verification-batch-8/final-status.json`. Source archive: `../pippi-overnight-2026-10-12/source-checkpoint-batch-8.tar.gz` plus SHA-256 manifest. This is not a production deployment or live verification.

## Completed changes

1. **Contact cohorts and recorded activity.** Source, campaign and saved category filters combine with existing date/result/overall-score/consent/search conditions. Zero, null and absent category values remain distinct. The same filtered responses feed the 25-row display and complete CSV export. A minimal owner-checked retained-attempt sidecar supplies only actual recorded facts; deleted contacts are never restored from cached attempts. Missing history is explicit. Read failures and stale refreshes cannot produce exportable false cohorts. Strict ISO calendar validation rejects impossible/future/inconsistent dates. No new tracking, email opens or purchase inference.
2. **Reviewed experiment plans.** Optional immutable hypothesis, intended one change, completion/contact primary metric, completion floor and UTC review date. A separate review preserves inputs on back/cancel/error. Canonical snapshot digests reject a launch if either reviewed publication changed. Legacy launches remain plan-less. Strict pause/resume-only writes preserve plans and variants. No-data rates stay unknown. Floors and dates prompt review without declaring a winner, statistical significance, harm/safety or an automatic stop.
3. **Six more original campaigns.** Gifts, photography, wedding, SaaS, event readiness and retail readiness now include coherent landing/result content and creator checklists. Twelve templates are enriched in the existing 43-template catalog. IDs/questions/scoring remain unchanged; all four enriched scorecards have distinct descriptive context. Empty creator destinations, neutral outcomes, optional capture and existing owned art are preserved.

Feature details: `overnight-contact-cohorts.md`, `overnight-experiment-plans.md`, `overnight-template-campaigns-batch8.md`.

## Verification

Eight distinct compiled browser suites passed, ten successful runs including the focused keyboard suite in three engines:

- New contact cohorts with 38 synthetic responses; existing 62-response contact filters; existing contact-to-saved-result-link workflow.
- New experiment-plan flow; existing basic experiment assignment/submission/pause/resume; exact focus return in Chrome, Firefox and WebKit (8 checks each).
- Six new campaign journeys, all three report layouts and six native PDFs; all 11 PDF pages inspected visually.
- Twenty settled automated A/AA/reflow scans: contact filters, expanded activity, experiment setup, review and saved results at 1440/640/390/320 CSS pixels. Zero automated violations and no page-level overflow. Narrow experiment tables are focusable and keyboard-scrollable. The640px case approximates 1280px at 200%; it is not a true browser zoom test.

Axe incomplete contrast items were reviewed separately: decorative aria-hidden minus signs on the disclosure and cells clipped by narrow table scrolling. The same table colors pass when fully visible at wider widths; scrolling exposes the hidden columns. These scans do not certify accessibility, assistive-technology behavior or every application state.

Helper/API evidence: contact projection 9, mocked contacts route 5 and existing contact-filter 11 scenarios; experiment-plan 7 groups, route 11 groups plus existing aggregation/lifecycle 11 checks. Template 44 new literal cases overlap the all-12-campaign 64-case set; these are not additive unique journey counts. Existing 43-template/64,000-path scoring and three legacy starters / 768 paths pass. Focused lint, TypeScript and combined production compilation pass.

## Findings resolved during this pass

- Expanded contact response-ID helper text was outside a valid definition-list term/definition structure. It is now inside the definition while retaining the visual styling. Final 20 scans pass after the rebuilt correction.
- Retained date parsing now rejects impossible calendar strings instead of accepting JavaScript date normalization.
- A reviewed experiment cannot silently freeze a later republished version. The server checks canonical digests.
- Initial browser stops exposed overly broad nested summary selectors, labels whose native accessible names include control text, and a focus assertion preceding the scheduled animation frame. Test locators/waits were corrected; independent 24 focus checks confirmed app behavior. Initial logs/artifacts remain preserved and are not counted as passes.

## Limits and next work

No production writes, deploy, Git push, external provider calls, real email, paid work or credential changes. The active source is outside Git; do not replace it with the older Git checkout. Archive excludes credentials, mutable records, dependencies and builds. CRM and Stripe remain last; accounts remain free.

Client and contacts API must deploy together because nonempty old responses lack the required history sidecar. Record listings still scan retained data; eight-way history reads bound concurrency, not total query size. Native PDF language/asset/runtime limits and synthetic-only result email remain. Production account-email and cloud permissions are not verified by these fixtures.

Read-only proposals for a single historical answer filter and a click-to-open popup embed are next; neither is delivered by batch8. Thirty-one catalog templates are not yet enriched. Prefer bounded useful features and acceptance evidence over claiming complete competitive parity.
