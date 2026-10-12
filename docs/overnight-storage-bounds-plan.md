# Shared local record-read budget — next bounded storage pass

Read-only proposal after batch9. No application/test edits, dataset writes, benchmarks, server requests or cloud calls were performed in this planning pass.

## Smallest useful change

Add one shared **32-permit FIFO budget around local `readRecord` file reads**, below the existing per-listing worker pools. Keep each `listRecords` scan at 32 workers so a large scan cannot enqueue every filename at once. Direct record reads and the read-before-write/remove checks then share the same budget as listings.

Do not change cloud reads, write locking, atomic rename, optimistic versions, record paths, API signatures, authorization, error wording or owner filtering. No cache, new queue rejection/deadline policy, database migration or query redesign belongs in this slice.

## Evidence from current code and batch5

- `lib/records.ts:readRecord` validates identifiers, returns through the cloud branch first, then performs one local `fs.readFile` plus JSON parse. Missing files return null; other read/parse failures return the existing generic error.
- `listRecords` currently creates `min(32, files.length)` workers **per invocation**. It preserves directory enumeration order via index slots and drains workers before rejecting corruption. Three analytics listings run concurrently in `app/api/forms/[id]/analytics/route.ts`. `lib/report-management.ts:listResultLinks` starts four listings plus a direct retirement lookup. Separate requests add more pools.
- `lib/contact-context-store.ts` now makes eight concurrent direct attempt reads after its submission scan. Those reads currently bypass the listing budget. `writeRecord` and `removeRecord` also call `readRecord` directly.
- Batch5 evidence in `docs/overnight-scale-recovery.md` showed the existing pool was valuable but not global. At 10,000 synthetic sessions, peak record reads fell to **32 for contacts, 96 for analytics and 128 for report links**. All totals stayed unchanged. Small-fixture latency increased in that run; no universal speed gain is established.
- `tests/records-recovery.cjs` currently permits up to 96 reads across three simultaneous listings. `tests/scale-reads.cjs` already instruments `fs.promises.readFile`, counts returned rows and samples time/memory. Its contacts measurement uses the older submission helper, not the newer contacts/history/answer-catalog path; label that distinction if reused.

## Implementation shape

Use a small local-only helper, preferably `lib/local-record-reads.ts`, with a single `withLocalRecordRead(operation)` entry point. Store its semaphore state on a versioned `globalThis` symbol so multiple imported/bundled copies in the **same Node runtime realm** share a budget. A plain module variable can become one budget per route bundle or reloaded module. Do not store record values, paths, owner IDs or errors in shared state.

Acquire a permit before calling `fs.readFile`, retain it until the operation actually settles, and release exactly once in `finally`, including ENOENT, corruption and unexpected failures. FIFO release must reserve the slot for the oldest waiter before waking it; a newly arriving read must not jump ahead or temporarily oversubscribe the active count. Keep JSON parsing within the short operation so synchronous parser failure exercises the same cleanup. No polling or timer is needed.

Capture the resolved local pathname before enqueueing, preserving the directory selected at invocation time if a test/runtime environment changes while a read waits. Call the helper only after the cloud branch returns; mocked cloud requests must never wait on the local budget.

Keep the 32-worker list loop and its draining behavior. Never acquire a second outer permit around an entire listing, write, or removal: each eventually calls `readRecord` and nested permits could deadlock. Actual writes/open/fsync/rename remain unchanged. In-flight failures still reject the whole listing; the helper must not convert exceptions into missing rows or successful partial results.

“Process-wide” here means a shared budget within the serving Node realm/global. Worker threads, separate processes, serverless instances and independently isolated runtime realms have separate budgets. This is not a machine-wide or distributed limit. The promise being tested is **at most 32 concurrent local record-file reads through this adapter**, not at most 32 total filesystem operations: directory enumeration, legacy import files in `lib/storage.ts`, PDF font reads, write handles and other application I/O remain outside it.

## Proposed exclusive file scope

One lane can own:

