# Manual journey model and codec — batch 16

12 October 2026. This note records the implemented client-side model/codec lane. It does not claim deployment, production testing, exhaustive number/text coverage, or human usability validation. The separately owned composer and compiled acceptance are recorded in their own batch-16 evidence.

## Implemented contract

`lib/manual-journey.ts` exposes `prepareManualJourneyCase(form, input, name, id, rawLibrary)` and `applyManualJourneyCase(form, input, name, currentRaw, review)`. These functions have no browser storage or network operations. Prepare evaluates one concrete synthetic path with the existing evaluator and proposes its complete expected status, result, score/null, ordered questions, category scores/null and coverage, and ordered conditional result sections. Apply rechecks the exact raw library, original supplied input and name, current draft fingerprint and proposed fixture, then reevaluates; it never accepts a caller-supplied expected result in place of evaluation. It returns cases and the serialized string for the UI to persist explicitly.

`ManualJourneyInput` keeps finite `answers` separate from `typedAnswers: Record<questionId, {type: "number" | "short_answer", value: string}>`. Both maps are validated before resolving a path, including supplied values on skipped questions. Current finite question types/options and exact typed question types must agree. Blank inputs are omitted, not converted to zero. Only answers actually used by the resolved path enter the proposed case; the review lists omitted IDs without mutating the volatile input. Optional unsupported reached fields are listed; a required reached unsupported field or challenge still prevents a valid save through the real evaluator.

Accepted numeric strings retain their original decimal/scientific lexeme, up to 64 characters and a finite numeric value. `1`, `1.0` and `01` remain distinct in exact keys/equality. Short text retains case, whitespace and Unicode up to 256 UTF-16 code units; controls, bidi-format controls, line breaks and lone surrogates are rejected. Number bounds and grading/routing semantics stay in the existing evaluator. This feature does not add step validation or direct marketing points for text/number answers.

Input errors identify a safe question ID when available and never echo an entered answer. Strict validation examines raw own property keys before Zod parsing: this prevents `__proto__` from being silently omitted by record parsing. Reserved keys, cyclic/excessively nested data, unknown fields, overlapping maps, duplicate selections and oversized combined maps fail closed. Shared types/schemas live in `lib/journey-fixture-codec.ts`, with no server modules or circular dependency on the runtime fixtures module.

## Saved format and compatibility

- Existing choice-only cases retain their original shape and version-1 envelope. A manually authored path with no retained typed answers also uses that shape.
- A typed case has `inputVersion: 2`, nonempty `typedAnswers`, finite `answers`, and complete category/section expectations. Mixed libraries and transfer files use version 2 and must include at least one typed case. Both formats share the same 25-case total.
- Version-1 local reads retain historical permissiveness for bounded metadata, unknown fields and legacy arrays. They do not normalize or rewrite data on load. The new reserved `inputVersion`/`typedAnswers` markers cannot be smuggled into version 1. Strict validation is required before append, import or promotion to a mixed library; incompatible legacy data is left untouched. An explicit UI removal can retain the original permissive version-1 serializer for remaining legacy cases; this is not automatic repair.
- Version-2 local reads and all transfer files are strict, including both answer maps. Rerunning a typed case rechecks finite and typed provenance against the current form before evaluation. Type changes, missing questions/options and invalid payloads become failed checks rather than silently reinterpreted answers.
- Legacy expectations without category or section assertions remain narrower. Import preserves literal supplied expectations, including currently failing ones; it does not reevaluate or refresh them. Existing reviewed expectation upgrades remain separate.
- The historical storage key retains its `:v1:` suffix for continuity. The envelope, not that suffix, declares the format. Removing all typed cases allows the next serialized library to use version 1 again.
- Transfer remains capped at 128 KiB of actual UTF-8 bytes, with fatal UTF-8 decoding. Local serialization remains capped at 500,000 JavaScript string characters. Compact near-limit imports are confirmed without pretty-print inflation. Neither limit permits truncation.

## Review and privacy boundaries

The returned review includes exact raw input/name/library baselines, a draft change detector, the proposed fixture and actual evaluated result. The UI must compare the latest raw localStorage value again immediately before its single write. The shared helpers do not write, merge concurrent libraries, read contacts or submissions, start respondent sessions, publish, send email or invoke providers.

Manual text can contain personal data despite its type. The UI must require synthetic-only acknowledgement and describe browser-local plaintext and exported JSON accurately. These validators are not a PII detector or redactor. Skipped inputs remain only in volatile composer state unless retained by a later reviewed path.

A localStorage precheck plus one atomic `setItem` is **not a cross-tab transaction**. A stale old application tab can still blindly overwrite a new mixed library because it runs old writer code. Refresh or close older editor tabs before using manual cases. New-code raw-baseline checks detect changes between review and confirmation; they cannot constrain or recover a later old-code write. Fingerprints are change detectors, not security hashes or published version identifiers.

## Source validation

Model/codec application source was frozen after these checks:

| Check | Result |
| --- | --- |
| `tests/manual-journey.cjs` | 12 groups pass: exact lexemes and complete expectations, review/draft/raw/name guards, tampered result rejection, blank/zero distinctions, safe field errors, type provenance, raw reserved keys, legacy preservation, version smuggling, mixed literal roundtrip, quota and independent byte/character bounds |
| `tests/journey-fixture-transfer.cjs` | Existing 12 groups pass unchanged in meaning |
| `tests/journey-fixtures-expanded.cjs` | Existing 13 expanded expectation checks pass |
| `tests/journey-testing.cjs` | Existing evaluator/representative path suite passes |
| Independent `tests/manual-journey-independent.cjs` | Separate QA owner reports 19 groups / 63 literal evaluator comparisons pass, including the initially reproduced raw reserved-key omission after the fix |
| TypeScript | `tsc --noEmit --incremental false` passes |
| Scoped ESLint | Four model/codec source files pass with no warnings or errors |

Logs for this lane are under `outputs/pippi-overnight-2026-10-12/compiled-verification-batch-16/manual-model/`: `model-initial.log`, `transfer-final.log`, `expanded-final.log`, `evaluator-final.log`, `typecheck-second.log`, `lint-final.log`. Initial type errors and initial transfer-version failure evidence remain preserved rather than overwritten. Independent QA owns its raw-key before/final evidence. Compiled browser/public-runtime checks are pending the root-owned combined build at this model freeze and must not be inferred from unit success.

## Files owned in this lane

New: `lib/manual-journey.ts`, `lib/journey-fixture-codec.ts`, `tests/manual-journey.cjs`, this note. Updated: `lib/journey-fixtures.ts`, `lib/journey-fixture-transfer.ts`. Existing public fixture and transfer exports remain available. No form schema, engine, scoring, marketing, API, server storage, package, provider or deployment changes were made by this lane.
