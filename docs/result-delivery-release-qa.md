# Independent result delivery and report customization QA

Independent local acceptance passed on 12 October 2026: **19 result-delivery groups**, **10 report model/snapshot groups**, and **4 actual native PDF combinations**. All **10 generated PDF pages** were rendered and visually inspected. The first service/rendering pass found no blocker. A later independent UI review found and prompted the transient-status fix documented below; its compiled regression passes. This is mocked-provider and local rendering evidence; it does not establish inbox delivery, production configuration, scheduler execution or hosted browser acceptance.

This lane owns `tests/result-delivery-independent.cjs`, `tests/report-customization-independent.cjs`, the later-authorized `tests/browser-result-delivery-ui.cjs` and this note. Root owns builds, hosted/account/provider acceptance and release operations. Email and report implementation owners remain separate.

## Real result-email checks

The service tests use real authorization, signing, encryption, report issuance and delivery helpers with an in-memory record adapter. Every `fetch` is intercepted and restricted to the fixed mocked Resend origin. Test-only configuration values are generated in the script; no real credentials are read and no provider call or email is made.

The 19 passing groups cover:

1. Explicit request and one unambiguous mailbox, rejecting delimiter/header/control injection before queueing.
2. Completed published-attempt authorization; preview, incomplete, wrong-quiz and invalid tokens rejected.
3. Concurrent same-recipient queueing, immutable recipient conflict, encrypted content and unchanged marketing consent.
4. Concurrent claims; exact frozen recipient, copy, sender and canonical origin despite later draft/config edits; escaped HTML and truthful accepted status.
5. Owner/job/purpose-bound encryption and prevention of retry through a changed provider account key.
6. Transient retry delay with identical provider payload and idempotency key.
7. Durable receipt recovery after job acknowledgement failure, including exhausted attempts and elapsed retry window without another send.
8. Missing-ID/non-JSON/oversized success responses, permanent provider rejection and conflicting idempotency keys.
9. Three-attempt and 23-hour retry ceilings; uncertain outcomes cannot be resent with a fresh key.
10. Revocation before dispatch cancels; revocation during provider acceptance leaves truthful accepted status while invalidating the private link.
11. Existing synthetic jobs cannot be converted into real sends by switching mode.
12. Monotone receipt state and exact owner/provider identity; delivered means mail-server acceptance, not a read receipt.
13. One throttled status GET under concurrency; exact message/recipient checks and unknown-event rejection.
14. Raw-body HMAC integrity, timestamp tolerance, signature version/wrong-secret rejection, duplicate/stale callbacks and minimal receipt retention.
15. Exact callback job/provider/recipient identity, unsent and unknown jobs, and inability to restore a revoked report.
16. Byte-bounded streaming webhook input, split multibyte UTF-8, invalid UTF-8 and cancellation of oversized streams.
17. Pre-HTTP lifecycle validation, provider response stream cancellation and sanitized uncertain network errors.
18. Configuration gates for explicit mode, cloud/local/preview state, signing secret, sender and canonical HTTPS origin; private owner history.
19. Provider acceptance during receipt-store failure leaves the lease intact and recovers with the identical message/key after lease expiry.

Only the mock provider returns the same receipt for an idempotent replay. Actual provider retention, credential permissions, sender verification, webhook installation, worker scheduling, mail-server acceptance and inbox/spam placement require separate hosted evidence. The tests exercise service/helper contracts, not every HTTP route or production storage failure mode. Request-route authorization/origin checks and combined build/browser validation belong to the implementation/root suites.

## Report customization checks

Ten pure groups check literal expectations independently of the new helper outputs:

- Exact legacy graded model shape and existing action-plan order when design is omitted.
- Strict version, unknown-field, duplicate-section, character/size/control and CTA validation.
- Safe HTTP(S) links with no credentials, unsafe schemes, hidden controls, backslashes or private result capabilities.
- All 32 optional supporting-section subsets retain mandatory summary, overall null and category zero/100/null values, coverage, descriptions, bands and advice.
- Literal supporting-section order, preserved resolved-detail order and secondary links, and main-CTA-only replacement.
- Exact configured metadata, custom-title fallback and the stored 74.5% result without recomputing it as 6/8.
- Truthful unscored, missing-information and no-match narratives.
- Structured-clone design/title/brand isolation from later input mutation; `publicForm` excludes creator report settings, and report projection excludes contacts/raw answers/grading.
- Rejection of invalid stored designs, with no internal identity/private asset exposure in the model.

The optional native renderer test generated editorial and executive reports, each with and without a cover. Actual page counts were **2, 3, 2 and 3** respectively. Extracted text checks confirm exact score/null/coverage information, omitted optional groups, two intended link annotations, footer exactly once and bounded page text geometry. Rendering was guarded against `fetch`, HTTP and HTTPS network calls. All ten rasterized pages were then visually inspected: readable hierarchy and contrast, coherent page flow, no clipping or overlapping content, and intact scores, coverage notices, links and footers.

