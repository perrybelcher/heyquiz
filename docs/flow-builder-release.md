# Visual flow builder release checklist

## Enablement and architecture

The editor entry point is lazy-loaded in EditorStudio. In development it is enabled; production requires `NEXT_PUBLIC_FLOW_BUILDER=true` at build time. Leave disabled for general production until the gates below are completed. Routing runtime is independent of this editor switch, so removing the UI flag does not disable published explicit routes.

Dependencies @xyflow/react and elkjs are exact-pinned in package.json/package-lock.json. Layout runs in a worker; request IDs invalidate stale responses. FormSchema stores routing v1 and editorLayout v1. Public forms remove layout metadata. Existing forms continue using the legacy engine until explicitly upgraded. Published snapshots and attempt snapshots keep their existing storage behavior.

Local prototype is reference only; production TypeScript components are under components/flow. Existing unrelated uncommitted work was preserved.

## Verification commands

- `npx tsc --noEmit`
- `npm test`
- `npm run test:reliability`
- `npm run test:outcomes`
- `npm run test:flow`
- `npm run test:browser-flow` against isolated local mode with the feature enabled.
- `npm run build`

Never use production customer quizzes for test fixtures. Browser scripts create synthetic owned fixtures and use an isolated data directory.

## Browser support contract

Test and record exact versions for latest two Chrome/Edge and Firefox majors on Windows/macOS, Firefox ESR, current/previous Safari on supported macOS, current/previous iOS/iPadOS Safari and current Android Chrome. Browser-engine automation is a compatibility signal, not a substitute for installed Safari or real touch devices.

Required interactions per platform: add/edit/move questions, drag/tap/menu answer connection, reconnect/disconnect, rule order and numeric conditions, undo/redo, save/reload/conflict, preview to result, pan/zoom/Fit/minimap, resize/orientation, 200% zoom and software keyboard. Include VoiceOver/Safari and NVDA/Firefox or Chrome. Keep exact OS/browser/device versions with release evidence.

## Performance and usability gates

Fixtures: 15, 50, 200 questions, largest approximately 800 connections. Record hardware, browser version, viewport, build mode, cold/warm cache and timing sample counts. Targets: p95 frame time <33ms during drag/pan, visible interaction feedback <100ms, usable 50-question canvas <2s after draft data. No timing target is claimed passed without measurements. Layout must not overwrite edits made while the worker is busy.

Representative users must identify D's destination within five seconds, build A/B/C/D branches without coaching, and repair a mistaken connection. These remain human acceptance gates.

## Rollout and monitoring

Internal review -> opted-in pilots -> general availability. Canvas render failures emit `flow_editor_failed` through the existing privacy-limited interface-event endpoint. Existing save/publish telemetry and API failure references cover persistence/publication failures without including answer content. Keep the return-to-editor error boundary and recovery snapshots.

Release only after compatibility, outcome delivery, migration parity, accessibility, performance and usability gates pass. If editor failures rise, disable the editor flag and rebuild. Preserve routing runtime support and published snapshots; do not downgrade schemas or discard user drafts.

## External verification still required

Real Safari versions, Windows hardware, iOS/iPadOS/Android hardware, assistive technologies and representative user studies require an available device/test environment. Do not report these as passed based on Chromium/Firefox/WebKit automation.

## Automated runtime evidence (2026-10-30)

Isolated loopback dev server at port 3194, synthetic records under `/private/tmp/pippi-flow-browser-data`, macOS arm64. No customer records or live publication used.

- `node tests/flow-integration.cjs`: passed abandoned-route answer cleanup, common rejoin answers, no legacy change, exhaustive finite paths, incomplete-route diagnostics, grouped-page conditions.
- `node tests/journey-testing.cjs`: existing suite passed.
- Chromium 153.0.8010.12: canvas Add/Undo; actual pointer drag from D to another result; Undo restores route; tap answer badge then target; destination menu; toolbar visibility at 390/768/1280/1513px; synthetic published D -> detail -> Launch plan; no page errors. Screenshot: `output/flow-builder/chromium-canvas.png`.
- Playwright WebKit 26.6: initial canvas/Add/Undo/responsive and synthetic published respondent-route smoke passed. This is not real Safari certification.
- Firefox Playwright build firefox-1543 could not launch in this environment: `Could not find profile folder`, including escalated execution and an alternative temp directory. Firefox application compatibility remains unverified.

Development-mode diagnostic performance via `tests/browser-flow-performance.cjs`:

| Questions / edges | Canvas nodes visible after opening | Idle frame p95 |
| --- | --- | --- |
| 15 / 60 | 423 ms | 16.8 ms |
| 50 / 200 | 1075 ms | 16.7 ms |
| 200 / 800 | 1177 ms | 50 ms |

These are development-mode wall times with precomputed block positions and idle frames. They do not prove production startup, drag/pan frame budgets, selection latency, worker layout timings, Windows behavior, or real mobile usability. The 200-question idle result exceeds 33ms and requires production-mode profiling before a performance claim. Run `HEYQUIZ_DATA_DIR=<isolated-dir> QA_BROWSER=chromium|firefox|webkit|chrome|edge node tests/browser-flow.cjs` against the local server with matching `TEST_BASE_URL`. Performance harness also requires an isolated directory. Never run these fixture-writing tests against hosted accounts.

