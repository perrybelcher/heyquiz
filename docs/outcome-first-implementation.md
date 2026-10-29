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

- [ ] Six optional quiz types; absent metadata preserves legacy behavior and fingerprints.
- [ ] Four outcome experiences reuse the existing editor and evaluator.
- [ ] Qualification: ordered all/any routes, stable choice IDs, numeric comparisons, missing/hidden/invalid answers cannot qualify.
- [ ] All creation paths choose type first and retain it across auth/recovery.
- [ ] Results are defined/reviewed before questions; mappings remain editable.
- [ ] Design is independent; draft changes require republishing.
- [ ] Converted copies preserve originals, review retained rules, reject stale sources and retry idempotently.
- [ ] Saved results, PDF, CSV, CRM and Meta consumers remain compatible.
- [ ] Baseline and final regression/reliability/workspace/static/build checks recorded.
- [ ] Compiled isolated browser flows and independent review completed.

No live provider calls or production deployment are part of implementation verification.

## Verification log

- Baseline `0d32975`: regression, reliability, workspace and TypeScript passed. Lint: 0 errors, 68 existing warnings. Sandboxed Turbopack build failed because its CSS worker could not bind an internal port (`Operation not permitted`); repeat the integrated build outside that restriction.
- Foundation integrated as `788dd1f`: new quiz-types tests and existing guided-editing, journey-testing, scoring-diagnostics and marketing-brief tests passed.
- Consumers integrated as `7da2589`: outcome-consumers, result-pdf-model (18 cases), result-reports, report-responses, contact-filters, integrations passed in worker checkout.
- Integration regression after foundation/editor wiring: `npm test`, reliability, workspace, integrations, analytics, tracking, providers and Meta all passed. Provider and Meta transports mocked.
- Independent review found knowledge identity was not included in marketing-only snapshots. Added a top-level optional submission `quizType` contract, with legacy absence preserved, and coordinated snapshot/export/integration consumers.
