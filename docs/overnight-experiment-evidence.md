# Reviewed experiment evidence — batch 17 service contract

12 October 2026. The model/service/API lane implements the accepted measured-step-to-test-plan bridge. This note records source and synthetic local acceptance; it does not claim deployment, live accounts, production traffic, causal attribution or conversion lift. Root owns the combined build and compiled HTTP acceptance; the UI lane owns the Results handoff and browser acceptance.

## What is implemented

An authenticated owner can explicitly request an observation for a selected quiz question and exact wording through `POST /api/forms/[id]/experiment-evidence`. The JSON request contains only `questionId`, a stable `wordingKey`, date range and the existing source/campaign/publication filters. It accepts no counts, hypothetical result, hypothesis text, response IDs or proof in JSON/query parameters. The endpoint reads the owner's retained attempts and submissions through the existing adapter, filters attempts to the canonical digest of the current published source, and calls the existing analytics summarizer at one fixed observation time.

Evidence requires at least one quiet session at that step. Quiet retains existing semantics: an unfinished instrumented quiz session whose last activity is at least 30 minutes old and whose last question is the selected step. The snapshot includes reached, instrumented (`measured`), quiet and completed session counts, so missing instrumentation remains visible as reached minus measured. Completion uses retained submissions or the existing completed flag; deleted contact/answer data is not reconstructed from cached attempt results. Preview, foreign-owner, other quiz, different exact snapshot, future-start, out-of-date-range and other-cohort attempts cannot contribute. These sessions are not unique people, confirmed abandonments, or assigned-browser experiment denominators. No landing denominator is used.

`lib/analytics.ts` now returns a separate full SHA-256 `wordingKey` for the exact `[question.type, question.title]` grouping. Existing row IDs, historical title suffixes, question CSV columns and grouping/rate behavior are unchanged. Adding a second historical wording no longer changes the handoff identity. Matching is by the selected question ID plus that wording key, not by parsing a display suffix or guessing a similarly named question. Ambiguous duplicate question IDs are rejected for evidence.

## Publication and lifecycle scope

The source is the current published Version A. If Results selected all versions, the evidence response explicitly narrows to that published version. Selecting a different or unknown publication fails with 409 and asks the creator to choose the current published cohort or remove the evidence. The returned requested cohort and effective cohort make this change reviewable. `publicationNarrowed` is exactly whether the requested publication filter was empty.

The actual safety boundary is the **full canonical published snapshot digest**, not only `publishedAt`. Exact-snapshot filtering can further narrow an explicit timestamp cohort if retained snapshots with the same timestamp have different bytes, including changed options/settings. Therefore the evidence card always represents one exact published snapshot and must not claim general equality with timestamp-only ordinary analytics. Canonical object-key ordering is ignored; array ordering and all snapshot content remain significant. Literal tests reconcile ordinary analytics where the input snapshots actually match.

The helper rechecks live draft/published ownership and the durable `result_report_revocations` receipt before issuing a proof and before/after launch. Any valid retirement receipt permanently disqualifies that owner/quiz ID from this optional feature, including a recreated quiz with copied title, snapshot bytes or timestamps. Use a new quiz ID. Malformed wrapper/version/owner/retirement data fails closed with 503. Existing signing configuration is reused; no credential, record collection, migration or cloud adapter change is added.

## Protected proof versus saved display data

`lib/experiment-evidence.ts` is client-safe and exports strict selector, evidence and response schemas, types, parsing helpers and selector-only URL helpers. The allowlisted evidence snapshot contains:

- Quiz and question identities/titles/type, stable wording key and published snapshot digest/date.
- Requested and effective date/source/campaign/publication cohorts.
- UTC observation and cutoff, the 30-minute quiet threshold and the explicit narrowing flag.
- Four bounded aggregate counts: reached, measured, quiet and completed.

No attempt IDs, answers, contacts, raw referrers, session tokens or proof are in the snapshot. Titles and labels remain bounded plain text. Oversized/incompatible stored content fails visibly rather than being truncated or silently relabeled.