Expanded WebKit 26.6 pointer checks also passed: actual answer-handle drag, tap-source/target, destination menu, Undo, and published result journey. A feedback notice initially intercepted the Undo toolbar; the canvas agent was notified to move it clear of controls, and the rerun explicitly dismissed the notice before Undo. Evidence: `output/flow-builder/webkit-canvas.png`. Both browser passes used synthetic local records.

### Production rerun

The production build with `NEXT_PUBLIC_FLOW_BUILDER=true` passed the expanded Chromium 153.0.8010.12 and WebKit 26.6 suites: real answer-handle drag, tap-source/target, destination menu, Undo, Add/Undo, responsive toolbar checks, and published D -> detail -> Launch plan. No page errors were recorded. Production screenshots replaced the same browser artifact paths above.

The initial performance fixture accidentally named its layout field `flowEditorLayout`, which the schema stripped. The earlier development startup values therefore included automatic layout; they must not be described as persisted-position measurements. The fixture now uses `editorLayout` and supplies every block position, including the automatic terminal. Missing that terminal position triggered full automatic layout and could override an in-progress Find operation; complete persisted fixtures avoid that race.

Production Chromium diagnostics, macOS arm64, serialized run, actual block movement asserted:

| Questions / edges | Canvas nodes visible | Idle frame p95 | Active pan frame p95 | Active block drag frame p95 |
| --- | --- | --- | --- | --- |
| 15 / 60 | 868 ms | 16.8 ms | 16.7 ms | 16.7 ms |
| 50 / 200 | 876 ms | 16.7 ms | 16.8 ms | 16.7 ms |
| 200 / 800 | 923 ms | 16.7 ms | 33.4 ms | 16.7 ms |

Active frame samples span actual mouse interactions and a short idle tail at an editable zoom, with all nodes/edges retained. Startup measurements count visible question nodes, not a fully settled ELK arrangement. These local diagnostic numbers do not certify real-device performance or p95 selection feedback. The 200-question pan sample is slightly above the strict <33ms target, so that performance gate remains open.

An unpublished synthetic preview is retained at `/editor/flow-preview-growth-plan` in the isolated local data directory. It contains 15 questions with A/B/C/D answer ports, repeated branching, shared questions, four result pages, and saved positions. `scripts/seed-flow-preview.cjs` recreates it only on loopback with an explicit isolated data directory.

### Final optimized production bundle (supersedes prior performance table)

After isolating zoom-label updates and optimizing canvas subscriptions, the final production bundle passed the expanded Chromium 153.0.8010.12 and WebKit 26.6 scripts again, serially. Both refreshed screenshot artifacts. No page errors occurred.

The performance harness then ran alone on the same macOS arm64 environment:

| Questions / edges | Canvas nodes visible | Idle frame p95 | Active pan frame p95 | Active block drag frame p95 |
| --- | --- | --- | --- | --- |
| 15 / 60 | 888 ms | 16.8 ms | 16.7 ms | 16.7 ms |
| 50 / 200 | 881 ms | 16.7 ms | 16.8 ms | 16.8 ms |
| 200 / 800 | 921 ms | 16.8 ms | 16.8 ms | 16.7 ms |

This replaces the earlier 200-question 33.4ms pan finding for the final tested bundle: the local diagnostic sample now meets the <33ms frame target across all three sizes. The harness asserts real block movement and samples during mouse actions plus a short idle tail, at an editable zoom with all nodes/edges retained. Broader performance certification still requires representative hardware, repeated distributions, selection-feedback latency, large-layout worker measurements, and real mobile devices. Startup values mean question nodes became visible, not that a newly requested automatic layout completed. Firefox runner and actual Safari/device release gates remain unchanged.

Final connector geometry correction was rebuilt and rechecked in production mode: Chromium153.0.8010.12 and WebKit26.6 both pass real handle dragging, tap-to-connect, destination menus, undo, responsive controls, and D-to-Launch-plan playback with zero page errors. The final production build and TypeScript checks pass. Targeted flow ESLint and git diff whitespace checks pass. The editor remains opt-in for production builds; no live deployment occurred. Review example: `http://127.0.0.1:3194/editor/flow-preview-growth-plan` (isolated local workspace, unpublished synthetic records).

## Release retest before main update

Reverified the release checkout based on production9e99e92 with the preserved Basic builder: flow domain/editing/integration tests, existing regressions, outcomes, draft/session reliability, independent Basic acceptance and TypeScript all pass. Production-mode Chromium153.0.8010.12 and WebKit26.6 tests pass real drag/tap connection changes, menus, undo, responsive controls and synthetic published D-to-Launch-plan completion with zero page errors. No feature fixes were necessary in this retest. Production remains enabled by the Vercel project build command `NEXT_PUBLIC_FLOW_BUILDER=true npm run build`; project environment variables were not changed. Real-device/Safari/Firefox-runner limitations above remain unchanged.
