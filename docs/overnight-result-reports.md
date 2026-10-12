# Private result reports — 12 October 2026

## Implemented

A completed live quiz offers **Create private result link**. The respondent can open/copy a stable signed link and use **Print / Save as PDF** in its dedicated report. A report freezes the original result, theme and configured next step for 30 days from completion; later draft edits do not change it. A report remains available after the original 24-hour attempt expires.

The report uses an explicit allowlist. It omits contact fields, raw answer maps, respondent names and grading transcripts. Marketing recommendations and score/category explanations remain because they are the report itself. Anyone holding the bearer link can read that personalized result; the UI explains this before creation. These links are not public listings or authenticated account pages.

Tokens have a separate purpose and record-ID prefix, cannot act as quiz-attempt tokens, and expire at a fixed date. Creation requires a valid completed non-preview attempt and its retained submission. Repeated/concurrent requests resolve to one frozen report. Every report read checks that the original quiz/submission still exists and belongs to the stored owner, so deleting either revokes access. An owner/quiz-scoped retirement record prevents same-ID quiz recreation from reviving old links or allowing old attempts to mint new ones. Both attempt start time and the frozen published snapshot are checked, including an in-flight start that retained an old snapshot. Pages are dynamic/no-store, noindex/noarchive, and use no-referrer to avoid forwarding a private token to links or media.

Independent review also found that an old active A/B experiment could serve a deleted quiz snapshot. Assignment and start now verify both variants still belong to the experiment owner, remain published, and have not been retired since the experiment was created. Republishing an existing quiz preserves valid frozen experiments; deletion requires a new experiment.

## Tests

- `tests/result-reports.cjs`: safe allowlist, score preservation, fixed lifetime, clone independence, invalid completion date and unsafe CTA destination.
- `tests/browser-result-reports.cjs`: isolated local browser/API checks for pre-completion rejection; wrong/missing/cross-form token rejection; idempotent concurrent creation; result-token/attempt-token separation; anonymous bearer access; no private answer in HTML; no-store and privacy metadata; unchanged historical report after draft edits; original attempt expiry; report expiry; tampering; preview exclusion; visible player creation; deletion revocation; 390 px width and browser PDF output.
- TypeScript and scoped ESLint passed before final integration build.
- `tests/result-report-revocation.cjs`: deleted quizzes stay revoked after same-ID recreation; old completed and unfinished attempts cannot issue links; simulated late persistence of an old snapshot cannot issue a link; new responses still work; anonymous deletion is rejected.
- `tests/experiment-lifecycle.cjs`: 11 in-memory route/token/storage checks covering assignment, frozen republishing, cookies, either-variant deletion, recreation, fresh experiments, publication, ownership, pause and invalid tokens. Existing experiment aggregation tests also pass.
- Print regression includes real light/dark saved reports, exact retained text, 0/50/100% bar geometry, dark text/white cards and PDFs with backgrounds on/off. An immediate-print check caught the 150ms button color transition retaining white text temporarily; print styles now disable transitions and animations.
- Development CSS initially remained stale after the earlier production build; restarting the isolated dev server refreshed the new print rules. The full browser test then passed. Final production-mode verification belongs in the shared progress log.

## Honest boundaries

Printing uses the visitor's browser Print/Save as PDF flow, not a native server-generated or emailed PDF service. This batch sends no email. Report-link reads/clicks do not currently create original quiz analytics events. The link can be created while the original completed attempt is valid; an already-issued link lasts 30 days. There is no separate per-link revocation screen yet; deleting the response or quiz revokes it. Expired/revoked report records are inaccessible but remain in server storage until retention cleanup is added. Remote storage and production deployment are untested here.
