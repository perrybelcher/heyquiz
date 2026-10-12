# Native PDF deployment packaging

Prepared 12 October 2026. `tests/result-pdf-packaging.cjs` exercises the actual compiled PDF route from a fresh directory containing only its Next.js NFT dependencies and route entry. It does not start a server, rebuild, call the live app or contact a provider.

## Isolation and method

The test reads `.next/server/app/api/result/[token]/pdf/route.js.nft.json` according to the installed Next output-file-tracing guide. Every dependency is copied with its project-relative path, plus the route entry itself. Paths and symlink targets must stay inside the project; additional trace roots require explicit review. The copied tree contains no untraced project source or wholesale `node_modules` directory.

Each child process has a clean environment, blank `NODE_PATH`/`NODE_OPTIONS`, an isolated home, fresh synthetic signing secret and temporary local records. Cloud environment variables are absent. Module resolution is blocked outside the copied tree. File reads outside it are blocked, and fetch/HTTP/HTTPS/socket/DNS entry points are trapped. No original checkout fonts, private Next fonts or machine-installed font fallback is available.

The route's exported `routeModule.userland.GET` is inspected and invoked directly, with a real signed synthetic result-view capability and retained form/submission/report records. No application function is mocked. The test avoids constructing private framework request stores because this handler does not need them. This verifies the compiled user handler and its dependencies; it is not a replacement for the separately tested browser/HTTP server path.

Two independent child processes check:

- All three report layouts return actual PDF bytes, expected MIME, attachment filename, length and private/no-store headers.
- Invalid capability, mismatched record ownership and response deletion return private 404 responses.
- Unsupported Arabic text returns the browser-print fallback (422).
- A missing regular font returns a useful private 503 response. Restoring the font permits a successful retry in the same process, confirming a failed asset load does not poison its cache.
- No outbound requests or external file reads occur. All loaded modules stay in the copied tree. No token, form ID or submission ID is embedded as literal PDF metadata/bytes in this synthetic fixture.

The test logs only case names/statuses, byte counts and timings. It does not log access tokens, signing secrets, report bodies or PDF bytes. Temporary trees/records are removed in `finally`.

## Font and inventory gate

The test requires traced provenance plus the reviewed `NotoSans-v2.015` regular/bold files and `OFL.txt`. It verifies byte counts and SHA-256 against provenance and the independently pinned hashes in the test. The OFL text must contain the license/version and copyright notice. No upstream font download is performed during verification.

Unexpected `data`, `docs`, `tests`, `coverage`, `.heyquiz-data` or environment files in the trace fail the strict gate. A deliberate `ALLOW_INCOMPLETE_TRACE=1` permits a prototype run while explicitly returning `releaseGatePassed: false`; it never labels that package release-ready. The default run has no such allowance.

## Prototype result

The initial compiled spike passed all **nine runtime cases** from its copied tree: three successful layouts, invalid capability, foreign owner, unsupported language, deleted response, missing font and restored-font retry. Network attempts and external file reads were **zero**.

Its NFT listed **135 files**; with the route entry, the copied files totaled **4,441,868 bytes**. Synthetic PDFs measured 24,843 bytes (stacked), 25,910 bytes (score overview) and 25,390 bytes (action plan). These are local fixture measurements, not a deployed cold-start or platform-limit claim.

The prototype correctly failed the release inventory gate: it omitted `OFL.txt` and unnecessarily traced `data/forms.json`, `data/submissions.json` and `docs/qa-2026-10-09/initial-results.json`. Root changed the tracing configuration to include all app-owned PDF font assets and exclude data/docs. The final strict result below confirms that correction.

Prototype evidence: `../pippi-overnight-2026-10-12/compiled-verification-batch-6/packaging-prototype/packaging-results.json`.

## Final compiled result

The strict test passed against the final 12 October build with **no prototype allowance and no inventory gaps**. All nine actual compiled-route cases passed again; regular/bold font hashes, OFL license hash and provenance checks passed. All 102 loaded runtime modules resolved inside the copied tree. Network attempts and external file reads were zero in both child processes.

The final NFT lists **134 files**, or **135 including the route entry**, totaling **4,393,115 uncompressed bytes**. It includes both fonts, provenance, README and OFL, and excludes the prototype's data/docs records. Resulting synthetic PDFs measured 24,840 bytes (stacked), 25,910 bytes (overview) and 25,526 bytes (action plan). First-handler generation was 70 ms; subsequent layouts were 50 and 45 ms on this local Node v22.14.0 run. The normal process's final RSS snapshot was 159,121,408 bytes, with 137,674,752 bytes for the missing-font/retry process. These snapshots are not measured peak memory, concurrent load or hosted cold-start guarantees.

Final evidence: `../pippi-overnight-2026-10-12/compiled-verification-batch-6/packaging-final.log` and `packaging-final/packaging-results.json` (full relative-path/SHA-256 inventory and case summaries). This completes the narrow compiled packaging gate; deployment and the other feature acceptance gates remain separate.

## Repeat against a new build

```sh
ARTIFACT_DIR=../pippi-overnight-2026-10-12/compiled-verification-batch-6/packaging-final node tests/result-pdf-packaging.cjs
```

A successful strict run checks current compiled files, not a saved earlier trace. Rebuilds and deployment remain the root task's responsibility. This test does not establish full accessibility, PDF text extraction, pagination fidelity, peak concurrent memory, real hosting configuration or production rollout readiness; those have separate verification lanes.
