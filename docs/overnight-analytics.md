# Answer patterns and starter attribution — 2026-10-12

## Delivered locally

Results now includes two aggregate panels:

- **What your audience chooses:** selectable question/option snapshots, answer counts and percentage bars, with separate counts for answered, shown but unanswered, skipped by branching, and unavailable retained answers. Semantic tables provide the exact values.
- **Where starters come from:** source/medium and campaign/source groups with starts, completions, completion rate and captured leads. Coverage cards distinguish identified source, unknown source, campaign tags, and older/unmeasured sessions.

Sources/Campaigns and the selected answer snapshot survive date changes and refreshes. If a chosen snapshot is absent from a cohort, the first available snapshot is displayed. Mobile layouts stay inside the viewport; the source table scrolls horizontally with a keyboard-focusable container and a small-screen hint.

## Measurement rules

Answer distributions use the retained submission linked to each completed attempt and that attempt's frozen quiz schema. They do not read answers back out of cached attempt results after a submission is removed. Unlinked submissions remain excluded from these session reports and are disclosed by existing analytics coverage.

Supported finite choices are the engine's single-choice and multiple-choice families, plus explicit checkbox/terms booleans. Free text, uploaded files and contact answers are not returned in the aggregate. Historical question wording and option IDs/labels define a version: renaming or removing options cannot rewrite an older response. Reordering shuffled choices does not create a false version. Identical display labels with different option IDs stay distinct.

A question is eligible when the saved schema's routing includes it for the retained answers. Branch skips are separate from unanswered questions. Invalid or unknown selections are excluded and disclosed. Percentages divide selected responses by valid answered responses; repeated multi-select IDs count once and totals can exceed 100%. Explicit optional `false` is a valid checkbox answer; a missing value is unanswered. Historical routing failures or missing retained submissions are unavailable, not inferred answers.

The report shows up to 60 question versions ordered by answer/completion volume, with omissions disclosed. Each version displays up to 100 options ordered by selected count, also disclosing omitted choices/selections. These are output bounds, not a claim that the underlying record scan is production-scale optimized.

## Attribution contract and privacy

`collectStartAttribution(pageUrl, referrer)` produces only `{ version: 1, source?, medium?, campaign?, referrerHost? }`. The player sends it for published starts; the start route and attempt writer sanitize it again. The new fifth `createAttempt` argument is optional, preserving existing callers and start requests. Preview attempts discard attribution server-side and remain excluded from analytics.

Only `utm_source`, `utm_medium` and `utm_campaign` are read. Labels are limited to 80 characters and a restricted label character set; obvious email addresses, telephone numbers and full URLs are dropped. Referrers retain an external hostname only, with IP addresses and local hosts rejected. URL paths, complete query strings, click-ID fields, and other unknown keys are not retained. Campaign labels are authored/self-reported metadata; validation cannot prove that an arbitrary allowed label has no personal meaning, so campaigns should use nonpersonal names.

An explicit source takes precedence over a referrer hostname. Missing information remains **Unknown source**, never invented direct traffic. A new empty collector record remains distinguishable from a legacy start without instrumentation. The top 20 source or campaign groups are separate; the rest roll into an Other row without losing aggregate totals. All metrics follow the existing session-start UTC date cohort and exclude previews.

## Verified

- `node tests/analytics.cjs`: **30 checks passed**, covering prior funnel behavior, renamed/removed options, same-label/different-ID identity, deduped multiple selections, branch skips, explicit false, malformed choices, deleted submissions, snapshot bounds, shuffled choices, start-date cohorts, preview exclusion, attribution allowlisting, unknown/legacy coverage and bounded group totals.
- `tests/browser-answer-attribution.cjs`: passed against the isolated local app at `http://127.0.0.1:3162` with the isolated data directory. It exercised publish/edit/start/submit, owner-only analytics, server sanitization, old clients and previews, the real player attribution payload, retained historic/current answer labels, branch and multi-select aggregates, response privacy, date/refresh selection persistence, semantic tables and mobile width. Its test quizzes/attempts/submissions are removed in cleanup.
- Focused ESLint on the changed application files: passed.
- TypeScript `--noEmit --incremental false`: passed.
- Desktop 1440×1000 and mobile 390×844 screenshots captured and inspected under `../pippi-overnight-2026-10-12/answer-attribution/`.

## Limits and handoff

These are started sessions, not landing visits or unique people. No visitor-to-start rate, advertising spend, revenue attribution, or causal lift is invented. Historical sessions cannot be backfilled with missing source information. Browser signals can be absent or self-reported, and renamed question/option versions are intentionally not merged into an ambiguous lifetime total.

Saved result-report link views and clicks are not tracked: they occur outside the original attempt/tracking window. The work adds no CRM provider calls, external tracking service, email delivery or billing behavior. It was tested locally; the parent agent owns the final shared build and release decision.

Files: `lib/analytics.ts`, `lib/attribution.ts`, `lib/attempts.ts`, `app/api/forms/[id]/start/route.ts`, `components/ResultsChart.tsx`, `tests/analytics.cjs`, `tests/browser-answer-attribution.cjs`. The parent integrated the collector in `components/QuizPlayer.tsx`; the existing owner-authenticated analytics route required no change.
