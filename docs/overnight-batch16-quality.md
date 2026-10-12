# Batch 16: manual synthetic journey cases

12 October 2026. Final local synthetic acceptance passed in Chrome, Firefox and WebKit. No production deployment, cloud writes, real emails, provider authorization, credentials or spending. CRM and Stripe remain deferred.

## Delivered scope

Journey testing gains an optional manual composer for specific synthetic numbers and short answers alongside supported choice inputs. Creators review the observed result, exact score, visible path, category coverage and ordered sections before saving an expectation. This is a regression baseline, not independent proof that an answer or recommendation is correct.

One browser-local library holds up to 25 cases. Typed cases preserve exact number strings and use a strict version-2 format; legacy version-1 cases remain readable with their original narrower expectations. Append, import and promotion validate both maps and the entire retained library. Explicit removal alone can preserve unrelated readable legacy properties. Every touched write checks the current raw library; this is not a cross-tab transaction, and an already-open older application can still overwrite it.

Exports contain the exact synthetic typed values. Review shows them as inert text, acknowledgement is tied to the displayed library/file, and changed storage requires a fresh review. Contact, password, upload and challenge inputs are unsupported. No respondent records or network calls are created by the composer.

## Evidence

- Model/codec: 12 new groups. Independent QA: 19 groups and 63 literal evaluator comparisons, including repeated helper/rerun assertions rather than 63 distinct journeys.
- Existing source regressions: 12 transfer groups, 13 expanded-case checks, journey evaluator checks and 25 general checks passed in the candidate.
- Real local respondent API: before/after observations match exactly, with 13 successful submissions and five rejected invalid attempts per build. This verifies the unchanged respondent scoring/routing boundary, independently of the new helper.
- Initial full lint had no errors and one new unused-type warning; removing that import restored the prior 75-warning baseline. Combined build and TypeScript checks passed.
- Existing transfer, expanded expectations and 16 dialog-focus browser checks passed after the first corrections. Final manual tests passed Chrome, Firefox and WebKit with 18 scoped accessibility scans at 320/390/1440px, zero violations, zero page errors and zero API mutations/public starts/external requests. Review-heading and both action positions were measured; selected narrow/mobile/desktop views were inspected. The old transfer suite adds three separate clean scoped scans.

Evidence lives in `outputs/pippi-overnight-2026-10-12/compiled-verification-batch-16`. The final status, frozen runtime manifests, allowlisted source archive and staged-tree hashes identify the exact accepted build. Tests from earlier builds are kept distinct. Final server: port3164/session68704, build-batch-16-final.log and server-batch-16-final.log. Respondent API checks used initial16; legacy browser regressions used accepted16; only the child composer trusted-interaction focus changed before final16. All three final manual suites used final16.

## Findings repaired during review

1. Zod record parsing could silently drop a reserved own key. A bounded raw-key check now runs before strict parsing; independent tests cover input, local storage, import and current-library boundaries.
2. Typed export acknowledgement could apply to an unseen replacement library. It now binds to the exact displayed raw bytes and import-file baseline.
3. Strict append validation unnecessarily prevented explicit cleanup of a readable legacy case. Removal preserves its neighbours and unrelated envelope properties.
4. A combined focus effect overrode the intended destination on cancelling/saving a review. Opening the composer and opening a review now have separate effects.
5. New storage handling replaced the existing friendly quota-error message. The preservation message is restored without hiding explicit stale-library/schema errors.
6. WebKit pointer activation left focus on the dialog after save. The final correction recognizes a trusted save action while retaining the guard against stealing focus from a newer control. Programmatic saves keep the existing outside-input focus.

The initial fixture parse failure occurred before any API request. Initial Chrome focus, legacy quota-message and WebKit focus failures are retained. Diagnostic runs that bypassed known assertions are explicitly excluded from acceptance evidence. A diagnostic WebKit run also surfaced a same-origin background RSC cancellation as an access-control page error. The auxiliary storage-only page was isolated to robots.txt; final suites retained strict page-error assertions and passed without filtering. Final Chrome/WebKit still record ordinary cancelled/aborted local prefetches during navigation as request metadata; this does not establish universal navigation reliability.

## Limits

No exhaustive numeric/text domain coverage, automatic correctness oracle, score ranges, account-synced case library or publication gate. Wording, URLs, styling, delivery, timers and real devices require separate checks. Actual hosted account/inbox behavior, cloud ownership/rollback, repository-history privacy and unaided human usability remain open release gates. Real result-email transport remains unavailable.
