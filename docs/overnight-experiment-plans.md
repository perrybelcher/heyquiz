# Batch 8: optional immutable experiment plans

## Implemented scope

The existing manual A/B workflow now offers **Record a test plan before launch (recommended)**. Basic launches remain available for compatibility. A plan records a bounded hypothesis, the creator's intended one change, and a primary metric: completion rate or captured-contact rate per assigned browser that starts. The latter is rejected unless both frozen published variants enable capture. Capture is explicitly distinguished from marketing opt-in, qualification and purchase.

A completion floor (0–100%, including fractional values) and UTC calendar review date are optional, without fabricated defaults. The floor is a review signal, not proof of harm/safety, significance or a stopping rule. If completion is primary, the UI explains that its floor uses the same metric. The date appears as a report reminder only; there is no notification or automatic action. No assigned starters displays **Not measured**, never historical/empty 0%. Floor boundaries compare raw fractions; displayed rates are rounded.

Planned launches require a separate review of the text and selected published A/B titles. Back/Escape preserves setup inputs and performs no write. Failures retain the reviewed values. Owner listings expose only a capture-enabled flag and SHA-256 snapshot digest in addition to the existing form ID/title; full snapshots remain server-side. A canonical full-snapshot digest is required for both planned variants, and a publication change returns 409 instead of silently accepting a different version. JSON key reordering alone does not conflict.

The accepted plan is saved atomically with the existing frozen variants. Strict status-only PATCH validation rejects attempts to alter it or the variants/name. Legacy/basic records remain plan-less and are labeled **No plan recorded before launch**. The creator's intended change is not certified as the only structural difference; no scoring comparison or rewrite is performed.

Assignment, tokens, random split, attempt capture, scoring and existing counts were not changed. The report highlights the chosen primary metric while retaining descriptive counts/rates. It does not introduce winner, lift, significance, automatic stop or promotion claims. Successful writes followed by a listing-refresh failure report that the change was saved, reducing accidental duplicate launches. Request-generation guards prevent older listing responses/errors from replacing a newer refresh.

## Privacy and validation

- Authentication and origin checks precede body/storage work.
- Plan text is trimmed, required and capped at 600 characters per field; unsupported controls, fields, versions and metrics are rejected. Names remain capped at 120. Optional dates must be actual YYYY-MM-DD dates, including leap-year validation; floors must be finite 0–100 numbers.
- The launch body has a 12 KiB streamed UTF-8 byte cap before JSON parsing, including missing/incorrect Content-Length, multibyte and chunked bodies. Pause/resume has the same reader with a 256-byte cap. Oversized streams are cancelled, malformed JSON/UTF-8 rejected.
- The plan contains owner-authored text/configuration only. No respondent answers/contact fields, visitor IDs, tokens or artificial analytics evidence are added. GET remains owner-scoped and private/no-store; new errors do not echo submitted text.
- Deleted contact data remains excluded from counts by the existing retained-submission join. Deletion/ownership/publication lifecycle safeguards remain intact.
- No evidence bridge, ResultsChart changes, generated hypothesis/AI request, new schema/record kind, database migration, production/provider/email action or deployment was included.

## Files

- New `lib/experiment-plan.ts`: strict schemas, canonical serialization, pure null-safe metric/floor/reminder helpers, bounded request reader.
- `lib/experiments.ts`: optional plan type only; assignment/availability/aggregation unchanged.
- `app/api/experiments/route.ts`: safe owner DTO, reviewed publication digests, strict bounded planned/basic creation.
- `app/api/experiments/[id]/route.ts`: coordinated narrow status-only bounded validation.
- `components/Experiments.tsx`: opt-in setup/review, immutable plan display, truthful metric/floor/date states and stale-refresh protection.
- `tests/experiment-plan.cjs`, `tests/experiment-plan-api.cjs`, `tests/browser-experiment-plan.cjs`, `tests/browser-experiment-plan-focus.cjs`.
- `docs/experiments.md`: plan documentation and correction that unpublishing blocks new experiment assignments/starts without changing frozen snapshots.

## Verification

Passed:

