# Manual journey input: independent compiled respondent baseline

12 October2026. Root-owned tests/manual-journey-compiled.cjs creates two UUID-scoped synthetic quizzes on the explicitly isolated local server. It uses actual owner create/publish and anonymous start/submit routes, then checks retained synthetic submissions. It removes only its own forms, attempts, submissions and revocation receipts. It does not use the proposed manual helper as its expected-result oracle.

Before implementation, the acceptedbatch15 compiled candidate passed13 actual starts/completions and5 rejected invalid submissions. Evidence: compiled-verification-batch-16/respondent-before/results.json and api.log. One initial fixture setup failed schema parsing before any request because required empty badge/message strings were absent; fixture-setuperror retained as fixture-setup-failure.log.

Eight literal knowledge cases check number-string preservation, 1 versus1.0/01/1e0 keyed grading, strict greater-than routing, inclusive min/max, unchanged API step semantics and hidden-answer removal. A ninth attempt rejects five invalid numeric/required-text answers without creating a submission, then accepts corrected answers on the same token. Four scorecard cases verify case-insensitive/trimmed text routing, numerical threshold visibility, mapped0 versus unknown/null coverage, and withheld overall score when any category lacks sufficient coverage. Raw answers/contact remain absent from public response projection.

The API currently accepts an in-range1.01 for a step1 number field; this records server behavior, not a claim about native browser step validation. Number/text grading is lexical after trimming/case folding; numeric comparison semantics apply to numeric branch operators. Fixture input limits must not silently change respondent validation.

The same test passed against the initial batch16 build with exact JSON observation parity: 13 successful submissions and five rejected invalid submissions on each build. Evidence is in `compiled-verification-batch-16/respondent-before`, `respondent-after`, and `respondent-parity.json`. Later composer focus and friendly storage-error corrections affect the client only; frozen runtime manifests identify those separately.

These are local synthetic published API checks, not hosted verification, human usability, exhaustive numeric/text paths or inbox/provider testing. The authoring UI has separate browser evidence. No email, CRM or payment call is made by this test.
