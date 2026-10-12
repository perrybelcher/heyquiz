# Next experiment pass: record the decision before sending traffic

Read-only proposal for competitive-review item 10. No experiment, traffic, AI request or application change was made for this proposal. Inspection reflects batch-7 source on 2026-10-12; older comparison-report inventories are not a current feature checklist.

## What already works

- `lib/experiments.ts:6–10` stores two full published snapshots. `availableExperiment` requires both current quizzes/published records to belong to the owner and rejects snapshots retired by deletion; republishing preserves the intentionally frozen versions. Assignment/resolve use signed tokens, and `app/api/experiments/[id]/assign/route.ts` keeps the approximately 50/50 browser assignment for up to 90 days.
- `experimentStats` deduplicates each anonymous assigned browser once per arm/metric, excludes preview/direct/other-experiment traffic, and ignores a later conflicting arm. Owner GET replaces cached attempt results with retained submissions, preserving contact deletion semantics. Completion, captured contact and recorded offer-click counts already exist.
- `components/Experiments.tsx:27–36` offers name, two published versions, launch/pause/resume, descriptive counts/rates and an early-data warning. It advises choosing a primary metric, but neither a hypothesis, primary metric nor guardrail is stored. Above 100 starters it still does not declare a winner.
- `components/ResultsChart.tsx:44,76–79` already identifies a step with quiet unfinished sessions, shows the counts and explicitly avoids causation. `lib/analytics.ts:123–147` supplies reached/measured/quiet counts by retained question wording; new source/campaign/publication filters preserve the cohort. Quiet means an unfinished tracked session with no activity for 30 minutes, not confirmed abandonment.
- `lib/quiz-copy-review.ts` provides deterministic editorial hints (including long questions and leading/shaming language). It is currently used in the brief preview, not connected to observed analytics. `lib/diagnostics.ts` is privacy-minimal failure logging, not a conversion-diagnosis engine.

## Smallest useful next batch

**Add a reviewed, immutable test plan to the existing two-variant launch flow.** Keep the existing manual duplicate/edit/publish workflow. No automatic rewriting, variant creation or scoring change is needed in this batch.

1. Offer an optional **Plan a test** action from the existing question-performance insight. Carry only the quiz ID, exact selected question/wording identity and validated range/source/campaign/version selectors. Load owner-scoped aggregates again; never trust counts supplied in a URL or request body. The plan can also be started manually with no evidence claim.
2. Show an editable sentence, a single proposed change, and the observed evidence side by side. Example: “If we make this question easier to understand while keeping its answer meanings, more participants may finish.” Supporting text must say “X of Y measured sessions that reached this wording were unfinished and quiet for 30 minutes; they may return.” Only suggest shortening when the selected retained wording actually exceeds the existing copy-review length rule. Otherwise suggest reviewing clarity/effort rather than inventing a diagnosed cause. Zero measured sessions yields no measured-leak suggestion. Earlier wording must remain labeled; do not attach today's question title to older measurements.
3. Save a creator-chosen **primary metric** from completion rate or captured-contact rate, both divided by the existing assigned-browser starters. Show contact capture as unavailable when either frozen arm has capture disabled. Preserve offer clicks as a secondary descriptive count for now: its current experiment aggregate lacks explicit event-coverage reporting and it is not a sale.
4. Save a simple **completion-rate floor** as the guardrail: “Review the change if observed completion is below ___%.” Validate 0–100, with no invented industry default. If completion is also primary, explicitly explain that the guardrail is a floor on the same metric, not an independent signal. A planned review date is a reminder in the saved plan, not an automatic stop or sample-size prescription.
5. Review the plan and selected A/B titles before the existing launch operation. Store the plan with the same frozen experiment record. Afterwards show the plan above the table, highlight its primary metric, and display the completion floor beside observed counts. Below-floor data is a **review signal**, never proof of harm; above-floor data is not a safety or winner verdict. No entrants means “Not measured”/dash, not a 0% conversion result. Do not add lift, significance or automatic promotion.

