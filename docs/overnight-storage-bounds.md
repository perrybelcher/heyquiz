# Shared local record-read budget

Batch10, 12 October 2026. Local adapter improvement with disposable synthetic fixtures only. No cloud/provider requests, production writes, credentials, dependency changes or server/build changes by this lane.

## Change

`readRecord` now runs its local file read and JSON parse under a shared FIFO budget of **32**. The state lives at a versioned symbol on `globalThis`, so separately loaded modules/route bundles in the same Node realm reuse live permits. Module reload does not reset active reads. No record, authorization or path cache was added.

The pathname is captured before waiting, so a queued call retains the runtime data directory selected when it was invoked. A permit is released exactly once in `finally`, after the actual operation settles; an external caller abandoning its wait does not release a still-running read. The oldest waiter reserves each released slot synchronously, preventing new callers from bypassing the queue.

The existing 32 workers per `listRecords` invocation remain. They continue to preserve enumeration order, filter owners, tolerate concurrent missing files and drain before rejecting read/corruption failures. Keeping these workers avoids enqueueing every file in a large listing. Direct reads, contact-history joins and write/remove precondition reads now share the same budget.

Only the local `readRecord` operation acquires a permit. Wrapping outer listings/writes would cause nested acquisition and potential deadlock, so those flows are unchanged. Cloud reads return before the local helper; cloud pagination, headers and request behavior remain unchanged. File locks, optimistic conflicts, atomic temp-file/fsync/rename, removal ownership checks, generic errors and public function signatures are preserved.

## Files

- New `lib/local-record-reads.ts`.
- Narrow import/local read wrapper in `lib/records.ts`.
- New `tests/local-record-read-budget.cjs` and `tests/local-record-read-load.cjs`.
- New `tests/compiled-local-read-budget.cjs`, plus an external test-only counter preload in the batch10 evidence directory (never included in application configuration).
- Stronger three-listing shared-bound assertion in existing `tests/records-recovery.cjs`.

Repository AGENTS and installed Next runtime, package-bundling and Turbopack guidance were read before implementation. No schema, cloud branch, application route or UI edits.

## Deterministic verification

`tests/local-record-read-budget.cjs`: **8 scenarios passed**:

1. Full saturation and single-slot release prove FIFO admission; a newly queued caller cannot jump ahead of waiting operations.
2. Fresh helper/adapter module instances and cache deletion while reads remain active share the live same-realm budget.
3. A caller's external `Promise.race` abandonment retains the permit; synchronous/async failures release it; a fresh 32-operation batch recovers.
4. Three listings, 80 direct reads and the real contact directory's eight-worker history/answer join run together with at most 32 active record reads and exact returned totals.
5. Queued pathname capture preserves the original data directory while later calls use the changed directory.
6. ENOENT, corrupt JSON and injected file-read failures drain, leave no leaked permits and do not prevent an independent scan or later retry from succeeding.
7. A write that holds its existing per-record lock while its precondition read waits does not deadlock after reads are released. Two expected-version writers still yield exactly one success; lock cleanup, owner mismatch and removal protection hold.
8. Mocked cloud record/keyset reads complete while all local permits are held, preserving URLs, owner parameters and headers. No real network is available in the test.

Relevant regressions passed after the adapter change: `records-recovery` (1,200 real temporary records), mocked `cloud-pagination` (1,205 rows), `report-management`, `result-reports`, `contact-answer-cohort` (12), `contact-answer-api` (6), `contact-context-api` (5) and `analytics` (30). Scoped ESLint and `tsc --noEmit --incremental false` also passed.

Logs are under `../pippi-overnight-2026-10-12/compiled-verification-batch-10/storage/`, with one log named for each suite.

## Compiled candidate verification

The parent built a separate release candidate and started its compiled server on port 3164 with isolated local data. `tests/compiled-local-read-budget.cjs` ran from that candidate against the real API routes. It created 250 disposable retained sessions, 200 owned and 50 foreign-owned, then sent **23 simultaneous workload requests in eight groups**, plus one preceding local authentication request: two analytics, two contacts, two saved-report-link pages, twelve direct form reads, and five foreign-owner/anonymous denial checks. It used **zero public starts** and removed its own fixtures afterward.

