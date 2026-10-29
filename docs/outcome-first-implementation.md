# Outcome-first implementation checklist

Starting commit: `0d329755a046514124ea271008f380102a220fc3`.

## Ownership and gates

- Lead: integration checkout, EditorStudio wiring, package scripts, global CSS, compiled browser acceptance and release evidence.
- Foundation agent: quiz-type registry, form/marketing contracts, qualification evaluation, editing references and journey diagnostics. Integrate before parallel feature work.
- AI/conversion agent: type-specific generation, converted-copy helpers and authenticated API.
- Creator agent: outcome-first entry, templates, guided/advanced result and rule editors, recovery/navigation.
- Consumer agent: result presentation, reports/PDFs, export and integration compatibility.
- Independent QA: literal expected-result fixtures and integrated browser/API acceptance.

Workers use separate worktrees. Shared contracts change only after lead review. No concurrent ownership of a file.

## Acceptance

- [x] Six optional quiz types; absent metadata preserves legacy behavior and fingerprints.
- [x] Four outcome experiences reuse the existing editor and evaluator.
- [x] Qualification: ordered all/any routes, stable choice IDs, numeric comparisons, missing/hidden/invalid answers cannot qualify.
- [x] All creation paths choose type first and retain it across auth/recovery.
- [x] Results are defined/reviewed before questions; mappings remain editable.
- [x] Design is independent; draft changes require republishing.
- [x] Converted copies preserve originals, review retained rules, reject stale sources and retry idempotently.
- [x] Saved results, PDF, CSV, CRM and Meta consumers remain compatible.
- [x] Baseline and final regression/reliability/workspace/static/build checks recorded.
- [x] Compiled Chromium/WebKit flows and independent review completed.
- [ ] Firefox acceptance: runtime cannot start in this macOS sandbox.
- [ ] Deployed creator/participant smoke checks: separate release action, not performed.

No live provider calls or production deployment are part of implementation verification.

## Verification log

- Baseline `0d32975`: regression, reliability, workspace and TypeScript passed. Lint: 0 errors, 68 existing warnings. Sandboxed Turbopack build failed because its CSS worker could not bind an internal port (`Operation not permitted`); repeat the integrated build outside that restriction.
- Foundation integrated as `788dd1f`: new quiz-types tests and existing guided-editing, journey-testing, scoring-diagnostics and marketing-brief tests passed.
- Consumers integrated as `7da2589`: outcome-consumers, result-pdf-model (18 cases), result-reports, report-responses, contact-filters, integrations passed in worker checkout.
- Integration regression after foundation/editor wiring: `npm test`, reliability, workspace, integrations, analytics, tracking, providers and Meta all passed. Provider and Meta transports mocked.
- Independent review found knowledge identity was not included in marketing-only snapshots. Added a top-level optional submission `quizType` contract, with legacy absence preserved, and coordinated snapshot/export/integration consumers.


## Final implementation and tested build

Application source build: `3e5b2bc0009cdd8961066a07fa5a5b2013ab72fc` (2026-10-29). Later handoff/test-only commits do not change this application build.

The existing form model, marketing evaluator, editor, theme controls, records store, publication snapshots, and report/integration paths now support the four outcome experiences. The shared registry also retains knowledge and scorecard types. No database migration or additional package dependency was introduced.

- Creation: six-type selection across blank/template/guided/AI, reviewed results, guest reload/authentication recovery, and type-specific AI schemas compiled into the same form model.
- Editing: outcome ordering/removal with dependent-reference cleanup, explicit all/any qualification rules with stable answer IDs, persistent Design and Change Type controls, and JSON-import protection against in-place type changes.
- Conversion: owner-protected preview/create endpoint, source revision checks, immutable request receipts in existing JSON records, idempotent retries, unpublished copies, mandatory review, and no copied integrations/experiments/provider tracking settings. Guest retries preserve the original and already-created copy.
- Results: one profile/offer/challenge/route, frozen type/content, themed result pages, native PDFs and saved reports, additive CSV and integration type/outcome/applicable-score fields. Legacy score mappings retain their prior meaning. Quiz qualification does not enable Meta tracking.
- Reliability: observed weighted ties and overlapping routes are disclosed; missing/invalid/hidden qualification evidence fails closed. Cancelled guest-claim navigation retains authentication listeners and logout draft protection.

