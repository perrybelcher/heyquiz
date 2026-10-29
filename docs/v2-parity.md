# V2 creator parity and release gates

Status: implementation in progress. This document is a verification checklist, not release approval.

## Design and scope

Use the combined editor and element-picker Product Design references selected on 2026-10-29. Creator surfaces use charcoal navigation, burgundy actions, warm surfaces, scoped styles, and the existing feature/data contracts. Public quiz rendering, embeds, public results, and public marketing pages are outside this redesign.

| Surface | Required parity | Evidence/status |
| --- | --- | --- |
| Workspace/dashboard | Search, types, creation, duplicate, delete, publication state | Pending browser verification |
| Creation/templates | All creation paths, template selection, guest-to-account continuity | Pending browser verification |
| Editor | Every supported field type, pages, cover, endings, scoring, branching, media | Pending complete field matrix |
| Element picker | Search/category access, exact insertion, one insert per activation, focus restoration | Pending browser verification |
| Design | Theme, cover, ending, report design | Pending browser verification |
| Connect | Integrations, tracking, marketing and existing availability gates | Pending browser verification |
| Publishing | Readiness, draft/live distinction, publish confirmation, sharing, pause | Pending end-to-end verification |
| Reports overview | Quiz search, response activity, report links, empty states | V1/V2 render and interactive search tests pass |
| Report tabs | Analytics/responses retained and accessible tab semantics | V1/V2 render checks pass; keyboard browser check pending |
| Contacts overview | Query, quiz and consent filters, 25-row pagination, distinct attempts, saved outcomes, refresh, report/manage links | V1/V2 render parity passes; browser filters/pagination pending |
| Experiments | Frozen versions, evidence review, launch, refresh, pause/resume, metrics and caveats | Existing behavior retained; browser verification pending |
| Profile | Details/security, preference switch, error retention, safe departure | Existing baseline passed; new switch browser verification pending |
| Help/support | Existing content and navigation accessible in V2 shell | Pending browser verification |

## Executed evidence

Before edits, the following completed successfully on the initial working tree:

- `npm test`
- `npm run test:reliability`
- `npm run test:workspace`

After the data-screen changes:

- `npx eslint components/ReportsOverview.tsx components/ContactsOverview.tsx components/Experiments.tsx components/ReportTabs.tsx`: passed.
- `node tests/workspace-screens.cjs`: passed, including V2 report search and Classic profile behavior.
- `node tests/v2-data-screens.cjs`: passed. Actual components render in both interfaces; contacts retain separate attempts, unscored responses never invent percentage scores, links encode quiz IDs, empty states remain clear, and report panels keep accessible semantics.
- `npx tsc --noEmit`: passed at the time of the data-screen handoff. Repeat after all agents finish integration.

These checks do not establish visual fidelity, browser interaction quality, or production readiness.

## Required compatibility matrix

Before enabling customer beta, execute and record outcomes for:

- Classic edit → V2 reopen → V2 edit → Classic reopen, comparing complete stored schemas, stable IDs and all relationships.
- One representative quiz per supported field type, plus branching, grouped pages, scorecards, product/segment matching, result reports, consent and lead capture.
- Failed save, uncertain response after committed write, offline recovery, expired authentication, changed account, stale revisions and concurrent tabs.
- Switch with pending edits: save failure blocks the switch; successful switch mounts only one controller/autosave instance.
- Every rollout mode, account eligibility, malformed preferences, missing records, failed preference reads and explicit Classic overrides.
- Recovery through `/interface-recovery` without depending on V2 rendering.
- Create → edit → preview → publish → submit → inspect reports/contacts with isolated staging fixtures.
- Chrome, Safari and Firefox, narrow phone/tablet/desktop layouts, keyboard-only insertion/reordering/navigation, and screen-reader labels/focus.
- Public pages, visitor quiz rendering, embeds and Classic style regression checks.

## Rollout and rollback rehearsal

The deployment owner must verify a staging environment with separate data and test integration credentials before testing writes. No test may silently reuse production customer quizzes or provider accounts.

Configuration:

- `PIPPI_INTERFACE_ROLLOUT=off` is the default and emergency override.
- `invite` uses `PIPPI_INTERFACE_ALLOWLIST` with stable account IDs.
- `opt-in` makes V2 a choice; `default-v2` adopts V2 while preserving explicit Classic preferences.

Rehearse with two synthetic accounts: allow one into V2, confirm the second remains Classic, save a V2 edit and verify it in Classic, then set rollout to `off` and verify both accounts resolve Classic on navigation/reload. Keep preference records intact. Restore the staging configuration after recording the result. A fallback changes presentation; it does not reverse data corruption.

External beta remains blocked until the complete parity matrix and Product Design QA pass, all regression failures are explained/resolved, and no data-loss, account-isolation, save or publication blockers remain. Cohort changes, default rollout and Classic retirement require separate release decisions.

## Operational telemetry

