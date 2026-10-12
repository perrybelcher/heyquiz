# Local storage scale and recovery — overnight batch 5

Measured and implemented 12 October 2026. No production/cloud dataset, provider request, migration, build, deployment or server restart was used. Fixtures lived only in temporary directories and were deleted after each test.

## Finding and scoped change

The local `listRecords` branch launched one `readRecord` promise for every JSON file at once, then filtered owners after retaining all parsed records. A realistic 10,000-session fixture made the analytics read launch **27,661 simultaneous file reads** across its three parallel scans. The API returned correct numbers, but unbounded I/O created avoidable file-descriptor and memory pressure. UI pagination did not bound that work.

With parent approval, `lib/records.ts` now uses at most **32 workers per local listing**. It preserves enumeration order with indexed slots, discards other owners' parsed payloads promptly, and drains in-flight workers before returning a corruption/storage error. Missing files during a scan are still omitted; corrupt files still fail the whole listing. No partial analytics result is silently returned.

The cloud keyset branch, file layout, `turbopackIgnore` annotations, atomic writes, version conflicts, locks and public function signatures are unchanged. There is no record cache, authorization cache, stale snapshot, background job or product/API change.

## Measurement method

`tests/scale-reads.cjs` invokes the existing contact-read helper, the existing analytics read combination plus real analytics summarization, and the real result-link management listing. It checks expected counts on every sample, including historical question wording and legacy responses without linked attempts.

Each fixture includes five quizzes, 25% foreign-owner sessions, approximately 9% sessions without an attempt record, completed and incomplete sessions, optional contacts, landing visits, frozen reports, expired-report receipts and revocation receipts. Dataset sizes:

- 1,000 sessions: 3,085 records, 4.3 MiB of JSON.
- 10,000 sessions: 30,837 records, 42.6 MiB of JSON. The queried quiz has 1,286 retained responses and 858 contacts; 1,364 measured starts include 1,170 linked completions, with 116 additional legacy submissions.

Three sequential samples per operation and fixture size were taken before/after the change on the same machine using `node --expose-gc`. The instrument records outstanding `fs.readFile` calls, wall-clock time, heap delta and sampled RSS delta. Fixture generation is excluded from timing. File caches are warm, other agents share the machine, and GC/RSS deltas are noisy; these are observations, not production latency or memory guarantees.

### 10,000-session results

| Read path | Median before → after | Peak concurrent reads before → after | Median heap delta before → after |
| --- | --- | --- | --- |
| Contacts | 190.0 → 154.4 ms | 8,571 → 32 | 85.1 → 13.5 MiB |
| Analytics | 716.0 → 567.2 ms | 27,661 → 96 | 279.9 → 56.1 MiB |
| Saved report links | 288.2 → 194.5 ms | 11,742 → 128 | 71.0 → 18.9 MiB |

Every expected count and historical result remained the same. Total file reads were unchanged: 8,571 for contacts, 27,661 for analytics, and 11,744 for report links. This is controlled concurrency, not indexed query pagination.

### 1,000-session results

| Read path | Median before → after | Peak concurrent reads before → after |
| --- | --- | --- |
| Contacts | 15.0 → 25.3 ms | 857 → 32 |
| Analytics | 63.7 → 88.7 ms | 2,766 → 96 |
| Saved report links | 19.8 → 52.9 ms | 1,171 → 92 |

Small-fixture timings increased in this run. The bounded-resource behavior is the intended guarantee; no universal latency improvement is claimed.

Evidence: `../pippi-overnight-2026-10-12/scale-recovery/baseline.json` and `after.json`. The new recovery regression's expected pre-fix failure is retained in `recovery-baseline.log`.

## Recovery and isolation checks

Passed `node tests/records-recovery.cjs` against 1,200 real temporary files:

- Full record count and original enumeration order.
- Owner filtering and immediate visibility of a changed owner/version, with no object cache.
- At most 32 outstanding reads per list; three simultaneous listings remain within 96.
- A simulated 64-read file-descriptor budget, plus rejection/recovery after a stricter injected budget failure. This is fault injection, not a claim that the OS actually exhausted descriptors in the benchmark.
- A file deleted after directory enumeration is safely absent from results.
- Corrupt JSON fails closed, drains in-flight reads, and recovers after repair.
- Two concurrent writes with the same expected version produce exactly one success; the complete new record is visible afterward.
- Foreign-owner writes/removal are rejected; normal deletion and missing-directory handling remain correct.

Also passed:

- `node tests/cloud-pagination.cjs`: mocked network only; 1,205 cloud records under reduced page caps, owner filter and secret-key header behavior. No actual cloud request.
- `node tests/report-management.cjs`: complete expiry/revocation/cleanup isolation and recovery suite, now using the worker pool.
- `node tests/result-reports.cjs`: frozen allowlist/score/expiry behavior.
- Scoped ESLint for `lib/records.ts`.

The installed Next.js Turbopack guide and repository AGENTS instructions were read. The Supabase skill and pagination reference were reviewed only to preserve cloud compatibility; no Supabase feature, schema, key handling or network implementation was changed.

## Remaining limits

The worker limit is per listing, not global across the process. Many simultaneous requests can still create several pools. Direct individual reads and writes are outside the pool; changing those would need separate concurrency/fairness measurements.

Local listings still read all files of a kind before filtering. Cloud listings still walk all owner records using the existing keyset pagination. Saved-link pagination bounds the displayed result, and expired-copy cleanup bounds mutations to 25; neither is a bounded backend scan. Large multi-tenant production accounts still need indexed owner/form filters, server-side aggregate/count queries and deliberate backend pagination. This pass does not claim to solve that larger architecture task.
