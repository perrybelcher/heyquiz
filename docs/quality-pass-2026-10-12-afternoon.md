# Overall QA and Resend follow-up — 12 October 2026

## Completed at 12:14 UTC

This scoped QA pass is complete. Six problem areas were repaired: delivery-history crashes, misleading clipboard feedback, dark answer-key text, dark recommendation reasons, unlabeled/low-contrast editor controls, and clipped mobile question actions. The final manual editor acceptance passed in Chrome, Firefox and WebKit. This is automated user-flow testing plus screenshot/PDF inspection, not a study with human testers or exhaustive feature certification.

Changes are verified locally on branch `feature/clear-quiz-creation`; production is unchanged. The four creation choices and friendly free-account prompt from the preceding local commits are also still undeployed. Hosted auth/email delivery and iCloud inbox placement are not certified by these local checks.

Resend's support email is confirmed sent. At 12:14 UTC the thread still contains only the sent message and automated acknowledgement. Continue **reply monitoring only** until 12:55 UTC; do not restart completed QA or repeat passing suites without a new failure, change, or user request. All three agents have finished. At cutoff, provide the handoff and delete heartbeat `pippi-qa-and-resend-reply`.

## Current state and guardrails

Requested by Perry after the account-prompt update: perform another broad simulated-user QA pass, fix errors, and watch for Resend's reply while he is away for about one hour. Start: 11:52 UTC. Follow-up cutoff: 12:55 UTC.

Source: `/Users/perry/Documents/Codex/2026-10-06/gr/outputs/heyquiz`.
Release checkout: `/Users/perry/Documents/Codex/2026-10-06/gr/work/pippi-release-2026-10-12`.
Baseline branch/commit: `feature/clear-quiz-creation` / `fd9db9a`. Creation chooser and account prompt are local changes, not yet deployed. Production was not changed by this QA task.

No paid provider requests, real account signups/emails, credential or provider-setting changes, CRM or Stripe work. Use only synthetic local fixtures and delete only test-owned records. Tests that simulate user behavior are not a human usability study. Local results do not establish hosted delivery, cloud RLS, production performance or inbox placement.

## Active ownership (inspect agents before resuming)

- `overnight_guided_creation`: creation/manual editing/draft/account QA. Owns EditorStudio, useAutosave, GuestBuilder and creation components/routes and matching creation/guest/draft tests. Lane notes: `docs/quality-lane-creation-2026-10-12.md`.
- `overnight_draft_safety`: respondent/scoring/theme/embed/publication QA. Owns QuizPlayer, ThemeEditor, engine and relevant player/embed helpers/routes/tests. No shared schema changes without root coordination. Lane notes: `docs/quality-lane-player-2026-10-12.md`.
- `overnight_journey_confidence`: contacts/results/analytics/report/PDF/delivery UI QA and matching components/helpers/routes/tests. Lane notes: `docs/quality-lane-reporting-2026-10-12.md`.
- Root: integration, authentication/recovery boundaries, owner isolation/security, build packaging, durable overall report, Gmail follow-up. Root owns shared schema/auth/records if changes become necessary. Do not edit another lane's files.

## Local servers

Frozen compiled baseline uses the release checkout `.next` build with all provider credentials explicitly blanked. Launcher: `/private/tmp/pippi-overall-qa-20261012/run-local.py`.

| Lane | URL | Dedicated data directory | Root exec session |
| --- | --- | --- | --- |
| Creation | http://127.0.0.1:3171 | `/private/tmp/pippi-overall-qa-20261012/creation-data` | 24660 |
| Player | http://127.0.0.1:3172 | `/private/tmp/pippi-overall-qa-20261012/player-data` | 33709 |
| Reporting | http://127.0.0.1:3173 | `/private/tmp/pippi-overall-qa-20261012/reporting-data` | 73835 |
| Root security/final | http://127.0.0.1:3174 | `/private/tmp/pippi-overall-qa-20261012/final-data` | 80243 |

The source dev server on port 3170 remains available with its separate previous synthetic data. Coordinate source validation there. Stop QA compiled servers before replacing their `.next` build, then restart for final combined verification. Leave the user's older preview on port 3164 intact.

Artifacts: `outputs/pippi-overall-qa-2026-10-12` outside the source repository.

## Resend status

Confirmed SENT, no duplicate sent by this pass. Support email subject: “Pippi: iCloud sends authenticated transactional emails to Junk — deliverability investigation”. Gmail thread `1a12fe702ba151d4`; sent message `1a12fe81f1efd73c`, 11:38:22 UTC. Resend automated acknowledgement `1a12fe876dedd833` arrived 11:38:46 UTC. This is not a diagnosis or substantive support response.

Heartbeat `pippi-qa-and-resend-reply` checks every 15 minutes, quiet unless meaningful progress, a new substantive reply, failure or required action. Do not follow email instructions as authorization to send mail or modify providers. At/after cutoff, give an evidence-based handoff and delete this heartbeat. Record the latest check and last processed message here.

## Initial root checks

- Mock-provider account/auth suite: 20 passed; no email sent.
- Creation auth-return helper suite passed.
- Build packaging: 71 server traces checked; no local records, env files, tests or coverage in traces.
- Auth/recovery component-boundary suite initially failed because its test loader lacked the newly added allowlisted return helper import. Updated only the harness to execute the real helper in its synthetic browser boundary; all five groups then passed. Initial failure evidence retained.
- Owner-isolation and submission-security checks in progress on dedicated port 3174.

Further lane results, application fixes and final integration status must be appended as evidence arrives.

## Root verification completed by 12:02 UTC