1. New `lib/local-record-reads.ts` and the narrow local `readRecord` wrapper/import in `lib/records.ts`.
2. New `tests/local-record-read-budget.cjs` for deterministic semaphore/adapter behavior; a narrow stronger global-bound assertion in `tests/records-recovery.cjs`.
3. Optional new `tests/local-record-read-load.cjs`, reusing the existing benchmark fixture pattern for mixed parallel operations. Avoid rewriting historical batch5 measurements.
4. A feature/measurement note plus raw before/after logs. Parent owns shared build and compiled verification.

Read the installed Next bundling/runtime documentation before implementation. If the helper singleton cannot be shown to survive separate route-bundle imports in the compiled app, document that measured boundary rather than claim a process-wide guarantee. No cloud implementation change is needed; preserve the existing mocked cloud-pagination regression as a compatibility guard.

## Acceptance tests

Use controlled deferred reads and disposable temporary fixtures, with network disabled except an in-memory/mock fetch compatibility test:

- **Combined budget:** three simultaneous listings plus more than 32 standalone `readRecord` calls across kinds/owners/directories never exceed 32 active local reads. They all complete with exact expected rows. Test the newer eight-read contact join alongside a scan too.
- **FIFO/no starvation:** saturate all permits, enqueue a one-record interactive read between two scan waves, then release one read at a time. Assert deterministic admission order and no newcomer bypass, without flaky wall-clock thresholds.
- **Multiple module copies:** load two fresh helper/adapter module instances in one runtime realm and hold their reads concurrently; the combined cap remains 32. Also test after deleting the module cache while work is pending: reimport must reuse live state, not reset counters. Avoid production test-only reset hooks.
- **All release paths:** ENOENT, invalid JSON, injected read rejection and synchronous operation failure leave no leaked permit. An operation that times out externally must retain its permit until its actual I/O settles; never release based only on a caller abandoning its wait. With the current no-abort adapter API, no new cancellation semantics are promised.
- **Drain and isolation:** one corrupt listing rejects only after its assigned workers/queued reads settle; another listing still succeeds. Preserve enumeration order, owner filtering, immediate fresh owner/version changes, missing-file races and absence of cached values. Once all test work settles, a fresh full-capacity batch succeeds.
- **Write compatibility:** under saturated but eventually released reads, concurrent expected-version writes still yield exactly one success; owner mismatch and removal isolation remain enforced; no lock is leaked. Verify the final file contains one complete committed record. This catches accidental nested acquisition/deadlock.
- **Cloud bypass:** saturate the local permits, invoke the cloud path using only mocked fetch, and verify it completes with the same URLs, paging/cursor, owner filters and headers as before. No real provider request. Existing `tests/cloud-pagination.cjs` stays green.
- **Compiled boundary:** parent runs a small local compiled-route smoke with simultaneous analytics/contacts/report-link reads on synthetic data. The deterministic adapter tests prove the numeric cap; compiled smoke checks bundling/runtime integration and unchanged outputs. A process-level instrumented harness may be used to measure compiled reads if it can avoid changing production code.

Run the existing record recovery, report-management, result-report and relevant contact/analytics helper tests after the adapter change. This is a shared dependency, so those regressions are warranted. A browser redesign or broad UI test rewrite is not.

## Measurement and risks

Start with a modest mixed fixture, then reuse the documented 1,000/10,000-session sizes only if needed to assess the trade-off. Compare baseline versus proposed code on the same fixture/machine; record active read peak, total reads, exact result counts, elapsed times and queue-admission/wait observations. Measure mixed concurrent requests, not only three operations performed serially. Preserve any failures and label warm-cache/shared-machine limitations. The expected improvement is bounded resource use; latency may worsen under contention.

FIFO keeps queued readers moving, but a global budget can increase latency for a write's precondition read while that write holds its per-record lock. Existing lock acquisition retries total about two seconds (`50 × 40 ms`). Test that interaction explicitly; do not quietly change lock timeouts or add priority scheduling in this pass. If real starvation/lock failures appear, report the evidence and choose a separate narrowly justified policy.

The wait queue is not a bounded request admission system. Existing scan workers limit queued work per scan, but arbitrarily many callers can still accumulate promises. This change does not cap total memory, scan size, response payloads, all file descriptors, CPU parsing cost, request count or distributed traffic. Backend indexed owner/form queries, server pagination, rate admission and retention remain separate work. The current 32 value is a conservative reuse of the verified listing limit; tuning requires measurements, not a claim that it is optimal.