This intentionally completes the hypothesis/metric/guardrail decision record, not all of item 10. The creator still makes and reviews the one intended change. Label that description as creator supplied; do not certify that two arbitrary published quizzes differ in only one way. A reliable structural diff and reviewed one-click variant creation can follow separately.

## Data and safe file scope

Add an optional versioned plan to `Experiment` for backward compatibility: bounded hypothesis/change text, `primaryMetric`, completion-floor value, review date, and optional **server-computed** aggregate evidence snapshot (quiz/question/wording identity, cohort selectors/labels, range, captured time, reached/measured/quiet counts). Do not store respondent answers, contact fields, browser IDs or tokens in the plan. Evidence is a saved rationale, not an experiment denominator. Plain text only; no HTML rendering or URL-fetching. Validate body size as well as field lengths.

Proposed ownership:

- `lib/experiments.ts`: optional plan type and pure display-metric helper only; leave assignment, availability and aggregation behavior intact.
- New `lib/experiment-plan.ts`: bounded validation, deterministic suggestion/evidence allowlist, null-safe rates/guardrail presentation.
- `app/api/experiments/route.ts`: validate/recompute owner evidence at creation, persist the immutable plan, return it to its owner. Reuse existing owner-scoped analytics helpers/record adapter; no new database migration.
- Optional new `app/api/experiments/ideas/route.ts`: owner-only read endpoint for source evidence if needed to avoid duplicating client-side calculations. No write or AI operation.
- `components/Experiments.tsx`: guided plan/review fields, old-record labeling, primary-metric/floor presentation and accessible loading/error states.
- `components/ResultsChart.tsx`: one optional navigation action carrying the current validated cohort; no changes to existing cohort calculations.
- `tests/experiment-plan.cjs`, `tests/browser-experiment-plan.cjs`, and `docs/experiments.md`.

`PATCH /api/experiments/[id]` must continue accepting only pause/resume changes: do not permit retroactive plan or variant replacement. Legacy records show **No plan recorded before launch** rather than silently receiving today's defaults. No changes to schema, player, engine, start/submit/assignment routes, signed cookies, record kinds, experiment allocation, CRM or Stripe.

## Acceptance and limits

- Pure cases: no data returns unknown; denominator is assigned-browser starters, never landing visits or all quiz sessions; retakes remain deduplicated; 0/100% floors and exact boundaries are correct; completion-primary explains the shared guardrail metric. Counts/rates stay unchanged for older experiments.
- Evidence/API cases: owner-only reads/writes; anonymous/wrong owner/cross-origin rejected; request-supplied counts ignored/rejected; exact source/campaign/publication/wording retained; old wording not relabeled; zero, sparse and untracked data have honest text; bounded text/body, invalid metrics/dates/floors rejected; plan immutable across pause/resume/republish. Deleted/recreated variants remain retired through existing lifecycle tests.
- Browser cases on isolated synthetic data: manual plan and evidence-prefill, edit/cancel without writes, review before launch, creation error retains input, frozen plan after reload, legacy no-plan display, below-floor/unknown states, keyboard labels/errors and 390px reflow. Run existing `tests/experiments.cjs`, `tests/experiment-lifecycle.cjs`, and `tests/browser-experiments.cjs` after the change. Clean synthetic fixtures; no production/provider calls.
- Existing all-time experiment aggregates are descriptive and can change as later attempts complete or retained contact records are deleted. A fixed analysis horizon, cohort maturity, event coverage, confidence intervals, experiment-specific step funnels and automatic stopping require separate design. Do not present per-quiz session evidence as the experiment's browser-level outcome rate or imply that a chosen review date makes a test conclusive.
- Correct the stale sentence in `docs/experiments.md` claiming unpublishing does not affect the test: snapshots are unchanged, but either unpublished quiz currently blocks new assignments/starts; republishing restores availability unless deletion retired the experiment. This is a documentation correction, not a requested lifecycle change.

No runtime checks were needed for this read-only proposal. The earlier experiment unit/browser evidence and their exact scope remain in their existing logs; this document makes no new live or statistical validation claim.
