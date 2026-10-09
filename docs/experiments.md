# Conversion experiments

Open `/experiments` from the workspace A/B tests link. Publish two versions of a quiz, choose them as A and B, and share the generated `/experiment/<id>` link. Ordinary `/play/<id>` links do not allocate experiment traffic.

Launch stores complete snapshots of the published versions. Editing, republishing, or unpublishing the original quizzes does not alter these snapshots. Pause the experiment separately to stop new starts. Existing signed attempts can finish after a pause. Create a new test when changing variants; resuming preserves the original snapshots.

Allocation uses a server-generated random 50/50 choice and a signed, HttpOnly cookie lasting 90 days. Small samples need not split evenly. Clearing cookies, switching browsers/devices, and cookie restrictions affect visitor counting. The initial landing-page view is not counted as a start: a visitor must start the quiz.

Attempts carry the experiment ID, anonymous visitor ID and variant. The server verifies the assignment and freezes the assigned form into the existing signed attempt. Preview and direct-link attempts are excluded from the experiment report. Each visitor contributes at most once to each metric, including repeat attempts; a later successful attempt can count a conversion. Leads come from stored submissions, including after-result capture. Deleted submission contacts are not recovered from attempt snapshots. Rates use unique starters as their denominator. Standard per-quiz analytics continue to include all traffic to that quiz, including experimental traffic.

Reports are descriptive, not statistical winner declarations. Under 100 visitors in either arm shows an early-data message. Exceeding that number does not establish significance. Select a primary metric and planned test duration before sending traffic; avoid repeated early stopping. Automated significance, experiment-specific step funnels, and revenue attribution are not part of this release.

Validation: `node tests/experiments.cjs`; isolated Chrome/API journey with `TEST_BASE_URL=http://127.0.0.1:3166 node tests/browser-experiments.cjs`. Browser test requires local mode and creates synthetic data: use a disposable HEYQUIZ_DATA_DIR, never production. Existing regression and analytics suites also apply.
