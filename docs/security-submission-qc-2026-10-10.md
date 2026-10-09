# Security and submission QA — 2026-10-10

Added process-local request limits to submission (60/minute) and contact (30/minute) endpoints, matching the existing rate-limit mechanism used by starts, uploads and tracking.

## Validation

Production build passed, including TypeScript. Local synthetic tests against the rebuilt app passed:

- Owner isolation: nine foreign-owner route denials, including CSV exports; foreign draft preview denied; foreign quiz absent from listing; cross-origin mutation rejected.
- API regression: 12 checks covering anonymous administration, revisions, stale saves, publication snapshots, required fields, upload access, score integrity, repeat-submit idempotency and owner results.
- Submission security: 13 groups covering missing/tampered tokens, wrong-form tokens, invented answers, private downloads, cross-attempt attachment rejection, unsupported MIME, server-calculated scores, stored attempt expiry and both new rate limits. Eight concurrent identical submissions returned one response ID and produced one stored response.

## Limits of evidence

These checks ran locally with synthetic records and the local authenticated identity plus a foreign-owner fixture. They do not establish production Supabase row-level security with two real accounts. Rate limits are in memory per server process, not shared across Vercel instances; they are not distributed abuse protection. MIME rejection is not malware scanning. Production deployment status is a separate check from these local tests.

Tests: tests/owner-isolation.cjs, tests/api.mjs, tests/submission-security.cjs.
