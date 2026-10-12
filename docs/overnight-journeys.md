# Overnight journey confidence improvements — 12 October 2026

## What changed

- Representative finite-choice paths run before bounded enumeration: first/optional skipped, no-rule, explicit zero, highest mapped points, lowest mapped points, alternating low/high, last answers, and target-specific point probes. Each probe follows the real branch resolver; it does not answer skipped fields.
- Representative and enumerated paths are deduplicated. The UI labels how a path was selected and reports both counts with their overlap. Only completing supported discrete traversal produces “Complete finite-path coverage.” Sampled result absence does not claim an outcome is unreachable.
- The existing default 256 / hard 512 case cap and complexity/node budget remain. Unsupported typed fields, hidden inputs, large multi-select domains, randomization, timers, capture, email, integrations and conversion remain explicitly outside complete coverage.
- The Conversation Map now saves up to 25 **named expected-result cases per quiz in the current browser**. These preserve the synthetic answers, expected status/result/score, visible question sequence, original draft fingerprint and revision. A later run reports actual differences. Baselines do not silently update when behavior changes.
- Unsaved edits invalidate previous test results. An editorial edit can still pass the expected behavior when rerun, while the UI clearly labels that the draft differs from the original baseline.
- Local storage failures do not report a false success. Storage is versioned and bounded, with format/size validation. Saved cases are not account-synced, published, or actual respondent data.
- Unmapped-answer observations are grouped into one factual reminder instead of one repeated reminder per question. The app does not guess whether the author intended an answer to be neutral.
- Mobile dialog header uses less space and keeps the close control alongside its title.

## Files

- `lib/journey-testing.ts`
- `lib/journey-fixtures.ts` (new)
- `components/ConversationMap.tsx`
- `tests/journey-testing.cjs`
- `tests/browser-conversation-map.cjs`

## Verification

- `node tests/journey-testing.cjs` passed: real branching/jumps; unsupported and hidden inputs; invalid references; grading; exclusions; 0% versus unknown; all-high/no-rule/zero/mixed paths despite cap and reversed option order; deduplication; exact 256 finite coverage; hard cap; grouped notes; nonmutation/no fetch; saved-case serialization, wrong-quiz rejection, stale revisions, score/routing/deleted-answer changes and storage bounds.
- Focused ESLint passed for the changed TypeScript/TSX and browser test.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false` passed during integration.
- Isolated Playwright Chrome against `http://127.0.0.1:3162` passed at 1440×1000 and 390×844: guest templates; map navigation; exact edited question; bounded sampling; explicit fallback; scores; save/reopen/rerun/remove local cases; stale baseline visibility; per-quiz isolation; blank recovery; no horizontal overflow; unchanged scoring data; zero API mutations; zero browser errors.
- Screenshots inspected: `/tmp/pippi-conversation-testing-desktop.png`, `/tmp/pippi-conversation-testing-mobile.png`, `/tmp/pippi-regression-cases-desktop.png`, `/tmp/pippi-regression-cases-mobile.png`.
- Initial sandbox Chrome launch failed; the same isolated test was then run successfully with the permitted local-browser escalation. No authenticated user browser profile was used.
- Final browser test passed again after storage bounds and the compact mobile header were added.
- Screenshot copies retained in `../pippi-overnight-2026-10-12/journey-confidence/`.
- Read `docs/overnight-progress-2026-10-12.md` for continuity; parent owns the next wave and shared production build.
- Parent owns production build, combined integration checks and any deployment decision.

## Honest limits / next steps

Representative heuristics favor point extremes but are **not guaranteed minimum/maximum final scores** across branching, exclusions, multi-category scoring or conditional thresholds. They do not prove every band boundary has been tested. Unsupported input paths require manual checks. Local regression cases establish change detection against an author-reviewed baseline, not independent proof that its original result was correct. Clearing browser storage removes cases; team sharing/export and explicit manual case authoring remain future work. No production data, customer email, CRM, payment, or external tracking path was exercised.