- `node tests/experiment-plan.cjs`: 7 groups; legacy/plan contract, strict validation, unknown denominator, raw fractional floor boundaries, primary denominator/shared metric, UTC reminder, canonical ordering.
- `node tests/experiment-plan-api.cjs`: 11 in-memory groups; auth/origin/read ordering, safe owner DTO, exact frozen creation, stale digest conflict, capture eligibility and owner checks, invalid plans, legacy no-plan, status-only immutability, patch owner protection, streamed bytes/UTF-8/cancellation, retained-contact privacy. No persistent/cloud records used.
- Existing `node tests/experiments.cjs`: assigned-browser deduplication/isolation/privacy.
- Existing `node tests/experiment-lifecycle.cjs`: 11 checks, including frozen republishing, paused/unpublished states, deletion/same-ID recreation, new experiment and owner/token isolation.
- Focused ESLint and `npx tsc --noEmit` passed.

Passed in isolated Chrome against the combined compiled batch-8 app: `tests/browser-experiment-plan.cjs`. The run used `TEST_BASE_URL=http://127.0.0.1:3163`, explicit isolated `HEYQUIZ_DATA_DIR`, all five cloud vars empty and optional `ARTIFACT_DIR`. It created three synthetic owned quizzes and two experiment records, used no public starts, and cleaned its own records. It checked basic/legacy UI, contact-metric eligibility, keyboard review/Escape/back without writes, real republish conflict, intercepted failure/retry, 390px launch, immutable reload/pause/resume, and explicit synthetic report DTOs for null/floor/date and out-of-order refresh behavior. Intercepted report counts are not persisted conversions.

The new browser suite passed real republish-conflict rejection, keyboard/cancel/error preservation, reviewed launch, immutable reload/pause/resume, 390px reflow and controlled stale-response rejection. Initial runs exposed test-locator assumptions (native `option.disabled` versus Playwright option state, and wrapped labels whose text included select options or filled textarea content). The repaired test uses the native option property and accessible-role selectors. All initial failure logs were preserved; no application change or rebuild was needed to resolve them. The final run had no browser exceptions.

Existing `tests/browser-experiments.cjs` also passed unchanged against that compiled build: basic UI creation, sticky assignment, authentication, token tampering and mismatched arm rejection, actual synthetic submission, repeat/direct-link exclusion, pause/resume, mobile layout and public player. Its exact experiment and two synthetic quizzes/attempts/responses were cleaned after the run.

Full evidence: `../pippi-overnight-2026-10-12/compiled-verification-batch-8/experiments/plan/` (final log, initial selector-failure logs, reviewed-plan and stored-plan mobile screenshots) and `experiments/legacy/browser.log`. The reviewed-plan mobile screenshot was visually inspected for readable content and reachable controls. Root owns the combined build, server and separate accessibility/reflow scan.

An independent follow-up, `tests/browser-experiment-plan-focus.cjs`, passed eight return-focus cases in the same compiled Chrome app: Escape and keyboard Back at 320px and 1440px, plus both cross-resize directions while review was open. Each case checked the exact setup trigger regained focus within two seconds, preserved the hypothesis, and made no experiment or public-start request. The immediate assertion used in an earlier accessibility check raced the existing animation-frame focus restoration; no application change was needed. The two synthetic forms were cleaned. Evidence: `experiments/focus/browser.log` and `experiments/focus/focus-restored-320.png` under the same batch-8 directory.

The focused suite accepts `QA_BROWSER=chrome|firefox|webkit` (Chrome channel is used only for `chrome`). Against the final compiled batch-8 build, Firefox and WebKit each passed the same eight cases: **24 return-focus cases across three engines in total**. Both follow-up runs had no browser errors, launched no experiment, used no public starts and cleaned their synthetic forms. Separate logs and screenshots are in `experiments/focus-firefox/` and `experiments/focus-webkit/`. The broader functional suite was not repeated because the final application edit was outside the experiment lane.

Limitations: browser/date/device/production behavior beyond the named checks is unverified. There is no analytics-linked evidence or automatic one-change validator. The plan does not create a fixed analysis horizon or measure confidence; later attempts/completions and contact deletion can change descriptive totals. A network failure with an unknown launch outcome has no new cross-request idempotency protocol; the client does not automatically retry launches.
