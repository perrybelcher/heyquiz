# Session and save reliability

This change preserves quiz schemas, scoring, branching, publication snapshots and respondent behavior. It adds renewable creator sessions, typed API failures, and account-bound draft recovery. Implementation and local acceptance do not establish deployment or live-provider readiness.

## Creator behavior

- Foreground creator use renews sign-in for a rolling 30 days. Hidden pages and periodic background timers do not extend that window.
- An expired access token is refreshed on the server. A temporary account-service outage is retryable and does not claim that the user signed out.
- When fresh sign-in is necessary, the editor pauses mutations and presents sign-in over the current draft. The same account resumes draft saving automatically. A different account cannot receive the pending draft.
- Recovery never resumes publishing, deletion, result emails or integration delivery automatically.
- The save label distinguishes account-confirmed saves, persistent device copies, tab-only copies and unconfirmed storage. A failed browser write never produces a persistent-backup claim.
- One unambiguous device draft with the original account and unchanged base revision restores automatically. Changed server revisions or differing device copies require review.
- Closing a tab does not depend on a last-second network save. Clearing browser data, storage rejection and device failure remain recovery limits.
- Explicit logout attempts pending saves across responsive tabs. If edits remain, the user can retry, cancel or sign out while retaining the device copy. Sleeping tabs cannot be forced to execute; their existing copies are never deleted by logout.

## Session implementation and compatibility

`account_sessions` is an internal kind in the existing generic records table. No database migration is required. A random 256-bit `hq_session` cookie is HttpOnly, Secure on hosted accounts, host-only and SameSite=Lax. The record identifier is a SHA-256 hash of that handle. Access/refresh credentials are encrypted with AES-256-GCM, bound to owner and record, using a purpose-specific HKDF key from `SESSION_SECRET`.

Keep `SESSION_SECRET` stable across deployment and rollback. Changing it also changes draft account identifiers and makes old encrypted session credentials unreadable. Privileged records credentials remain server-only. Vercel session creation requires durable cloud storage.

Refresh uses an optimistic-lock claim with a 60-second lease. Provider calls have a 15-second deadline; contending requests wait at most two seconds and then return retryable 503. Rotated credentials are persisted before claim release. A durable logout tombstone takes precedence over concurrent refresh. Unknown provider errors retain the record for recovery; definitive invalid/revoked credentials require sign-in.

`POST /api/auth/session` returns only `{state, accountKey, expiresAt}` on success. Its account key is an opaque draft-binding identifier, never an authentication credential. It returns 401 for required sign-in and 503 for temporary unavailability, with private/no-store responses. Rolling cookie writes occur only in route handlers; server component reads can refresh durable credentials without setting cookies.

Existing `hq_access` sessions continue until expiry. Because their refresh token was never retained, they require one fresh sign-in to obtain a renewable session. Password-reset grants remain separate from workspace sessions. Rolling back to the previous release can require sign-in again; versioned recovery data should be retained.

## Draft storage and error handling

Versioned recovery envelopes bind the account, quiz, editor instance, base revision and snapshot. Session and persistent storage writes are checked independently. Legacy copies are retained until ownership is verified and the corresponding snapshot is safely handled. Unapplied result-email/report-design buffers retain their distinct Apply/Discard semantics and are also account scoped.

Account save receipts must match the quiz, revision and normalized snapshot. A lost response is read back before replay. A guest creation can be retried with the same ID only after an authoritative absence check and without a prior success acknowledgment. Revision conflicts never silently upgrade a write over another version.

Transient saves use bounded retries at 2, 5 and 15 seconds, respect Retry-After, and stop timed work when hidden/offline. Validation remains 400/422, invalid sessions 401, ownership/origin errors 403/404, conflicts 409, temporary outages 503 and unexpected faults 500. Server failures return sanitized messages and privacy-minimal support references.

## Verification

Run `npm run test:reliability`, the existing account/regression/core suites, lint, TypeScript and a production build. `npm run test:browser-reliability` requires explicit loopback `TEST_BASE_URL`, isolated `HEYQUIZ_DATA_DIR` and temporary `ARTIFACT_DIR`. `npm run test:hosted-session-reliability` starts a loopback fake Supabase and compiled application with synthetic credentials and blocks external provider traffic.

Never perform fault injection on the existing Vercel Preview environment: the inspected configuration connects Preview and Production to the same Supabase resource. Use filesystem fixtures with every cloud-key alias disabled, or the isolated fake-provider harness. Browser artifacts and synthetic records stay outside the repository.

## Local acceptance result — 26 October 2026

- `npm run test:reliability`: passed typed save-error classification (27), session lifecycle (17), recovery envelopes/status (11), autosave transitions (5), panel recovery (4), and client coordination checks.
- Existing account-auth checks (20), guest recovery, and protected login-return checks passed.
- Compiled filesystem/browser acceptance: 13 journeys passed, including closed/reopened drafts, hidden retries, lost acknowledgments, wrong accounts, blocked persistent storage with modal export, unfinished numeric input, logout retry/cancel/retain, fully expired reload return and guest device-only recovery.
- Compiled hosted-style acceptance: five journeys passed against loopback fake Supabase. Two independent app instances shared the same session and performed exactly one concurrent provider rotation. The harness observed zero external, unexpected or consequential requests.
- Existing regression checks (25), extended scoring/analytics (7), publication receipts (5), publication pause (9), owner isolation (12), submission security (13), report/PDF-model checks, saved contacts, integration and result-email mock suites passed.
- Global ESLint completed without errors (existing warnings remain), TypeScript passed, and the production build completed. The independent reviewer reported no remaining blocking findings in this change.

Evidence is temporary local QA output, including `/private/tmp/pippi-reliability-efGWK0/artifacts` and `/private/tmp/pippi-hosted-sessions-f9jeto`. Tests used synthetic records/credentials; no live provider activation, real mail, CRM delivery, push or deployment occurred.

### Dependency security patch

The initial validation identified npm advisories for Next.js 16.4.0 (critical) and Zod 4.6.5 (high). The follow-up security patch upgraded **Next.js and eslint-config-next to 16.4.3**, and **Zod to 4.6.6**, with exact versions in the manifest and updated lockfile. Other direct dependency versions and application behavior were preserved.

The full npm audit, including production and development dependencies, now reports **zero vulnerabilities**. The patched production build passes without the former advisory. Regression, reliability, account-auth, scoring/analytics, publication-receipt, PDF-model, lint and TypeScript checks pass. All 13 compiled browser recovery journeys and five hosted-style journeys were rerun successfully, including concurrent renewal across two independent app instances.

Patch verification artifacts: `/private/tmp/pippi-dependency-qa-X348lw/artifacts` and `/private/tmp/pippi-hosted-sessions-PoxOKY`. No push, deployment, live configuration change, or real-provider test occurred. A clean audit is a dependency-advisory result, not a claim of exhaustive application security certification.
