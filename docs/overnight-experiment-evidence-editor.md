# Reviewed experiment evidence: UI

Batch 17, 12 October 2026. Local implementation and final compiled browser acceptance are complete. No production deployment was performed.

## Scope

- `ResultsChart.tsx` offers **Plan a test** only for a measured question with at least one quiet session. The link carries validated quiz/question/wording and date/source/campaign/publication selectors, never totals or a proof. The stable wording key is independent of existing analytics row IDs and earlier-wording display suffixes.
- The existing experiments page validates URL selectors server-side and keeps the ordinary manual creation path available. Evidence-backed planning pins the selected source to **Version A**. The creator still creates, publishes and chooses Version B through existing tools.
- `ExperimentEvidenceCard.tsx` displays only parsed aggregate metadata: exact published wording, reached/instrumented/quiet/completed sessions, missing tracking, source/campaign and date cohort. Exact UTC cutoff, publication and observation timestamps, with fuller measurement definitions, are available through the keyboard-operable **Observation details** disclosure. Publication narrowing remains explicit outside the disclosure. Quiet is not called abandonment, a cause, unique people or the experiment's assigned-browser denominator.
- The existing optional plan fields and review step are reused. A tentative hypothesis starter is editable; no quiz, variant or scoring is generated or changed. Refreshing evidence or published versions invalidates the review and preserves the authored hypothesis/change. Removing evidence returns to manual selection and preserves the plan text.
- Saved experiment cards display the immutable supporting observation separately from live experiment results. Legacy tests have no inferred retrospective evidence.

## Safety and state boundaries

The owner-only evidence read returns a strictly parsed display DTO; its form, question, wording, normalized selectors and source digest must match the current choice. Its signed verification header is held only in a volatile ref and supplied only on confirmed launch. It is never serialized into page props, URLs, storage, display or test evidence logs. Missing/malformed headers or display data cannot enable review. Launch failures that require new verification invalidate the review while preserving authored text; explicit refresh is required.

Evidence requests have abort, sequence and exact-context guards. Loading itself is keyed to the selector/publication digest so a changed publication cannot remain represented by an obsolete pending read. Listing refresh may invalidate evidence but does not silently re-observe traffic. No analytics request is made while typing. A later observation is accepted only following explicit refresh; new traffic does not alter an already reviewed/saved observation.

The source/verification/model/API owner supplies the shared evidence contract and server validation. This UI does not reproduce aggregation, signing, retirement checks or scoring. It uses the unchanged launch body and a dedicated verification header. Source publication changes and expired verification must be rejected by the server; the client display is not an authorization boundary.

## Final compiled acceptance

`tests/browser-experiment-evidence.cjs` passed against the shared release build on port 3164 in Chromium (Chrome channel), Firefox and WebKit. All runs used isolated local authentication and disposable synthetic records. Final evidence is under `../pippi-overnight-2026-10-12/compiled-verification-batch-17/experiment-evidence/`:

| Engine | Final log / artifact folder | Scoped WCAG scans | Page errors | Public starts / external requests |
| --- | --- | ---: | ---: | ---: |
| Chromium | `chromium-release.log` / `chromium-release/` | 9, zero violations | 0 | 0 / 0 |
| Firefox | `firefox-release.log` / `firefox-release/` | 9, zero violations | 0 | 0 / 0 |
| WebKit | `webkit-release-native-keyboard.log` / `webkit-release-native-keyboard/` | 9, zero violations | 0 | 0 / 0 |

All 27 scoped scans cover collapsed evidence, expanded observation details and expanded review at 320, 390 and 1440px. Each run observed 15 evidence reads and two launch requests: one intercepted rejection and one accepted local experiment. Every accepted experiment and each run's own quiz, attempt and lifecycle fixtures were cleaned up. Counters are measured from actual browser requests, not inferred from expected behavior.

The suites verified real Results-to-plan navigation; selector-only URLs; historical draft wording versus exact published wording; explicit publication narrowing; literal aggregate counts; no per-keystroke analytics reads; review/Escape/Back without a write; later-traffic freezing; explicit refresh; out-of-order reads; changed source digests during overlapping reads; unavailable, malformed and missing-header responses; stale-verification rejection; authored-text preservation; confirmed launch/reload/pause immutability; republish mismatch; manual fallback and invalid URL rejection. Saved evidence was compared with the complete aggregate object last displayed for review. Verification headers were never written to artifacts.

The two review actions passed strict active-element and full viewport-bound assertions with real keyboard traversal. Chromium and Firefox use Tab. On this macOS WebKit build, ordinary Tab skips ordinary buttons; an isolated plain-HTML diagnostic proved that Option+Tab traverses them. WebKit therefore uses `Alt+Tab` in the same assertions, recorded in its result file and `webkit-native-keyboard-diagnostic.json`. This is browser-default keyboard behavior, not a claim about physical devices or assistive technology.

A held-animation-frame regression confirms that the guarded review-action visibility callback neither scrolls nor steals focus after the user moves focus elsewhere. It only reveals a still-connected, still-active keyboard-focused action when measured bounds are clipped; it never calls focus. Visible and pointer-focused controls are left alone.

Representative collapsed-card heights were 687.5 / 573.5 / 360.5px at 320 / 390 / 1440px in Chromium and WebKit, and 688 / 574 / 361px in Firefox. Page-level horizontal overflow assertions passed. Visual inspection of final mobile cards, expanded details, visible focused review actions and the desktop layout found readable wrapping and consistent hierarchy. The compact card keeps counts, cohort and caveats visible while exact timestamps remain available in a collapsed native disclosure. No exact reduction percentage is claimed because the original card's DOM height was not recorded.

Source-scoped ESLint, full TypeScript checking and browser-script syntax passed before the final release build. The parent owns the separate compiled HTTP, aggregation parity and legacy experiment-plan regression results; they are not counted among these 27 UI scans.

## Retained failures and corrections

- Initial Chromium/Firefox passed the earlier verbose layout. Mobile visual review then led to the compact observation card, retaining every measurement caveat and exact timestamp through the disclosure.
- Initial WebKit found a real 320px horizontal overflow from native version-select content. Element diagnostics and a DOM-only constrained-select experiment are retained. The final select uses bounded truncated display while preserving its complete option/title; all final overflow checks passed.
- Compact Firefox exposed a genuine clipped keyboard-focused review action (bottom 1002.85px in a 1000px viewport). Waiting longer and a fresh real-Tab traversal reproduced it. A CSS scroll margin alone did not fix the native behavior. The final narrowly guarded visibility callback corrected it; initial, timed and DOM-only diagnostic evidence is retained rather than counted as acceptance.
- `webkit-release/` preserves the initial ordinary-Tab failure. Its active element became BODY because this WebKit default skipped both buttons. The independent plain-HTML diagnostic and final native-keyboard run distinguish that test-environment behavior from the application visibility defect.
- `webkit-final.log` records a separate test setup typo in the isolated data directory (missing `10-`), before UI acceptance. Its exact two leftover test lifecycle receipts were identified and removed after verifying their own IDs/owner and absent form records; `test-environment-cleanup.log` records the cleanup. No unrelated records were changed. The correct-data WebKit compact run and the final release run passed.

## Limits

This adds no automatic variant, rewrite, significance estimate, winner selection, stopping rule, traffic allocation change, real email/provider work or production deployment. The evidence read still scans retained owner records; it does not solve scale/indexing. There is no persistent autosave of the experiment setup text across a full page reload or leaving the page; preservation covers the existing in-page review/refresh/failure paths. The supporting observation is not evidence of causation or a conversion improvement.