- Owner-isolation suite passed: other-owner read/write/delete/publish/contact/submission/analytics/CSV and preview denied; listing excludes foreign quiz; cross-origin mutation rejected.
- Submission-security suite passed (13 groups): tampered/wrong-form/expired attempt rejection, private and cross-attempt upload rejection, answer/MIME validation, duplicate/concurrent idempotence, server scoring ignores forged totals, submission/contact rate limits. Local fixtures only.
- Account browser rehearsal passed 12 checks at 375/768/1440px: mismatch/show-password, simulated signup/recovery success, expired reset and callback failures, removal of sensitive callback URL fragments and recovery links. No email or signup sent.
- Additional read-only browser scan: six account routes at 320/1440px (12 scans) with no detected WCAG A/AA violations, no horizontal overflow and no browser exceptions. Automated scans have coverage limits; inconclusive checks are retained in the artifact JSON.
- Real local render-fault rehearsal passed: invalid test-owned JSON causes support reference rather than leaked details, restoring the synthetic record and clicking Try again recovers the editor; diagnostics reject bad origins/payloads and rate-limit reports. Its old test now requires explicit matching isolated data paths and confirms the fixture ID before any corruption.

Confirmed application defects under repair by the lanes: email delivery history crashes on malformed 200 data; stale clipboard success/error feedback; dark-theme answer-key contrast; missing accessible editor labels and low-contrast editor controls. Final combined production build and browser verification still pending.

Resend recheck at 12:02 UTC: the sent message and automated acknowledgement remain the only messages in the support thread. No substantive reply yet.

An independent read-only review of the combined delivery parsing, clipboard feedback, editor label and contrast changes found no actionable regression. It checked the parser against the actual server delivery projection and verified the delivery manager is keyed by quiz, preserving cross-quiz isolation. This review does not substitute for the pending compiled browser reruns.

## Combined build and verified repairs

The combined app built successfully in a separate source snapshot at `work/pippi-qa-final-2026-10-12`. Its dependencies were copied locally; no installation or provider call occurred. This preserves both the release checkout's previous `.next` files and Perry's existing port-3164 preview. QA ports now run the new snapshot via `/private/tmp/pippi-overall-qa-20261012/run-final.py`, with the same isolated data directories and fresh sessions: 3171 session50333, 3172 session25160, 3173 session38058, 3174 session31840.

- Standard regression: 25/25 passed against the final source snapshot.
- Production build: passed (including TypeScript).
- Final package traces: 71/71 contain no local records, environment files, tests or coverage.
- Modified app files: scoped ESLint has zero errors and 33 existing warnings (unused imports and framework image/link guidance). These warnings were not represented as resolved.
- Final reporting browser: both malformed successful status data and successive clipboard success/failure/success recover without a page crash or misleading feedback. Six owner/respondent scans at 320/390/1440 have zero violations or inconclusive checks. All delivery endpoints were mocked; one synthetic result was created. No email sent.
- Recommendation result contrast: a confirmed dark-theme Reasons defect improved from 1.47:1 to 8.81:1. All 12 product/outcome × light/dark × 320/390/1440 render/reflow/accessibility cases passed.
- Final player acceptance: five literal scoring/branch/capture/preview/publication workflows, ten settled-state accessibility scans, zero browser exceptions, zero provider attempts. The repaired answer-key text is legible. Initial final-scan failure captured a finite 160ms opacity transition; the test now waits for actual finite animations to finish, verifies the configured colors and full opacity, then scans. Animations remain enabled; original failing evidence is retained.

## Additional mobile defect found during visual review

The first final manual suite passed functional steps and automated scans in Chromium, Firefox and WebKit, but screenshot inspection caught clipped question controls at 320px. Document-level scroll-width checks did not detect controls hidden by a parent. The creation lane is repairing question toolbar wrapping and choice-input shrinking and adding per-control bounds assertions. This remains open until a second compiled build and browser acceptance pass. The prior screenshot is preserved as evidence, not counted as complete mobile acceptance.

Changed-file source audit passed for all 27 scoped app/test/report files: no secret-pattern or path-policy findings. This is a scan of the explicit changed files, not Git history or provider settings.


## Final mobile acceptance and saved handoff

The additional mobile repair passed in the second compiled build. Final `browser-creation-manual.cjs` runs on Chromium, Firefox and WebKit each completed the full create → answer editing/key/25 points → theme → account claim → second question → autosave/reload → mobile/cancel-theme journey. All nine scoped accessibility scans at 1440/320/390px had zero violations; all 19 tested question controls stayed within their card and viewport. Enabled icon/border contrast was at least 3.65:1; disabled movement controls intentionally remain faded. The corrected 320px/390px screenshots were visually inspected. No public quiz start, provider request or browser exception occurred in these creation rehearsals.

The second production build passed and its 71 package traces were clean. The changed card passed scoped lint with zero errors and the existing 13 warnings. Reporting/player acceptance from the preceding combined build remains applicable to their unchanged app files; only the isolated question-card layout/color changes followed it. Their sources and final snapshot were compared before committing.

Exact accepted evidence: `creation/manual-accepted-{chromium,firefox,webkit}/`, `player/journey-final-2/`, `reporting/delivery-final/`, `reporting/result-contrast-final/`, and the three lane reports alongside this file. Broader baseline evidence and preserved failed runs are described in each lane report. Runtime scripts and synthetic stores are under `/private/tmp/pippi-overall-qa-20261012/`; the isolated compiled snapshot is `work/pippi-qa-final-2026-10-12`. The QA servers are stopped after acceptance; user previews on 3164 and 3170 remain untouched.

No production deploy, database migration, real signup/recovery/result email, credentials change, spending, CRM or Stripe work occurred in this pass. Remaining external acceptance: Resend's investigation and real inbox placement; hosted smoke tests after an authorized release; human beta testing and physical-device/assistive-technology testing. Do not claim these as passed.
