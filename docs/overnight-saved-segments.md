# Saved contact filters — service and API

**Final batch14 status:** independent compiled HTTP and the final three-engine editor suite subsequently passed. See [combined acceptance](overnight-batch14-quality.md). Source-only checkpoint wording below describes this lane’s earlier freeze. No deployment or cloud verification occurred.

Batch 14, 12 October 2026. This document records the schema, persistence, and API lane. UI and compiled end-to-end acceptance are coordinated separately by the root task and UI lane. No deployment, real contacts, cloud mutation, email, CRM, or billing work is claimed.

## Implemented contract

The owner can persist at most 20 named current-filter definitions for one live quiz. The aggregate is stored as `contact_segments`, keyed by SHA-256 of JSON `[ownerId, formId]`, with the record adapter's authoritative owner and revision. All changes use one expected revision against the entire set. Deleting the last definition retains the empty record and its advanced revision, preventing stale requests from recreating revision zero.

The client-safe module `lib/contact-segment-schema.ts` exports:

- `ContactSegmentFilters`, `ContactSegment`, `ContactSegmentResponse`, and create/patch/delete request types.
- `parseContactSegmentResponse`, `parseContactSegmentFilters`, and strict request parsers.
- `contactSegmentFiltersFromCurrent` to validate a current selection for saving, and `contactFiltersFromSegment` to apply it with empty transient search.
- Limits: 20 definitions, 80-character names, 16 KiB request bodies, 128 KiB sets.

A response is `{ schemaVersion: 1, revision, segments: [{ id, name, createdAt, updatedAt, filters }] }`. New IDs and timestamps are server-created. Names are trimmed before creation/rename, reject control characters, and must be unique under NFKC normalization and lowercase comparison. Stored/response names must already be trimmed; malformed persisted names are not silently normalized. Revision zero is valid only for an absent empty set.

Definitions contain only the existing filter fields. They contain no query, response IDs, contact details, raw answers, membership arrays, or counts. The current free-text contact search must be exactly empty before saving, including whitespace-only searches. At least one supported non-default criterion is required. A valid filter may match zero retained contacts.

Dates remain absolute calendar dates evaluated in the viewing device's timezone. Exact historical result/category keys remain unchanged. Source/campaign typed identities preserve literal labels named “all” and “unknown” separately from unknown/not-recorded and all-values selections. A saved question and answer must form a complete valid pair. Contradictory unscored/range settings are rejected instead of silently changing meaning. No new evaluator or segmentation-rule language was added.

## API and errors

Collection endpoint: `/api/forms/[id]/contact-segments`.

| Method | Body | Success |
| --- | --- | --- |
| GET | None, no query parameters | 200, current set/revision |
| POST | `{ revision, name, filters }` | 201, committed set |
| PATCH | `{ revision, id, operation: "rename", name }` or `{ revision, id, operation: "replace", filters }` | 200, committed set |
| DELETE | `{ revision, id }` | 200, committed set |

Each method requires an authenticated owner and a live owned quiz. Supplied origins use the existing actual-Host origin guard plus a request-URL protocol check. Next may normalize the internal URL hostname, so it is not used to reject an otherwise matching Host/Origin pair. Forwarded-host headers never authorize an origin. Malformed origins are denied safely. There is no change to global authentication behavior. Query parameters are rejected.

Mutations require JSON and stream the request into a bounded 16 KiB buffer; actual byte count is enforced even without or despite an understated Content-Length. Oversized streams are canceled. Invalid UTF-8 and malformed JSON receive safe errors. The same byte budget also applies to direct service inputs after serialization. Stored set and response byte budgets are both checked before commit.

All success and error responses use `Cache-Control: private, no-store`. Statuses are 400 for malformed definitions/JSON/content type/query; 401 unauthenticated; 403 rejected origin; 404 missing/foreign quiz or unknown target; 409 stale revision, quota, or duplicate name; 410 a retired quiz ID; 413 oversized raw request; and 503 storage/lifecycle corruption or an unconfirmed unchanged write failure. Error messages do not echo submitted definitions or underlying storage diagnostics.

## Concurrency and failure behavior

One aggregate CAS protects both membership and the 20-definition quota. A create at revision 19 cannot silently overwrite another create at revision 19. Rename/update/delete act on a pinned ID and revision. There is no server-side automatic write retry.

