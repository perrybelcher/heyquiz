# Next local priorities after batches 1–6

Read-only source review, 12 October 2026. Compared the existing [competitive report](../../scoreapp-review-2026-10-11/Pippi-ScoreApp-Competitive-Review-2026-10-12.md) with current code and overnight feature evidence. These are bounded follow-ups, not new competitor research or claims that Pippi now has overall parity.

**Already built; do not repeat:** reviewed AI changes/draft recovery/current-draft preview; guided question/answer editing and goal-aware AI entry; reusable visual kits with management; landing sections; three result layouts; representative/saved journey cases; private result links and revocation; source/answer/landing analytics; contact date/result/score filters and export; responsive inline embedding and reversible pause; compact mobile navigation/accessibility fixes; bounded local record reads; synthetic result-email queue; native frozen-result PDF and traced deployment packaging. The feature docs record their local test scope. Real email delivery, cloud operations and deployment remain separate verification gates. CRM and Stripe remain deferred.

## 1. Make saved journey checks catch category and conditional-result changes

**Why now:** This closes a concrete QA blind spot before expanding the template library. It directly advances item 9 of the report.

**Current evidence:** `lib/journey-fixtures.ts:6–10` stores status, result ID, overall score and question sequence. `runJourneyFixture` at lines 83–94 compares only those. `lib/journey-testing.ts:131–152` evaluates the real marketing engine but discards category scores/coverage and resolved sections from its returned case. Therefore a category redistribution or changed conditional section can leave all existing assertions equal. This is a source-established coverage omission, not a claim that the current scoring engine is wrong. Representative paths, local storage limits and stale-draft notices already exist.

**Next bounded change:** Add optional saved expectations for every category's score/null and coverage, plus ordered resolved section IDs. Show precise differences in the current regression panel. Preserve old fixtures; label their narrower coverage and offer an explicit reviewed upgrade, never silently reset expectations. Keep finite-choice synthetic cases and current browser-local storage. Free-text fixtures/account synchronization can follow separately.

**Exclusive files:** `lib/journey-testing.ts`, `lib/journey-fixtures.ts`, `components/ConversationMap.tsx`, journey unit/browser tests and one feature note. No grading, marketing-engine, schema, player or publishing changes needed.

**Acceptance:** A pair of category changes with unchanged overall score fails; altered answered/applicable/null coverage fails; conditional-section appearance/disappearance/reordering fails; intended editorial changes remain distinguishable from behavioral failures; legacy fixtures load safely; rejected upgrades retain baselines; mobile/keyboard and quiz isolation pass. All checks remain local without creating attempts or responses. Do not label unsupported paths exhaustive.

## 2. Upgrade six existing templates into complete original campaigns

**Why now:** The report's template-quality finding remains materially open even though the platform now supports richer landing/results/report delivery. More catalog cards are not the priority.

**Current evidence:** `lib/template-catalog.ts:120–161` still creates most entries through the same five-question matching or six-question assessment pattern, with a short cover and generic optional capture. `lib/template-design.ts:53–60` supplies industry palettes, original cover copy and some existing local imagery. These are useful starting templates, not blank placeholders. They do not yet assemble the new landing sections, result layouts and complete per-template result sections. `components/TemplateLibrary.tsx:52–56` previews a visual/questions/results outline and gives a generic customization checklist.

**Next bounded change:** Enrich six existing IDs across product finder, service matching and scorecard use cases—e.g. coffee, home style, web design, course format, client onboarding and website readiness. Give each a coherent landing promise/benefits/FAQ, distinctive useful result content, an appropriate layout, original neutral/fallback copy and a short specific customization checklist. Reuse app-owned artwork; no external image generation, fake testimonial or invented performance claim. Clearly identify example offers and missing creator destinations. Keep all existing template IDs and blank-start behavior.

**Exclusive files:** new `lib/template-campaigns.ts` and optional fixture/metadata file; narrow integration in `lib/launch-templates.ts`; template detail/checklist in `components/TemplateLibrary.tsx`; existing template unit/browser tests plus new campaign fixtures. Avoid editing the landing/player/scoring components.

**Acceptance:** Six structurally valid independent drafts; every intended outcome plus neutral/fallback has a checked case; category/section expectations use priority 1 when available. Desktop/mobile preview, save/reload, publish snapshot and saved-report/PDF content agree on synthetic data. No misleading email promise or live placeholder CTA. Preserve existing catalog regressions and no-account draft creation. A “complete campaign” badge requires passing these checks rather than merely having more sections.

## 3. Add exact source/campaign/version cohorts to existing analytics

**Why now:** New attribution tables and answer distributions explain aggregate behavior, but creators cannot isolate a campaign or published version before deciding what to change. This is the remaining actionable part of report item 7; it should precede automated improvement suggestions or experiment winner language.

**Current evidence:** `app/api/forms/[id]/analytics/route.ts:16–20` accepts only the date range. `lib/analytics.ts:103–111` selects by quiz/date, while lines 158–161 aggregate that whole cohort. `components/ResultsChart.tsx:13–16` likewise requests only `range`. Source/campaign grouping and historical answer wording are already implemented; rebuilding them would duplicate completed work. Attempts retain frozen forms and sanitized attribution (`lib/attempts.ts:7–16`). Landing visits currently store no source, campaign or publication version (`lib/landing-visit.ts:4–11`).

**Next bounded change:** Add explicit clearable filters using retained attempt snapshot/version and sanitized source/campaign identities. Apply the same selection to all session-based totals, comparison periods, answer distributions and question CSV. Show unknown/historical values explicitly. Under these filters, label the existing landing panel “all observed landings” or hide it with an explanation; never divide a filtered start count by unfiltered visits. Do not retrofit unavailable historical attribution.

**Exclusive files:** new `lib/analytics-filters.ts`; narrow changes to `lib/analytics.ts`, `components/ResultsChart.tsx`, the analytics GET route, analytics unit/browser tests and one feature note. No tracking/storage schema, contacts or player edits for this slice.

**Acceptance:** Known synthetic cohorts across two versions, two sources/campaigns and unknown values reconcile every metric and export. Previous-period comparisons use the same selected cohort. Removed/renamed questions keep historical wording; previews remain excluded; null denominators stay unavailable. Rapid filter changes cannot show/export stale results; keyboard/mobile controls have clear state and one reset. Existing landing/source/answer analytics regressions still pass.

## Queue and limits

Run priority 1 first or alongside the template content work; use its stronger checks before marking the six campaigns finished. Priority 3 has an independent file scope. Root should continue coordinating one combined build and serialized browser suites.

Deferred, still real gaps: configurable/real result-email delivery, production verification, custom share slugs/domains, richer popup/chat embeds, typed journey fixtures, same-quiz participant benchmarks, guided experiment hypotheses/metrics, team roles and deeper numeric/product-set scoring. Their priority depends on customer use and external authorization. Do not reopen native PDF, brand-kit CRUD, contact pagination or inline resize as if absent. No new runtime tests, provider calls, research, live writes or application edits were performed in this prioritization pass.
