# Independent Pippi beta review

Review the repository in a fresh context. Begin with your own assessment before reading docs/final-qc-2026-10-09.md, to reduce anchoring. Do not assume passing tests prove correctness.

Work on an isolated branch with synthetic local data. Do not deploy, change credentials, read secret values, delete user records, or contact real CRM/email recipients. Use the repository's local-mode setup and inspect test prerequisites. Production journeys need an explicitly provided test account/session.

Prioritize reproducible P0/P1 defects:
- Guest creation → signup/email confirmation → recover original draft → save/reload.
- Authentication expiry, password recovery, owner isolation, public/private API boundaries.
- Publish a snapshot, edit the draft, open the public link anonymously; no 404 or draft leakage.
- Per-answer scoring, multiselect, branching/skipped answers, ties, zero versus missing answers, score bands, product exclusions.
- Completion/lead/CTA analytics, duplicate submission and retry behavior, consent and PII exposure.
- AI provider failures, malicious/model-invalid output, secret handling, generation rate limits, editable draft recovery.
- CRM retries, idempotency, mapping and authorization; distinguish mock coverage from real delivery.
- Keyboard/mobile use, poor network, two tabs, reload, and preservation of unsaved work.
- Deployment tracing and accidental inclusion of local records or environment files.

Run the existing test suites, but add independent adversarial cases. Do not weaken tests to obtain green output. Use real browser journeys as well as source review. Record browser, environment, commit, steps, expected/actual behavior, severity, affected file/line, evidence and proposed fix for each finding. Explicitly list blocked checks and coverage limits. Finish with a conditional beta go/no-go, not a numerical quality score.