## Validation evidence

| Check | Result |
|---|---|
| Standard regression, reliability and workspace suites | Passed; autosave has 9 focused groups including cancelled claim navigation |
| `npm run test:outcomes` and independent acceptance | Passed; 11 independent literal fixture groups, plus creator/AI/conversion/consumer/type/creation-gate tests |
| Marketing API, integrations API, owner-isolation API | Passed serially against synthetic local storage |
| Integrations, provider, Nango, analytics, tracking, Meta suites | Passed; provider transports mocked |
| Marketing brief, mocked agent generation/recovery, guided editing/checklist, journeys/diagnostics | Passed |
| Saved reports, native PDF model/access, publication receipts, experiment lifecycle/plans, guest recovery | Passed |
| Chromium compiled end-to-end | Four types: guest recovery/sign-in, editor, design, publish, mobile completion, private result, PDF, reports, conversion |
| WebKit compiled end-to-end | Same four flows, including keyboard containment and responsive layout; passed |
| Creator browser acceptance | Seven groups: all six types via blank/guided/template and mocked AI, manual mappings/rules, rename/order/deletion, guest conversion failed-write retry/reload |
| TypeScript and production build | Passed |
| ESLint | 0 errors; 66 warnings (baseline: 68 warnings) |
| Firefox | Blocked before application load: profile startup and `sandbox_extension_issue_file_to_process` / `Operation not permitted`; reproduced with both installed and clean isolated runtimes |

WebKit exposed and verified fixes for conversion keyboard focus, deterministic UTC report timestamps, and redundant session refresh during guest claim navigation. Its background Next.js RSC-prefetch fetch diagnostics during document departure are reported separately by the test; application/session exceptions still fail, and every target page must pass readiness and UI assertions.

An older publication-receipt fixture used a one-answer choice question that current publication validation rejects. Added a second labeled answer without changing any receipt assertions; all five groups pass.

Test server: compiled Next build at loopback port `3187`; data only in `/tmp/pippi-outcome-acceptance-data`. Cloud credentials were blank. AI browser controls used a nonfunctional placeholder key, with generation endpoints intercepted. Screenshots are under `/tmp/pippi-outcome-browser`; no production data, provider delivery or deployed behavior was used as evidence.

Reusable commands against an explicitly isolated compiled server:

```sh
npm run test:outcomes
TEST_BASE_URL=http://127.0.0.1:3187 BROWSER_ENGINES=chromium,webkit npm run test:browser-outcomes
TEST_BASE_URL=http://127.0.0.1:3187 npm run test:browser-outcome-creation
# Required follow-up on a host where Firefox launches:
TEST_BASE_URL=http://127.0.0.1:3187 BROWSER_ENGINES=firefox npm run test:browser-outcomes
```

## Release and rollback

Deploy all readers and writers from this implementation together. Complete Firefox acceptance and deployed creator/participant smoke checks before declaring the release fully verified. Live AI/provider delivery remains unverified; mocks are not evidence of provider authorization or real delivery.

To stop new outcome creation/conversion while retaining readers, rebuild and deploy this code with `NEXT_PUBLIC_OUTCOME_QUIZZES_ENABLED=0`. This is a build-time public environment setting; changing only a running process variable is insufficient for browser bundles. Existing typed quizzes, results and editing remain supported. Do not roll back to code that cannot parse qualification records.

Production deployment was not performed. Agent worktree cleanup was attempted; the app retained them because they are still attached to active agent tasks. Their commits are integrated in the main checkout.