Read-only UI review found no blocker in pending design Apply/recovery, strict stale-baseline validation, inert sample links or frozen saved-report rendering. Browser interaction, mobile accessibility, hosted PDF downloads and unsupported-writing-system fallback still require the owner/root suites. The four synthetic reports do not establish every possible content length, font/script or theme combination.

## Evidence and commands

Evidence directory: `/Users/perry/Documents/Codex/2026-10-06/gr/outputs/pippi-delivery-2026-10-12/independent/`.

- `result-delivery-final.log`: 19 groups passed.
- `report-customization-final.log`: 10 pure/model/snapshot groups passed.
- `report-customization-render-initial.log`: same 10 groups plus four actual renderer groups passed.
- `scoped-eslint-final.log`: both new tests, zero errors/warnings.
- `pdf/`: four PDFs, extraction/geometry summaries and all ten numbered PNGs.
- `tested-source-sha256.json`: source/test hashes recorded with this handoff; no environment values or secret material.

Run from the app root:

```sh
node tests/result-delivery-independent.cjs
node tests/report-customization-independent.cjs
REPORT_CUSTOMIZATION_RENDER=1 REPORT_CUSTOMIZATION_ARTIFACT_DIR=/absolute/evidence/pdf node tests/report-customization-independent.cjs
npx eslint tests/result-delivery-independent.cjs tests/report-customization-independent.cjs
```

The first report test attempt had a test-only fixture omission (`mode` in a legacy form) after eight checks; it was corrected before the passing runs. Initial 3/12/18-group delivery logs remain alongside final evidence and are not counted as additional distinct coverage. No application fix resulted from the service/model test executions; the later owner-status UI finding is recorded below.

Installed Next route-handler guidance, Supabase security/ownership guidance and the PDF skill were read. The PDF artifact marker was run before generating the four files. No live customer records, provider messages, private report tokens or credentials were written to evidence. No build, server, deployment, email, provider or cloud operation was performed by this lane.

## Additional compiled delivery UI acceptance

Root subsequently authorized `tests/browser-result-delivery-ui.cjs` against the isolated compiled app at `http://127.0.0.1:3165` with `/private/tmp/pippi-delivery-local-data`. The final Chrome run passed on root’s final delivery build. Real local quiz creation, publication, one public start and completion are used; only the result-email availability/DTO endpoints are mocked. No mocked live delivery response reaches a real provider.

Independent read-only review caught one concrete application issue before this run: the owner manager hid itself on every503, including a transient storage outage after a successful listing, leaving no history/error/retry controls. Root and the email owner corrected this using an explicit `RESULT_EMAIL_UNAVAILABLE` code only for disabled-mode responses. The compiled regression now verifies that ordinary503 retains previous history and an actionable refresh, followed by successful recovery.

The final browser suite also verifies:

- Unchecked transactional consent and disabled request before consent; synchronous duplicate submissions produce only one in-flight request. A failed request retains typed email and consent for explicit retry.
- Queued/accepted/delivered wording, no extra recipient editor after acceptance, no automatic resend, at most eight automatic status reads, duplicate refresh guards, and exactly one explicit permitted retry.
- Owner refresh uses GET only; an explicit “Check pending delivery” action produces one POST under synchronous duplicate clicks. Late results for an unmounted quiz cannot replace the next quiz’s history.
- Six settled WCAG A/AA scans (respondent and owner at320/390/1440) have **zero violations and zero incomplete findings**; no horizontal overflow, page errors or external requests. Both narrow mobile screenshots were visually inspected.

Final evidence is `independent/browser-delivery-final-3.log` and `independent/browser-delivery-final-3/` (six screenshots and sanitized summary). The accepted run records one local start/completion, two request actions (one deliberately failed then explicitly retried), one explicit retry, eleven status reads (initial/manual plus bounded automatic checks), seven owner GETs and one owner POST. All delivery actions are mocked.

Two preceding logs are retained: the first sandbox launch failed before fixtures; `browser-delivery-final-2.log` passed respondent and503 checks then hit a **test-only wait bug**, clicking a disabled pending-action button before refresh finished. The test now waits for completion before asserting duplicate-click behavior. That prior actual run adds one local start/completion; cumulative actual browser work was two starts and two completions. Each run cleaned only its unique synthetic forms/responses/reports/visits and exact owner/form retirement receipt, with owner and deleted-form checks. No real customer data, email, credential or private token appears in the evidence.

The new browser test passes scoped ESLint. This adds compiled UI confidence, not hosted provider/inbox validation.