The short-lived proof is transported only in the `X-Pippi-Experiment-Evidence` response/request header. It is purpose-separated (`experiment-evidence-v1`), signed with the existing session signer, valid for 15 minutes, and bound to owner, exact aggregate observation, normalized selectors, source digest and the never-retired lifecycle condition. Its maximum length is 8,192 characters. The UI keeps it only in volatile state; it must never enter a URL, page prop, localStorage, ordinary JSON DTO or log. Launch requires an existing reviewed plan and both published digests, pins this proof to Version A, and persists only `Experiment.evidence` beside the existing immutable plan. Client-supplied evidence/count fields are rejected by the unchanged strict launch body contract.

Verification never rescans later traffic to replace the reviewed counts. Explicit Refresh evidence produces a new observation and must invalidate the UI's prior launch review without overwriting plan text. A changed publication, retired source, wrong owner/purpose/digest, tampered proof or expiry fails instead of silently updating the plan. Normal legacy/basic and manually planned tests require no proof and continue to work without signing configuration for this optional path.

GET experiment DTOs expose only successfully parsed allowlisted evidence; no proof is saved or returned. Evidence endpoint success/errors and experiment responses use `Cache-Control: private, no-store`. The evidence endpoint validates JSON media, strict selectors/no query parameters, same Host and scheme Origin, UTF-8 and a streamed 4 KiB byte limit before record reads. The Host comparison retains compatibility with Next's normalized internal request URL. Missing authentication precedes record reads.

## Race and operational limits

The endpoint rechecks source/lifecycle after its owner scan before signing. Launch verifies before the record write, then verifies the same proof again after writing. If the source changes in that window, it attempts to remove only the fresh generated experiment record after checking its owner, ID, kind and initial version. A cleanup failure returns a safe visible 503 telling the owner to reload tests before retrying; there is no automatic retry or broad cleanup.

This is a **best-effort recheck and compensation**, not a transaction across records or an elimination of all races. A cleanup failure can leave a created record, and ordinary experiment availability continues to govern later quiz deletion. Existing full owner-record scans and hashing retained snapshots remain scale limits. The feature performs no per-keystroke scans, creates no variants, verifies no one-change-only diff, chooses no winner and performs no automatic stopping/promotion.

## Validation at source freeze

| Suite | Result |
| --- | --- |
| New `tests/experiment-evidence.cjs` | 12 model/service/real-route groups pass using in-memory records, real signing and no network |
| Independent `tests/experiment-evidence-independent.cjs` | Independent owner reports 17 groups pass, including literal cutoffs, same-timestamp/different-snapshot exclusion, owner/purpose/expiry and scan/write lifecycle races |
| Existing `tests/experiment-plan.cjs` | 7 checks pass |
| Existing `tests/experiment-plan-api.cjs` | 11 checks pass |
| Existing `tests/experiment-lifecycle.cjs` | 11 checks pass |
| Existing `tests/experiments.cjs` | Assigned-browser aggregation/deduplication/isolation suite passes |
| Existing `tests/analytics.cjs` | 30 checks pass |
| Existing `tests/analytics-cohorts.cjs` | 11 checks pass |
| TypeScript / scoped ESLint | Pass |

Owned logs are in `outputs/pippi-overnight-2026-10-12/compiled-verification-batch-17/evidence-service/`. `initial.log` preserves the first synthetic fixture error (missing required form mode); `final.log` records the corrected 12-group acceptance. Service-outage tests emit only the existing redacted diagnostic reference/status event, never proof or source content. The `legacy-*.log`, `typecheck.log` and `lint-final.log` files record the other checks. Compiled HTTP and UI acceptance are pending at this source freeze and must be recorded separately before claiming the whole bridge complete.

Installed Next Route Handler/client-boundary guides and the Supabase skill were read. The `.md` changelog/docs fetches returned unsupported-content-type; the official [changelog](https://supabase.com/changelog) and [API security guide](https://supabase.com/docs/guides/api/securing-your-api) HTML fallback were reviewed. No relevant adapter or database API change was needed because this lane reuses the existing private record adapter without SQL or migration changes.

## Owned files

New `lib/experiment-evidence.ts`, `lib/experiment-evidence-server.ts`, `app/api/forms/[id]/experiment-evidence/route.ts`, `tests/experiment-evidence.cjs`, and this note. Narrow updates to `lib/analytics.ts`, `lib/experiment-plan.ts`, `lib/experiments.ts`, and `app/api/experiments/route.ts`. No scoring, schema, player, assignment algorithm, email, CRM, provider, package, cloud or deployment changes.
