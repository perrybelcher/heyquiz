# Scoring diagnostics, drafts and analytics — 10 October 2026

## Shipped

Marketing now displays scoring diagnostics: missing positive mappings, unmapped answers, add/exclude conflicts, unreachable outcomes, tie behavior and fallback paths. Exhaustive enumeration is capped at 4,096 paths and limited to simple single-choice quizzes without branching. Other configurations explicitly receive rule-only checks; the existing simulator remains the place to test complex journeys. Warnings are advisory rather than publishing blockers because neutral choices, ties and exclusions can be intentional.

Draft recovery now prefers an isolated session-storage copy for each editor tab. A save removes shared local backup only if it matches what was saved. Storage access errors no longer crash initialization; write failures show a visible warning. Shared local storage remains a last-draft fallback after closing tabs, not a durable archive of all historical tab versions. Keep unsaved tabs open. Stale server revisions remain protected by the existing conflict check.

## Verified locally

- Production build and TypeScript passed. Existing build filesystem-tracing warnings remain.
- Scoped lint: no errors; existing internal navigation warning in autosave.
- Scoring diagnostics tests: reachability, ties, conflicts, neutral choices, large/multiselect configurations not falsely marked exhaustive.
- Playwright scoring panel: visible exhaustive path count and intentionally unreachable/tied outcome warnings.
- Playwright drafts: failed save, two open tabs, successful save in one tab, reload and restore in the other, stale revision rejected, storage failure warning with successful server save.
- Playwright expired authentication: separate sign-in preserves editor state, retry saves correctly.
- Analytics: 13 aggregate tests plus seven scoring/accuracy groups passed, including a hand-calculated funnel (10 starts, 6 completions, 4 leads, 3 consents, 5 result views, 2 clicks, median 35 seconds), preview exclusion and abandonment semantics.
- Analytics Playwright/API: 15 checks passed including permissions, dashboard, CSV export, mobile layout and failed-request display.

Synthetic local data only for this pass. These are not production traffic/load tests or proof that all quiz paths and browsers are covered. No analytics defect was found by this pass, so calculation logic was not changed. CRM and Stripe remain deferred.
