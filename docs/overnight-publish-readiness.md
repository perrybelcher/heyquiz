# Shared client publish readiness

12 October 2026, batch 15. This is an extraction of the existing publish-confirmation policy for reuse by the guided checklist. It adds no publishing requirement and changes no schema, API, storage, scoring, capture or environment behavior.

## Implementation and contract

`lib/publish-readiness.ts` exports `getPublishReadiness(form, options?)`, `PublishReadinessChecks`, `PublishReadinessFinding`, `PublishReadinessTarget` and `PublishReadinessOptions`. The result has ordered `blockers` and `warnings` arrays. Each finding contains a typed `code`, the unchanged dialog `message`, and optional `targets` whose IDs are directly available from the current form.

The optional `includeScoringDiagnostics` defaults to true. Only an explicit false omits the bounded scoring diagnostic calculation; it preserves every structural/marketing blocker, missing destination/privacy warning and their targets. The persistent checklist uses that lighter mode and explains that scoring diagnostics run in Review & publish. The publish dialog omits options, preserving its complete original behavior. No diagnostic result is cached or presented as current while typing.

Known targets are quiz title, question title by question ID, ordinary marketing outcome destination by outcome ID, and capture privacy. Missing question titles and outcome destinations remain one aggregate finding each; their target arrays retain form order. No IDs are inferred from error messages. Opaque scoring diagnostics receive only their code/message, and reference versus marketing failures are identified by the validator being called.

The helper is client-safe and pure with respect to the supplied form. It creates fresh findings and target arrays and imports the existing client-compatible reference, marketing and scoring diagnostic functions. It does not read records, browser storage, environment variables or network resources.

`components/PublishReadiness.tsx` now obtains its checks from that helper. It renders each finding's message with the same grouping and order. Its modal lifecycle, title/copy, cancellation guard, busy state, capture summary, explicit confirmation callback and disabled-button policy remain unchanged.

## Exact policy retained

Blockers appear in this order: no questions; blank quiz title; any blank question title as one finding; the first thrown reference/marketing validation error. Reference validation still runs first and a failure prevents the marketing validation call. Non-Error exceptions retain the original generic fallback wording.

Warnings retain scoring diagnostic order, followed by the aggregate missing non-scorecard outcome destinations and then enabled capture without a privacy link. Warnings do not disable Publish now. Existing scorecard band validation remains unchanged; ordinary outcome destination warnings do not apply to scorecard bands.

This is deliberately not a new policy engine. For example, blank answer wording is not a new dialog blocker. The previous truthiness check for missing destination/privacy URLs is unchanged, including whitespace-only strings; the existing save schema and any separate editorial URL checks retain their own responsibilities. Landing publication validation, result-email copy checks and server/environment-dependent checks were not added to the client dialog. Blank display-field question titles remain included because the original dialog checked every question, unlike some editorial inspectors that exclude display fields.

## Evidence

`node tests/publish-readiness.cjs` initially passed **17 scenarios**; the explicit diagnostic opt-out adds two scenarios, for **19 total**. Expected findings are explicit fixtures, not values copied from a second implementation of the helper. Coverage includes ordinary and marketing drafts, exact text/order, aggregate stable targets, missing destinations/privacy, first-failure behavior, diagnostics for ties/unreachable/fallback paths, scorecard bands, non-Error exceptions, frozen input and independent returned arrays, and a runtime import-graph check against server dependencies or external state. The new cases prove an explicit false never calls the diagnostic and retains the other checks, while omitted options, empty options, undefined and explicit true continue calling it. Real diagnostic findings also prove default/true parity and that false removes only those findings.

The final three scenarios render the actual component's React element tree with deterministic hook wiring. They exercise unchanged message order, blocker versus warning gates, explicit confirm/back callbacks, busy cancellation, native-modal lifecycle calls and changed-form rendering. These are component-behavior checks, not browser layout/focus or screen-reader certification.

Scoped ESLint passed for the two application files, and full `tsc --noEmit --incremental false` passed on the combined working source at this handoff, including after the opt-out addition. Logs are in `../pippi-overnight-2026-10-12/compiled-verification-batch-15/publish-readiness/`: `unit-first.log`, `unit-final.log`, `lint-final.log` and `typecheck-final.log`; initial lint/typecheck logs are also retained. Root owns compiled before/after browser-dialog acceptance and combined build evidence; those results are separate from this source-level run.

## Limits and integration note

The unchanged scoring diagnostic calculation can enumerate up to 4,096 supported finite paths. Root measured 153/134/134 ms for 12 required binary-choice questions, 10 outcomes and 240 rules, justifying the explicit opt-out during editing. This is a local source microbenchmark, not a browser or production performance claim. The checklist should still reuse one lightweight readiness result per form update and avoid duplicate calls while rendering findings. Large-draft typing responsiveness needs separate compiled UI acceptance. Diagnostic coverage at publish confirmation remains unchanged.

Passing these client checks does not guarantee a successful save or server publication. No real participant data, provider, email, cloud service, production deployment or browser server was used by this extraction's tests. Human beginner usability remains unmeasured.

Changed files: `lib/publish-readiness.ts`, `components/PublishReadiness.tsx`, `tests/publish-readiness.cjs`, and this document. Repository `AGENTS.md` and the installed Next.js `use client` guide were read before edits.
