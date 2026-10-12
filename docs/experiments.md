# Conversion experiments

Open `/experiments` from the workspace A/B tests link. Publish two versions of a quiz, choose them as A and B, and share the generated `/experiment/<id>` link. Ordinary `/play/<id>` links do not allocate experiment traffic.

Launch stores complete snapshots of the published versions. Editing, republishing or unpublishing the original quizzes does not alter these snapshots. Either unpublished quiz blocks new experiment assignments and starts; republishing restores availability. Deleting a quiz permanently retires its old experiments, even if the same ID is recreated. You can also pause the experiment to stop new starts. Existing signed attempts can finish after a pause. Create a new test when changing variants; resuming preserves the original snapshots.

Allocation uses a server-generated random 50/50 choice and a signed, HttpOnly cookie lasting 90 days. Small samples need not split evenly. Clearing cookies, switching browsers/devices, and cookie restrictions affect visitor counting. The initial landing-page view is not counted as a start: a visitor must start the quiz.

Attempts carry the experiment ID, anonymous visitor ID and variant. The server verifies the assignment and freezes the assigned form into the existing signed attempt. Preview and direct-link attempts are excluded from the experiment report. Each visitor contributes at most once to each metric, including repeat attempts; a later successful attempt can count a conversion. Leads come from stored submissions, including after-result capture. Deleted submission contacts are not recovered from attempt snapshots. Rates use unique starters as their denominator. Standard per-quiz analytics continue to include all traffic to that quiz, including experimental traffic.

Reports are descriptive, not statistical winner declarations. Under 100 visitors in either arm shows an early-data message. Exceeding that number does not establish significance. Select a primary metric and planned test duration before sending traffic; avoid repeated early stopping. Automated significance, experiment-specific step funnels, and revenue attribution are not part of this release.

Validation: `node tests/experiments.cjs`; isolated Chrome/API journey with `TEST_BASE_URL=http://127.0.0.1:3166 node tests/browser-experiments.cjs`. Browser test requires local mode and creates synthetic data: use a disposable HEYQUIZ_DATA_DIR, never production. Existing regression and analytics suites also apply.

## Optional prelaunch plan

On `/experiments`, select **Record a test plan before launch (recommended)** to add a hypothesis and intended one change. Choose completion rate or captured-contact rate as the primary metric. Captured-contact rate requires capture enabled in both selected published snapshots. A captured contact is not a marketing opt-in, qualified lead or purchase.

You may add a completion-rate floor (0–100%) and a calendar review date in UTC. Neither has an invented default. The floor is a prompt to review observed completion, not a statistical rule, automatic stop or safety guarantee. When completion is also the primary metric, the floor explicitly uses that same metric. The date appears as a reminder in the report; it does not send notifications or schedule an action. No-start cohorts remain **Not measured**, including a test with a zero floor. Floor checks use raw fractions, while rates are displayed rounded.

**Review test plan** shows the plan and published A/B titles before **Confirm and launch test**. Back/Escape preserves inputs without saving. If a published snapshot changed since it was loaded for review, launch returns a conflict and keeps the inputs; refresh the versions and review again. The digest is computed from a canonical full snapshot, so JSON key order alone is not a change. An accepted plan is frozen in the experiment record with its variants. Pause/resume cannot replace any plan field, metric, title or variant; create a new test for a different plan. The intended change is creator supplied, not automatically checked against a structural diff.

Basic launches and older experiments without a plan still work. Their reports say **No plan recorded before launch**, rather than retroactively choosing a primary metric. Plans contain only owner-entered text and configuration; there is no generated analytics evidence, AI request or automatic rewrite. The new plan has no effect on random assignment, sticky tokens, scoring, completion or contact capture.

Additional validation: `node tests/experiment-plan.cjs`, `node tests/experiment-plan-api.cjs`; compiled-browser suite `tests/browser-experiment-plan.cjs` passed against isolated batch 8 and requires `TEST_BASE_URL`, explicit isolated `HEYQUIZ_DATA_DIR` and all cloud environment variables empty. Its report-state and response-order checks use explicit intercepted synthetic DTOs, not persistent conversion events.