The creator emits first-party POSTs to `/api/interface-events`. The route requires authentication, same-origin checks and rate limiting. It accepts only the event enum and `v1`/`v2`; extra properties are rejected. Each log line contains `event: "pippi.interface"`, `name`, `version`, `count: 1`, and a server timestamp. No user, quiz, contact, answer, URL or raw error data enters these logs. The client uses no-referrer, same-origin credentials, best-effort delivery and no retries. This is separate from consent-gated Clarity analytics; the helper neither starts nor calls a third-party analytics service.

Aggregate by interface version and a fixed UTC period:

- Confirmed saves: sum `count` for `save_confirmed`.
- Observed save failure rate: `save_failed / (save_failed + save_confirmed)`; show both event counts and the denominator.
- Observed publication failure rate: `publish_failed / (publish_failed + publish_confirmed)`; show counts alongside the rate.
- Editor openings: sum `editor_opened`. These are openings, not unique users or sessions.
- Returns to Classic: sum `switch_to_classic`, attributed to the interface being left. Show the count alongside editor openings, without claiming unique-user retention or a true user switchback rate.

Instrument acknowledged transitions only: an initially loaded `saved` editor is not a new save; a preview is not publication; an unconfirmed response is not success. Telemetry can be dropped or throttled and authenticated clients can send duplicate/spoofed labels, so these are operational observations rather than an authoritative financial or usage ledger. Existing unversioned API failure logs remain useful for diagnosing gaps. Never infer zero failures from a period with no telemetry or no successful events.

`node tests/interface-telemetry.cjs` passes client nonblocking behavior, strict payload rejection, authentication/origin/rate rejection and log-field privacy checks. Full browser instrumentation counts require integration verification.

## Workspace browser evidence — 2026-10-29

Agent A used the Codex in-app browser on `http://127.0.0.1:3130` with the lead's isolated local data and `default-v2` configuration. No production account or quiz was used.

- Dashboard: desktop 1280×720 renders the charcoal navigation, burgundy actions, actual quiz counts and compact quiz rows without clipped content. Existing preview and action controls remain visible.
- Profile: selected Classic and saved; the resulting page rendered the Classic header and marked Classic as current. Selected New interface and saved; the resulting page rendered the V2 rail and marked New interface current. The local account was left on V2.
- Templates: selected the product-finder outcome; searched for `coffee`; observed exactly one matching template and the clear-filters control.
- Help: desktop and 390×844 mobile layouts inspected. Mobile had no horizontal document overflow. Opening the workspace menu, focusing its Quizzes link, and pressing Escape closed the menu and restored focus to the `Open workspace menu` trigger.
- Profile API regression suite: all 17 groups passed. TypeScript passed after the workspace changes. Targeted ESLint has no errors; Dashboard retains its two existing `window.location.assign` advisory warnings.

Local screenshot evidence: `/tmp/pippi-v2-profile.png`, `/tmp/pippi-v2-templates.png`, `/tmp/pippi-v2-mobile-help.png`. These temporary captures are workspace verification evidence, not complete Product Design sign-off or cross-browser certification. The original script logo embedded in `public/pippi-logo.svg` was extracted without alteration to `public/pippi-script-logo.png` because the SVG's embedded image rendered blank in the tested browser; the raster logo was visibly verified.

## Additional integration evidence

- `node tests/v2-field-compatibility.cjs`: passed for all 51 registered field types. Executes the actual shared editor factory with V1 and V2 flags, verifies identical metadata and insertion identity, preserves existing branch rules, and checks three isolated storage revisions. This does not replace browser editing coverage.
- `node tests/workspace-navigation.cjs`: 18 groups passed, including cancelled switch before preference write, draft-save → preference-save → reload ordering, failed preference writes, and competing actions locked while a write is pending.
- `npm test`, `npm run test:reliability`, and `npm run test:integrations`: passed after integration work (including 23 integration and 24 source-lifecycle groups).
- `TEST_ALLOW_LOCAL_INTERFACE_QA=true TEST_BASE_URL=http://127.0.0.1:3130 node tests/interface-http.cjs`: passed against the isolated local test server. Verified local-mode account first; created a 51-field quiz using the actual editor factory; switched V2 → Classic → V2 and saved/reloaded with every question field and page value retained; rejected stale quiz/preference writes and a wrong-account preference header; verified that switching interfaces never exposed a newer draft title on the published visitor page. Both disposable quizzes were deleted and the original interface preference restored.

The HTTP test refuses non-loopback URLs and requires explicit `TEST_ALLOW_LOCAL_INTERFACE_QA=true`. Run only on a server configured with isolated test data. Operational telemetry tests and all-field/HTTP checks pass; cross-browser and remaining visual/interaction gates still require their own evidence.

## Lead final verification

- `npx next build --webpack`: production compilation, TypeScript and all 75 pages passed. Default Turbopack build stalled locally and was interrupted; no default-build pass claimed.
- Actual local browser: V2 insertion → edit → confirmed save → publish → visitor submission → Results verified (one synthetic response).
- `/interface-recovery` browser rehearsal saved Classic preference and redirected to Classic dashboard successfully.
- Final selected-reference comparison and remaining visual gates: [design-qa.md](design-qa.md).
- Shared state/autosave remains a single instance inside EditorStudio. Presentation slots are extracted, but a standalone controller module was intentionally not split out in this change; further extraction is a separate refactor, not a second editor implementation.