The cloud adapter can surface a competing first INSERT as an untyped error, and a write can commit before a transport failure. On such an error, the service rechecks current eligibility and rereads the exact aggregate once. If its revision changed, the request returns 409 and requires an explicit list reload. Otherwise it returns 503. It never reissues the write or infers success from matching names. This also keeps a failed-after-commit retry from duplicating a definition.

Record wrappers are checked for exact kind/ID/owner, positive safe-integer version, and validated payload. Corrupt or unreadable records are never treated as an absent empty set. There is no whole-object cache. List requests read the one aggregate rather than scanning all owners' records. Service retries are bounded to the single reconciliation read; existing adapter locking and transport behavior are unchanged.

## Quiz retirement

The accepted bounded design permanently excludes IDs with a durable owner-bound quiz retirement receipt. Newly created quizzes use new IDs and are unaffected. A manually recreated identical ID cannot regain saved-filter access, even when repeated deletion shares the same timestamp.

The service strictly validates the established `result_report_revocations` wrapper and its sole `retiredAt` field; any valid receipt, including timestamp zero, denies access. A malformed receipt fails closed with 503. It does not use the permissive report helper's missing/invalid-to-zero fallback. The retirement, report, form storage, and deletion implementations were not modified.

Live ownership and retirement are checked before operations and after returning or committing an aggregate. A deletion racing an in-flight write may leave a bounded definition record in storage, but the durable receipt prevents that row being exposed or changed later. This is not a cross-record transaction and cannot recall a response already returned before deletion. Supporting reused IDs in the future requires a server-owned immutable form generation, not mutable creation dates or timestamp comparisons.

## Source files

- `lib/contact-segment-schema.ts`: strict client-safe schema and conversion helpers.
- `lib/contact-segments.ts`: owner/quiz aggregate persistence, lifecycle checks, optimistic revisions, and bounded reconciliation.
- `app/api/forms/[id]/contact-segments/route.ts`: request/auth/origin/body handling.
- `tests/contact-segments.cjs`: offline schema/service/API rehearsal.

The existing record adapter, form storage, contact evaluator, contacts API, schema, scoring, tracking, player, and authentication files remain unchanged by this lane. The Supabase skill was read because the existing adapter can use Supabase; no SQL, adapter, migration, or provider behavior was changed. The root task separately verified current official Supabase guidance. The installed Next.js route-handler guidance and repository instructions were read before implementation.

## Verification and limits

`node tests/contact-segments.cjs` passed 13 groups. Tests use a newly created temporary directory, real local adapter CAS/atomic writes, synthetic form/retirement records, mocked authentication, actual route functions, and a fail-fast outbound request guard. The directory is removed in `finally`; no original records or environment files are read. The test confirms zero outbound requests.

Coverage includes all supported filter fields and exact evaluator membership, the inclusive DST date boundary, literal attribution sentinel labels, null/zero/missing distinctions, strict payloads and client dependency separation, CRUD and retained empty revisions, simultaneous quota fills and target edits, duplicate normalized names, byte budgets, corrupt JSON/wrappers/payloads, malformed retirement receipts, repeated same-millisecond delete/recreate, before/after-commit deletion races, ownership isolation, first-insert and post-commit fault reconciliation, bounded reads/no write retries, and streamed body/origin/query/auth/error-cache boundaries, including legitimate internal-host normalization and understated Content-Length with multibyte UTF-8. The route tests mock authentication; they are not a claim of live cloud authentication or database verification.

Evidence: `compiled-verification-batch-14/saved-segments-service/first.log`, `final.log`, and final accepted `final-host-normalization.log`, plus `lint-final.log` and `typecheck-final.log`. All 13 final service/API groups, scoped ESLint, and full `tsc --noEmit` passed. The final run includes the independent-review origin normalization correction and regression. Application/service source is frozen for the root-owned combined build; compiled acceptance remains pending. Root owns independent compiled HTTP tests and the UI lane owns browser interactions. Those are not represented as passed by this service-only checkpoint.

This feature stores definitions rather than frozen audiences. It does not improve the existing full retained-contact read, add backend contact pagination, send emails, sync CRM audiences, or schedule updates. Free-text search remains transient. Historical answer availability still follows the existing contact API's explicit error behavior. No deployment has occurred in this lane.
