# Pippi competitive development plan

Updated 2026-10-09. This is a delivery plan, not a claim of competitive superiority.

## Delivered foundation
- Quiz editor, answer scoring, segmentation and product matching.
- Scorecard result bands, category advice, prioritized actions and contextual CTA.
- Completion, question-level and offer-click analytics.

## Current increment: marketing quiz studio
- Audience, offer, concerns, voice, desired action and explicit result/category brief.
- AI output compiled into existing quiz, scoring and result models.
- Creator can inspect question rationale and answer scoring, simulate results, then save an unpublished draft.
- Destinations come only from the brief; generated text cannot invent destinations.
- Unknown answers remain unscored; every target needs positive scoring coverage.
- Optional lead capture does not enable marketing subscription by default.
- Requires the existing server-side Gemini connection. Mocked provider tests do not establish real-provider quality or availability.

## Next increments and acceptance criteria
1. Follow-up delivery: result-specific payload reaches an authorized CRM test destination; verify retry, duplicate prevention, consent and visible failure recovery. Do not fire customer automations during tests.
2. Results delivery: revisit a personalized report securely, request an email copy, verify delivery and expiration without exposing another respondent's answers.
3. Optimization: stable experiment assignment, revision-aware metrics, minimum-sample guidance and truthful uncertainty. Distinguish clicks from purchases.
4. Revenue attribution: signed conversion ingestion, idempotency, currency-aware reporting, refunds and campaign/quiz/variant mapping. No implied causal lift from attribution alone.
5. Ads: consent-aware server events with browser/server deduplication and provider delivery diagnostics.
6. Commerce: catalog synchronization, availability, exclusions and checkout handoff. Current product matching is not inventory-aware commerce orchestration.
7. Usability and operations: independent create-to-publish sessions, keyboard/mobile coverage, workload testing, monitoring and recovery drills.

## Evidence needed before claiming superiority
Run the same creator and respondent tasks on competing products, record completion time and failures, and measure live funnel results with comparable traffic. A feature count or passing regression suite is not evidence of higher conversion.
