# Batch 14 quality checkpoint — 12 October 2026

Status: complete locally; staged without deployment. This is a local synthetic candidate, not a deployment or production-readiness claim. The root coordinates all source copies, builds and shared servers; agents own separate application files.

## Changes under acceptance

- The final seven original campaign enrichments cover candles, event format, hotel, renovation, product finder, scorecard and consultation. The preserved catalog now has 43 enriched templates. Original question identities, choices, scoring and eligibility remain unchanged. Legacy product-fit guidance is retained before the added sections.
- Saved contact filters store up to 20 named definitions per owned quiz, with one aggregate revision. They reuse existing contact matching and CSV behavior; they do not save free-text contact searches, contact records, counts or fixed membership.
- Save/apply/update/rename/delete use strict validation, owner/lifecycle checks, optimistic revisions and explicit reload after uncertain writes. Deleting the last definition retains the revision. Retired quiz IDs cannot expose a prior aggregate after recreation.
- The UI keeps unsupported historical selections explicit and blocks stale exports. Rename review is pinned to the reviewed revision; delayed responses preserve newer typed input and its focus. A compact presentation keeps Save and Manage controls behind explicit disclosures without discarding pending work.

## Verified so far

- Saved-filter schema/service/API: 13 groups with a fresh temporary directory, real local CAS writes, mocked authentication and fail-fast outbound guard. Source-level tests include quota races, corrupt storage, retirement races, bounded streamed request bodies and one-read reconciliation without write retry.
- Independent compiled HTTP: six groups through actual local authentication and HTTP routes. Anonymous/foreign owners denied on every method; origin/media/body/strict fields rejected; simultaneous creates at 19 leave exactly 20; simultaneous target edits have one winner; final deletion retains revision; malformed storage does not become an empty list; actual delete/recreate denies old definitions. Zero contacts, public starts or email jobs were created by this suite.
- Existing regressions: 25 general checks, 11 contact-filter checks, five contact-context API checks and six historical-answer API checks. The compiled 38-contact cohort regression retains exactly 30 matching CSV rows. The prior missing-result regression preserves zero-result selection, restored exact membership and loading/error/stale export guards.
- Campaign source: 64 new literal cases, 210 overlapping shared catalog representatives, previous campaign suites, 64,000 catalog scoring paths and 768 legacy product paths. These counts overlap and are not an exhaustive claim about edited templates or user interfaces.
- Seven compiled respondent journeys produced seven native PDFs on the first accepted campaign run. All 11 PDF pages and 16 UI screenshots were visually inspected; no defects were found. Final saved-filter browser acceptance passed in all three engines, as recorded below.

## Review findings

1. Next's internal URL can normalize the local hostname. Comparing the entire internal URL origin with the browser's origin falsely rejected valid requests. The route now uses the established actual Host check plus protocol equality; it does not trust forwarded-host headers.
2. A pending rename initially adopted a refreshed list revision without explicit review. It now preserves the typed name while requiring review of the latest name/revision before saving.
3. A delayed successful rename initially moved focus despite preserving newer input. Focus returns only when the submitted editor actually closes.
4. Independent focus review also corrected cancellation targeting a disabled selector and delayed saves stealing focus from another contact filter.
5. The compact compiled Chrome run reproduced native disabled-confirmation focus loss to BODY after deleting a definition; focus ownership was corrected and the unchanged strict assertion passed in all three engines.
6. Visual review measured roughly 375 pixels of always-open management above ordinary contact filters. The compact revision makes creation and management explicit disclosures.

The first saved-filter browser run failed because an exact label test included nested option text, while the actual computed combobox name was correct. The semantic role locator preserves the accessible-name requirement; the initial log/screenshot are retained. Subsequent markup separates labels from controls.

## Build boundaries and evidence

Evidence root: `outputs/pippi-overnight-2026-10-12/compiled-verification-batch-14` (outside source). The initial batch14 build accepted the six compiled HTTP groups. The next build changed only `ContactSavedFilters.tsx` to preserve focus and accepted the campaign and existing contact-browser regressions. The first compact build passed the functional Chrome cases and seven scoped scans, then failed the strict delete-focus assertion: native disabled-button focus loss reached BODY. That failure is retained. The corrected build, build-batch-14-accepted.log, passed the unchanged strict suite in Chrome, Firefox and WebKit; current server3164/session58657 uses server-batch-14-accepted.log. Only ContactSavedFilters.tsx changed between the accepted API/campaign/contact builds and this final build. Runtime SHA manifests distinguish these builds; do not describe all checks as one run.

The original repository and private recovery archives remain unchanged. Explicit source/assets/docs are copied into the isolated candidate `work/pippi-release-2026-10-12` on branch `release/pippi-2026-10-12`, with no remotes, commit, push or deployment. No credentials, runtime data, old archives or raw QA artifacts are release inputs.

## Limits

Definitions can match different retained contacts over time; they are not a frozen audience or an arbitrary segmentation rule builder. Exactly one historical answer condition is supported. Absolute saved dates use the viewing device timezone. A full retained-contact read, backend pagination, cloud indexes and production-scale behavior remain separate work. Durable retirement prevents reused quiz IDs from using saved filters; supporting reused IDs requires a server-owned immutable generation.

All tests here use synthetic local data. Live authentication/inbox receipt, cloud permissions, deployment/rollback, historical privacy review, real result-email delivery and unaided human use remain unverified. No real mail, new providers, credential changes, spending, CRM or Stripe work occurred.

## Final browser and source verification

The complete saved-filter suite passed in Chromium (Chrome channel), Firefox and WebKit. Each engine used 30 synthetic mocked contacts with real local definition APIs, 17 browser mutations and zero public starts. Each ran seven targeted accessibility scans at narrow, desktop, expanded and CSS 200% layouts; all 21 scans had zero violations and all engines had zero page errors. These are the same behavioral suite in three engines, not three different sets of features.

The suite verifies save/reload/apply/update/rename/delete, exact27-contact CSV membership and a distinct15-contact literal attribution selection, search exclusions, manual conflict reload, pinned rename/delete review, quota, failed/malformed/skipped-revision responses, newer text, delayed cross-quiz requests, unavailable historical answers, and stale/loading CSV gates. Keyboard disclosure/cancel behavior and delayed-response focus preservation are exercised. Native delete focus loss was fixed without weakening its expectation.

Final evidence: saved-segments-editor/{chromium,firefox,webkit}-final.log and matching engine-final directories with results, CSVs and screenshots. The agent inspected accepted desktop/mobile/expanded/200% views; root separately inspected compact desktop and320px images before the focus-only final correction. Long labels wrap without horizontal overflow. Chrome default saved-panel heights are210.5px desktop,295.5px at390,323.5px at320; the former desktop panel was about375px. Firefox is within1px; WebKit uses shorter native control metrics.

Full ESLint after the compact changes and test cleanup:389 files,0errors,75existing warnings. The final focus-only component correction passed scoped ESLint and TypeScript; the combined final build passed. Explicit source audit, active/candidate/index SHA checks, runtime-freeze verification and allowlisted archive readback are recorded by the final-status.json/checkpoint artifacts. Original upstream OFL line21 whitespace is preserved.

The first locator failure and genuine compact deletion-focus failure remain in their original evidence folders. Earlier passing Chrome/Firefox runs and reruns are not added to unique coverage. No source changed after the final build except documentation and tests.

Next: implement the [bounded guided checklist plan](overnight-guided-checklist-plan.md), starting with extraction-only shared readiness checks and stable field targeting under exclusive ownership. The plan is accepted for local implementation, not yet implemented or tested. Human usability and every hosted acceptance gate remain open.
