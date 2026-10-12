# Scoring and analytics accuracy — 9 October 2026

## Result
No scoring or analytics discrepancy reproduced in this pass. No application logic was changed. Added `tests/scoring-analytics-accuracy.cjs` as a repeatable regression suite.

## Checks run
- `node tests/regression.cjs`: 25 existing regression checks passed.
- `node tests/analytics.cjs`: 13 analytics checks passed.
- `node tests/scoring-analytics-accuracy.cjs`: seven extended groups passed, covering nine weighted answer combinations, multiselect subsets and duplicate selections, missing versus zero answers, invalid point configuration, product thresholds/ties/exclusions, knowledge partial credit and passing boundaries, and a hand-calculated funnel.
- `TEST_URL=http://127.0.0.1:3153 node tests/marketing-api.cjs`: 12 server/API checks passed across product finding, segmentation and scorecards, including saved results and preview exclusion.
- `TEST_BASE_URL=http://127.0.0.1:3153 node tests/browser-analytics.cjs`: 15 browser/API checks passed, including event deduplication, owner access, CSV export, mobile layout and error handling.
- `TEST_BASE_URL=http://127.0.0.1:3153 node tests/browser-answer-scoring.cjs`: answer points, zero scores, persistence, mode-change confirmation and exclusions passed.

## Independent funnel expectations
Ten starts, six completions, four leads, three consented leads, five result views, two offer clicks. Expected completion rate 60%, lead rate 40%, offer click rate 40%, median completion time 35 seconds. Three inactive unfinished sessions; one recent unfinished session was not counted as inactive. Question reach/completion/inactive counts: Q1 10/6/1, Q2 8/6/2. Daily and result-group totals reconcile with headline totals. A preview attempt is excluded. Aggregate output contains no raw contact email.

## Scoring semantics verified
Scorecard percentages use mapped answered questions; insufficient category coverage returns no score. A mapped zero counts as an answer. Multiselect scorecard maxima sum configured option weights; knowledge multiselect applies partial credit and penalties, bounded at zero. Product ties use declared result order and exclusions override points. Negative or nonfinite point configuration is rejected.

## Scope and limits
All new submissions used an isolated local data directory and disabled external services. Production quizzes, contacts and analytics were not modified. These tests do not establish production traffic capacity, physical-device behavior, real CRM delivery, or real-world conversion performance. The ten-session fixture verifies aggregation independently; browser/API checks separately verify event capture and dashboard rendering.
