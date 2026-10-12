# Saved result link management — overnight batch 4

Implemented 12 October 2026. Local synthetic validation only; no production data, messages, provider calls, scheduler or deployment.

## Owner experience

The Contacts screen now includes a separate **Saved result links** section:

- Active, expired, revoked and never-created status, completion date, original expiry, pagination (25 responses per page), and quiz-wide counts.
- Status listing is driven by retained quiz responses, including responses without contact details. Deleting a response removes it from the listing; cached attempts and report copies cannot recreate it.
- Full response IDs are visible in expanded contact details. **Find response by full ID** selects that exact response in the link manager without putting names/emails/answers into the report-management endpoint. Searching changes matching rows/pagination; totals remain quiz-wide.
- **Revoke link** asks for explicit confirmation: permanent loss of link access, no replacement link from that response, and the original quiz response is kept. Cancel leaves the link unchanged.
- **Clean expired copies (up to 25)** asks for explicit confirmation and deletes only expired saved-report payloads for that quiz. It does not remove responses, contacts, attempts, active links, revocation records or quiz retirement records.
- Loading, empty/no-match, stale-data/error, retry, partial cleanup failure and successful action messages are distinct. Destructive controls are disabled while a mutation/load is in progress or the last status refresh failed. Native confirmation dialogs support keyboard access; notifications use status/alert roles.

“Not created” is different from “Expired.” A response that never issued a link remains Not created even after its creation window ends. An expired link that was cleaned remains Expired using a minimal expiry receipt. No new link can be issued after the original 30-day completion window.

## Data and API contracts

Uses the existing generic record adapter with no migration or backend-specific APIs:

- `result_reports`: existing immutable, allowlisted report snapshots.
- `result_report_revocations`: existing durable quiz retirement timestamps, preserved unchanged.
- `result_report_link_revocations`: durable per-response revocation receipt, keyed by SHA-256 of owner + quiz ID + response ID. Payload has only quiz ID, response ID and revocation timestamp.
- `result_report_expirations`: minimal record that an issued link expired, keyed the same way. Payload has only quiz ID, response ID and the original expiry timestamp. Written before removal so a failed delete can be retried without losing status history.

Owner-authenticated endpoints:

- `GET /api/forms/:id/report-links?page=1&responseId=<optional exact ID>` — sanitized metadata only. `rows`, quiz-wide `total`/`counts`, filtered `matched`, `page`/`pages`, and cleanup-eligible `expiredCopies`. No bearer token, result content, raw answer or contact data.
- `DELETE /api/forms/:id/report-links` with `{responseId}` — permanently revoke a retained response's existing report. Repeated/concurrent calls are idempotent, including after its copy was removed.
- `POST /api/forms/:id/report-links/cleanup` — remove up to 25 expired copies from a live owned quiz, or a deleted quiz whose durable retirement record verifies that same owner and quiz ID; return removed, remaining, failed and fixed batch size. No client-supplied batch-size override.

Every endpoint checks owner access and request origin and returns private/no-store caching headers. Foreign quiz/response access does not expose metadata. Cleanup denies an old owner if that quiz ID currently belongs to another owner. Listing and individual revocation still require a live owned quiz. The existing private result page is still a bearer-link view: anyone holding an active link can view its allowlisted report until expiry/revocation/deletion.

## Concurrency and retention safeguards

Issuance checks the original retained submission's timestamp before any write. An expired attempt replay therefore cannot recreate a report removed by cleanup. Individual revocation is checked before snapshot creation and again before returning a link; every saved-report read also checks it. An issue call already in progress cannot turn a committed revocation back into access.

A read already authorized before revocation commits cannot be recalled, and an already-open browser page cannot have its rendered content erased. Later requests are denied; the product does not claim to erase downloaded PDFs/screenshots.

The stable revocation receipt uses an optimistic expected-version write and reconciles a concurrently written matching receipt. It is never removed by cleanup. Existing quiz retirement, missing-response denial, immutable result/theme snapshots, attempt-purpose separation, original 30-day expiry, and report printing remain in place.

Cleanup verifies owner, quiz, response linkage and exact original completion-plus-30-day expiry. A malformed/shortened expiry does not authorize early deletion. It re-reads each candidate before deletion, writes its minimal receipt first, and tolerates another cleanup already removing the same immutable copy. Per-call destructive work is capped at 25. Failures retain the report for retry and surface a partial-failure count where possible.

## Validation

Passed against source:

- `node tests/report-management.cjs`: real isolated filesystem adapter; metadata allowlist; owner/form/response isolation; exact-ID targeting and quiz-wide count semantics; five concurrent revokes; deterministic in-flight issue/revoke race; stale replay and expiry pre-write rejection; 25-copy limit; concurrent cleanup; fresh/foreign/malformed-copy preservation; durable quiz/response revocations; cleanup receipt failure/retry; pagination; deleted response and same-ID quiz recreation denial; deletion followed by expiry and owner-authorized orphan cleanup; live foreign ownership precedence; fresh/malformed/foreign orphan preservation.
- `node tests/result-reports.cjs`: frozen allowlist, scores, expiry and safe destination behavior.
- Scoped ESLint on all six changed/new TS/TSX modules/routes: passed.
- `tsc --noEmit --incremental false`: passed.
- `node --check tests/browser-report-management.cjs`: passed.

Compiled browser/API verification passed on 12 October against the parent’s combined batch-4 build at `http://127.0.0.1:3163`, using the isolated test-data directory. `tests/browser-report-management.cjs` verified genuine API auth/origin/owner boundaries, metadata privacy, contact-ID targeting among multiple responses, cancellation/confirmation, permanent denial/repeated revoke, response isolation, cleanup preservation, API failure/recovery and mobile overflow. Desktop and mobile screenshots were visually reviewed. No app/test fixes were required; the suite never sent email or called external providers.

Evidence: `../pippi-overnight-2026-10-12/compiled-verification-batch-4/browser-report-management.log`, with `report-management/report-manager-desktop.png` and `report-management/report-manager-mobile.png` beside it.

## Limits and remaining work

- Pagination bounds browser output and cleanup bounds destructive work; the generic adapter still scans all of the owner's records for each listing/cleanup. Large production accounts should move these filters/counts to a bounded indexed backend query before claiming large-scale retention performance. No migrations were added in this pass.
- Cleanup is owner-triggered only. No recurring job or production cleanup ran. Expired copies belonging to deleted quizzes can be cleaned through the owner-authenticated cleanup endpoint when a verified retirement record exists; there is no deleted-quiz UI or automatic orphan cleanup.
- Minimal expiry and revocation receipts remain durable. A separate account-erasure policy needs deliberate treatment of those receipts; this feature does not remove them.
- Old retained responses with no saved report remain visible as Not created. Existing quiz-response retention is unchanged.
- The management view intentionally does not display or reconstruct bearer URLs. Owners use contact response IDs to target the link, while actual link possession remains with the respondent.
