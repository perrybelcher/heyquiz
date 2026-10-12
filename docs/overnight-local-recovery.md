# Offline local recovery rehearsal — batch 11

This is a synthetic integration test, not a backup product or a production recovery tool. It exercises the current local record adapter and real application readers against data created and destroyed inside one new temporary directory. No application source changed and no backup CLI, admin UI, scheduled job, cloud export, or cloud restore was added.

## Scope and isolation

`tests/local-recovery.cjs` creates its own source and restore directories. It does not accept a source or destination path, load `.env` files, inspect existing runtime data, read old backups, or inspect Git history. It clears cloud configuration in the test process, uses two fixed synthetic owners and `example.test` contacts, and generates a signing secret only in memory. Fetch and Node HTTP/HTTPS requests throw immediately if called. The successful run recorded zero outbound calls.

The fixture contains separate draft and published revisions, an active signed attempt, completed responses with contact/consent data, frozen private result copies, individual-link revocation receipts, quiz-retirement tombstones, an expiry receipt, one private uploaded file and its metadata, and a queued encrypted synthetic email request. The email worker is never invoked. No email is prepared or delivered.

The file inventory is deliberately restricted to the record kinds and payload shapes this fixture uses. For example, the email validator accepts a queued job with zero delivery attempts, and the report fixture uses ordinary quiz scores. This is not a complete migration validator for every legacy payload or every record kind.

## Validation and restore boundary

The harness constructs an in-memory versioned envelope with a complete ordered path inventory, byte lengths, SHA-256 hashes, base64 file bytes, and an HMAC proof tied to the synthetic signing key. It validates all of the following before creating a destination:

- Envelope version and exact allowed fields; bounded file count, per-file bytes, and total bytes.
- Relative allowlisted paths, duplicate paths, canonical base64, byte hashes, and the complete inventory hash.
- Record wrapper kind, ID, owner, and revision; fixture payload schemas and ID/path consistency.
- Original report expiry relationships and media metadata/owner/path/byte relationships.
- Signing-key continuity, without putting the key in the envelope.

Source traversal rejects symlinks, unexpected files, unknown directories, and unfinished writer lock directories. A second inventory/hash pass checks that the observed source stayed unchanged while copying. This check is **not** an online snapshot transaction or a substitute for stopping writers.

Restore is allowed only to a new directory inside the test sandbox. Existing destinations are never merged, deleted, or replaced. Every copied file is created exclusively, then verified against its hash. Raw records, snapshots, temporary keys, and media bytes are removed when the test exits; retained evidence contains only check names and aggregate counts. No values from failed records or tokens are logged.

## What the actual application consumers verified

| Area | Verified after restore |
| --- | --- |
| Draft and publication | The editable draft remains revision 3 with its private title; published revision 2 keeps the earlier title. Raw wrapper versions and bytes also match. |
| Active attempt | Its existing signed token still resolves the same owner, frozen published form, reached question, and original expiry. A different form ID is rejected. |
| Contacts | Actual response and CSV helpers retain contact consent and score data; a different owner receives no responses for this quiz. |
| Private results | The previously issued link keeps its frozen score and title. Individual revocation, deleted-response denial, and retired-quiz denial survive restore. Old attempt replay cannot bypass them. |
| Same-ID recreation | Recreating a deleted quiz does not revive its old private report; the retirement tombstone remains effective. |
| Expired copies | Cleanup receipts remain present; replay of the expired attempt does not create another expired report copy. |
| Uploaded file | The real private media route serves identical bytes using the existing signed capability and retains `private, no-store` and `nosniff` headers. |
| Pending email | The restored recipient box decrypts only with the original key. The job remains queued with zero attempts and no delivery artifact. A changed key also invalidates existing attempt/report capabilities. |

Rejected-snapshot cases cover changed bytes, missing files, duplicates, path traversal, an unexpected environment-file path, unsupported envelope version, unknown envelope fields, invalid record revision, mismatched media ownership, malformed question type, incomplete media, and the wrong signing key. Every validation failure is checked against both an absent destination and a sentinel existing destination; the absent destination stays absent and the sentinel directory stays byte-for-byte unchanged. Additional tests reject source/destination symlinks and unfinished writes.

## Important recovery limit: older snapshots forget later revocations

The test deliberately restores a snapshot taken **before** an individual report link was revoked. With the original signing key, that old link becomes readable again because the old snapshot contains no later revocation receipt. Returning to the snapshot containing the receipt denies the link again.

This is an expected rollback limitation, demonstrated explicitly rather than hidden by a successful roundtrip. A real recovery cannot claim to preserve later revocations or deletions unless it also retains and reconciles a separate authoritative journal of those later actions, or deliberately invalidates affected capabilities. That recovery design is not implemented here. Losing the signing/encryption key is also not a safe substitute: it makes existing tokens unusable and pending recipients undecryptable. Keys need separately protected recovery and rotation procedures.

For a future operational recovery procedure, writers and workers must be stopped; the full record-and-media inventory and compatible application version must be validated; restoration must target a new directory; revocations/deletions after the snapshot must be reconciled; and access, retention, pending-job handling, and consumer behavior must be checked before any traffic or worker resumes. This rehearsal performs no real cutover and proves neither cloud recovery nor delivery-provider idempotency after a rollback.

## Reproduce and evidence

From the application directory:

```sh
ARTIFACT_DIR=/absolute/path/to/sanitized-evidence node tests/local-recovery.cjs
./node_modules/.bin/eslint tests/local-recovery.cjs
```

`ARTIFACT_DIR` controls sanitized evidence only, not the source or destination data directories.

Final active-source run on 2026-10-12: **25 groups passed**, restoring **26 files** (25 record files and one uploaded file), with **zero outbound calls**. The syntax check and scoped ESLint both passed. No production build or shared server restart was performed by this lane.

Evidence is in `../pippi-overnight-2026-10-12/compiled-verification-batch-11/recovery/`:

- `local-recovery-final.log` — final 25-group pass.
- `results.json` — aggregate counts and named checks; no raw records or tokens.
- `local-recovery-first.log` — preserved first failure: the fixture tried to recreate a deleted quiz using its stale revision 1. Correcting the fixture to create with revision 0 resolved it; application behavior was correct.
- `local-recovery-second.log` — initial full pass, before tightening the secret/recipient assertions to inspect decoded record bytes rather than only the base64 envelope.

Installed Next.js environment-variable and testing guidance was consulted. The harness intentionally uses direct Node imports without the Next environment loader so local `.env` values are not loaded.

## Batch 12 extension

The same25-group/26-file rehearsal now includes a configured result-email copy. Its pending job’s optional `copyBox` remains encrypted through the raw-byte roundtrip, decrypts to the expected original published title/copy only under the owner/job/copy:v1 purpose and original key, and rejects recipient-purpose or changed-key decryption. Source and candidate runs passed with zero outbound calls. This adds assertions to existing groups, not new unique recovery groups or a production backup feature.
