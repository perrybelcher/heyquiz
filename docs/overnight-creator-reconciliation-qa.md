# Final creator reconciliation rehearsal

12 October 2026. Test-only batch 19 scope, following `overnight-after-publication-priority.md`. The final compiled batch 18 application remained unchanged throughout this rehearsal. The final browser run and rendered PDF inspection passed; no application defect was found in these two integrated paths. `node --check tests/browser-creator-reconciliation.cjs` also passed.

## Intended chain and independent expectations

The test creates two independent quizzes through the actual UI, rather than seeding forms through the API. It uses Chrome with a 1440px creator and a separate anonymous 390px respondent context.

- Blank → guided choice question/answers → first answer marked correct → claim/save → completed owner preview → publish/readiness/Share → saved different unpublished title → anonymous public completion. Literal expected knowledge score: 100%, first answer correct, no marketing result/contact.
- Real meal-planning template selection → own title → claim/save → completed owner preview → publication/Share → saved different unpublished title → anonymous completion with all five `a0` choices and one synthetic `@example.test` contact. Literal expected marketing result from the previously independent batch 13 fixture: matched/path0, “Build a rotating menu”, null overall marketing score, no categories, and ordered sections `campaign-path0`, `campaign-reflection`, `campaign-result-faq`. Marketing opt-in stays off.

The same created quiz IDs are used throughout. The public attempt retained the older published title while the creator showed unpublished changes. Both preview and public attempt snapshots were checked against the exact saved question/marketing content and publication metadata. Each quiz reconciled exactly one counted public start/completion, 100% completion, and one retained submission. Completed previews remained excluded. Blank had zero contacts/leads; campaign had one contact/lead without marketing consent. Actual Contacts/Results UI, local APIs, retained attempts/responses, Contacts CSV and question-performance CSV agreed. No artificial tracking events were injected.

The campaign respondent creates one private result link and downloads one native PDF. It must retain the same literal result and complete ordered guidance, and omit respondent contact, bearer token, internal quiz ID and later draft wording. Actual PDF rendering is inspected after successful download.

## Isolation and ownership

Owned files only: `tests/browser-creator-reconciliation.cjs` and this document. They were initially prepared externally while batch 18 remained frozen and copied into active source only after its acceptance/archive signal. Root owns candidate staging/build/server.

Requires explicit loopback `TEST_BASE_URL`, matching `HEYQUIZ_DATA_DIR`/`EXPECTED_TEST_DATA_DIR`, cloud aliases blank and local record mode. Test-side Node fetch is disabled. All browser contexts abort non-loopback requests, AI/integration/experiment mutations and email mutations. The accepted server advertises synthetic email testing, so a private-link **status-only** read may occur automatically and is counted separately; queue/prepare/retry/send is prohibited. No real email or provider service is exercised.

Limits per run: two public starts, two preview starts, four submissions, one result-link request, one PDF. The test records fixture IDs and cleanup results, never bearer tokens or raw receipt bodies. Failure logs redact private-result URL paths. Cleanup validates owner/form linkage and removes only the two created forms and their precise synthetic descendants/retirement receipts. A cleanup failure remains a failed result with its ledger preserved. Armed response/download/popup waits attach an immediate rejection handler while retaining the original promise for strict later assertions, so an earlier locator failure cannot escape cleanup as an unhandled rejection.

## Acceptance record

Accepted evidence is in `../pippi-overnight-2026-10-12/compiled-verification-batch-19/creator-reconciliation/final-3/`, with the adjacent `final-3.log`. Its `results.json` reports three integrated assertion groups passed, no browser errors or blocked attempts, and all 15 scoped cleanup ledger entries removed. These entries include checks for absent contact-segment records; they are not a claim that 15 records were originally created.

The accepted run used two public starts, two preview starts, four submissions, one private report, one native PDF and one automatic email status read. No email queue/prepare/retry/send or provider operation occurred. The native PDF is one A4 page (20,866 bytes). The actual final PDF was rasterized as `accepted-pdf-1.png` and inspected: all result guidance and FAQ content fit cleanly, with readable text, intact section hierarchy, correct footer and no clipping or stranded headings. The mobile result, creator Share, owner Contacts and owner analytics screenshots were also inspected. Contact row/consent details below the screenshot viewport were verified by exact visible DOM and CSV/API assertions, not inferred from the screenshot.

Earlier failures are preserved, not counted as successful acceptance:

- `initial.log`: sandboxed Chrome process failed before any fixtures or starts.
- `attempt-1.log`/`attempt-1/`: the test selected nested FAQ summaries as well as the contact summary. Its cleanup also incorrectly assumed a retirement receipt included `formId`. The receipt schema was corrected; the two exact remaining synthetic receipts were validated and removed, recorded in `attempt-1/cleanup-repair.json`.
- `final.log`/`final/`: a consent assertion selected a hidden filter option. It now checks the exact visible contact-row summary.
- `final-2.log`/`final-2/`: the CSV test parser failed to strip the UTF-8 BOM from the `responseId` header. The exported CSV was correct; the parser was corrected and checked against the retained CSV before the accepted run.

All four application runs completed their real respondent journeys before these harness assertions: cumulatively eight public starts, eight preview starts, 16 submissions, four private reports/PDFs and four status-only email reads. These are repeated synthetic activity counts, not eight independent outcomes or a broad coverage score. All fixtures from all runs were cleaned; no application change or rebuild occurred between runs. Independent read-only review checked literal expectations, scoped cleanup, strict waits, exact metric selectors and the accepted token-free text evidence.

Existing batch 18 three-engine modal/focus acceptance is separate evidence; this rehearsal is intentionally one Chrome integration path per quiz. It does not prove all templates, all scoring/routing combinations, hosted auth/inbox/cloud persistence, provider delivery, actual-device accessibility or unaided human usability. CRM and Stripe remain deferred; all accounts remain free.