All exact assertions passed: 200 owned starts/completions/leads/result views/offer clicks, 100 source-cohort starts/leads, the exact 200 contact IDs and 100 historical-answer membership IDs, complete five-event retained histories, correct campaign/source labels, two nonoverlapping 25-row report pages from 200 active reports, direct form identities, and four 404/one 401 access denials.

An external preload wrapped actual `fs.promises.readFile` calls only beneath the explicit synthetic data directory. It wrote counter-only snapshots to a separate evidence directory every 250 ms with an unreferenced timer; no paths, payloads, contact fields, cookies or error text were recorded. The observed serving process performed **3,424 reads**, reached a **peak of 32 concurrent reads**, and drained to **zero**. Two missing-record reads rejected while the API requests completed successfully. The measured workload plus final counter sampling took 513 ms. This is direct evidence across the compiled route bundles in that serving process, not proof of a shared limit across other processes, workers or serverless instances.

Evidence: `storage/compiled/compiled-results.json` and `storage/compiled-local-read-budget-final.log`. The initial sandboxed attempt was denied by localhost networking permissions before authentication or fixture creation; its log is preserved separately. The successful run used permission to connect only to the isolated candidate. The preload is `storage/local-read-probe.cjs`, configured with `HEYQUIZ_DATA_DIR` and `LOCAL_READ_PROBE_DIR`; it is test infrastructure, not production code.

The existing Playwright `browser-report-management.cjs` also passed against the candidate: owner/origin isolation, metadata privacy, exact response targeting, cancel/confirm revocation, concurrent revoke, expired-copy cleanup with responses retained, API failure/retry recovery, and 390px mobile layout. It made one synthetic public start and cleaned its fixtures. Evidence: `storage/browser-report-management.log` and desktop/mobile screenshots in `storage/report-management/`.

## Bounded mixed-load measurement

The new load harness uses a separate child process and fresh temporary fixture for each sample. Baseline mode bypasses **only the new helper inside the harness**, retaining the existing 32-worker listings; it does not edit application code. Sample order alternates baseline/new across two rounds. All fixture files are removed.

Each sample contains 1,000 sessions, 4,001 record files and 2,057,531 JSON bytes, with 25% foreign-owned records. It concurrently runs the current contact/history/answer-catalog read, the three-scan analytics read plus aggregation, saved report-link management, and 64 direct attempt reads. Every run verifies identical 750 owned contacts, 750 starts/completions, 750 retained report responses, one question version and 64 direct reads.

| Measure | Existing per-list pools | Shared local budget |
| --- | --- | --- |
| Peak active file reads, both rounds | 193 | 32 |
| Total read calls, every sample | 6,816 | 6,816 |
| Elapsed, rounds 1 / 2 | 139.0 / 139.8 ms | 151.5 / 152.3 ms |
| Sampled RSS delta, rounds 1 / 2 | 7.1 / 7.1 MiB | 5.2 / 5.5 MiB |
| Heap delta, rounds 1 / 2 | 10.6 / 10.6 MiB | 8.1 / 8.0 MiB |

Evidence: `storage/mixed-load.log` and `storage/mixed-load.json` in the batch10 verification directory. These are small local warm-cache/shared-machine observations, not production latency, memory or throughput guarantees. The measured benefit is the global active-read bound; this fixture was about 12–13 ms slower with the bound. Total I/O work was unchanged. These figures must not be compared directly with batch5's differently sized/shaped fixtures.

## Boundaries and remaining risks

The guarantee is at most 32 concurrently running **local record-file reads through this adapter within a shared Node realm**. Separate processes, worker threads, serverless instances or isolated realms have separate budgets. Directory enumeration, legacy import reads, PDF font reads and actual write handles are outside this budget; it is not a total filesystem-descriptor cap.

The wait queue is not a bounded request-admission system. Arbitrarily many callers can still accumulate waiting promises, and local listings still scan all records of a kind. This does not provide indexed owner/form queries, bounded total scan memory, server pagination, request cancellation or distributed rate control.

Queued precondition reads can increase how long a write holds its record lock under heavy contention. The current approximately two-second competing-lock retry policy is unchanged. The deterministic eventual-release scenario passed; no claim is made about arbitrary stalled disks or overloaded queues. A permanently stalled operation retains its slot because releasing it would defeat the actual-I/O bound. Priority scheduling, queue limits, lock-timeout changes and backend redesign require separate measured decisions.
