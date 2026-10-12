# Respondent, scoring, and embed quality pass — 12 October 2026

## Scope and environment

This pass used the root-owned compiled app at `http://127.0.0.1:3172`, local authentication, and the explicitly isolated record directory `/private/tmp/pippi-overall-qa-20261012/player-data`. All Supabase aliases were empty. Browser network guards blocked external resources and AI/provider mutations. The tests created only uniquely named synthetic quizzes and removed their own forms, published copies, attempts, submissions, landing visits, and exact local retirement receipts. No real email, AI, payment, cloud record, deployment, or production action occurred.

Evidence lives in `../pippi-overall-qa-2026-10-12/player/`. This is local compiled acceptance, not evidence of hosted configuration or human usability.

## Confirmed defect and repair

The expanded answer key used hardcoded emerald text on dark quiz cards. The same readable-light-theme color measured only **2.28:1** contrast on the tested dark card, below the 4.5:1 requirement for this text. The automated finding appeared in desktop, mobile, and preview results; screenshots confirmed the visible problem.

`components/QuizPlayer.tsx` now lets the `Answer:` text inherit the configured quiz text color and gives it medium weight. The answer label and values, scoring, visibility, and persistence are unchanged. This was the only application change in this lane.

The parent's combined production build was verified at the same isolated port 3172. Final acceptance **passed all five workflow groups and all ten accessibility scans**, with zero violations and zero browser errors. Evidence: `journey-final-2.log`, `journey-final-2/results.json`, `journey-final-2/accessibility.json`, and ten state screenshots. Exact cleanup removed both quizzes plus 20 owned descendant/retirement records. The corrected mobile answer-key screenshot was visually inspected and its answer text is clearly legible. The preserved original contrast failure remains in `journey-before-2/accessibility.json`, with screenshots and successful workflow groups in that directory.

## Acceptance completed

- Six existing unit suites passed: `scoring-diagnostics.cjs`, `scorecard-results.cjs`, `journey-testing.cjs`, `embed.cjs`, `popup-embed.cjs`, and `publication-pause.cjs` (nine publication checks). Logs are under `units/`.
- New `browser-player-quality.cjs` completed all five literal workflow groups at 1440px and 390px. It deliberately does not calculate its expected scores with the evaluator being tested. Changing a previously answered branch removed its hidden answer from review, grading, and stored responses; the reachable denominator was 30, not 40. The result was 30/30, and result reload retained it. Required email validation worked; optional marketing consent began unchecked and stayed false.
- An owner preview completion with contact input created no retained submission, lead, or public analytics start/completion. Before and after metrics stayed exactly two starts, two completions, and two leads.
- An already-started public attempt retained its original 30-point snapshot through a later 110-point publication and publication pause. Pause denied new anonymous starts and anonymous preview. The held attempt still graded 30/30; a fresh attempt after republishing graded 110/110.
- Literal scorecard answer weights produced 25 and 75. One mapped answer plus an unmapped “Not sure” answer remained insufficient (`null`) with one answered category question, rather than silently becoming zero. Band titles matched the literal thresholds.
- Ten scoped WCAG A/AA scans ran over questions, captures, ordinary results, preview states, and scorecard results. Seven passed on the pre-fix build; the only rule in the three failing states was the answer-key contrast defect above. There were zero browser page errors and no blocked provider attempts.
- `browser-responsive-embed.cjs` passed on desktop and mobile with a genuine second-origin host. It exercised two-frame isolation, initial and changing intrinsic heights, long landing-page CTA to short question visibility, passive-resize scroll stability, active-frame reveal, late images, FAQ expansion/contraction, malformed messages, fixed fallback, capture, score rendering, attribution, and ordinary player viewport behavior. Log: `responsive.log`; screenshots: `responsive/`.
- `browser-popup-embed.cjs` passed all twelve groups across Chrome, Firefox, and WebKit. It exercised desktop/mobile lazy dialog creation, duplicate-trigger state, different-quiz isolation, inner keyboard scrolling, Escape from player/capture, focus/host-scroll restoration, and malformed messages. A 320×320 long-title state retained Close, direct fallback, and a usable quiz area. Script, stylesheet, native-dialog, and JavaScript fallback cases kept the normal link; an unavailable iframe kept Close and fallback. Log: `popup.log`; structured results/screenshots: `popup/`.

Visually inspected the dark mobile result, responsive mobile result, WebKit popup mobile result, and 320×320 long-title popup. Content fitted the intended viewport; long popup content remained scrollable and the close/fallback controls stayed available. The dark answer text defect was clearly visible in the before image.

## Test changes

- New `tests/browser-player-quality.cjs`: independent literal workflow, access, preview, theme, and accessibility acceptance; unique fixture cleanup; no external requests. Before axe it awaits actual finite player animations, then asserts the settled theme background, accent text, question-card background and opacity. It does not disable animations or relax accessibility rules.
- New `tests/player-local-fixtures.cjs`: shared exact-ID local cleanup for the two embed suites. It verifies local ownership and derives the precise retirement receipt key; it never removes a collection broadly.
- `tests/browser-responsive-embed.cjs`: portable `ARTIFACT_DIR`, explicit isolated-data requirement, external-network guard, and complete scoped cleanup. Product assertions were retained.
- `tests/browser-popup-embed.cjs`: complete scoped cleanup through the same helper; existing assertions and network guards retained.

The first attempt at the new suite encountered a harness-only ambiguous alert locator because Next's route announcer also has an alert role. The selector was narrowed to the player and exact validation text. Evidence remains in `journey-before/` and `journey-before.log`; the subsequent complete run remains separately preserved in `journey-before-2/`.

Targeted QuizPlayer ESLint passed with zero errors and four existing warnings. No source change was made to those unrelated warnings. No shared build was run by this lane.

## Final verification and limits

The first combined-build attempt (`journey-final/`, log `journey-final.log`) caught one question midway through its 160 ms entrance fade and reported transient composited contrast of 4.44:1. The screenshot after animation showed the configured colors. This was a measurement timing issue, not a new permanent color defect. With the explicit finite-animation completion barrier and settled-color assertions, `journey-final-2/` passed all five workflow groups, ten scans with zero violations, zero page errors, and exact fixture cleanup. Both attempts and the original before-fix artifacts remain preserved. The test explicitly requires a localhost base URL and isolated local data with all five Supabase aliases empty.

The root owns `browser-error-recovery.cjs`; this lane did not run or modify it because its original fixture-directory assumption required repair. No unproven error-recovery or corrupted browser-storage coverage is claimed here.

The scorecard fixture does not exercise nonempty product recommendation reasons. A read-only observation about hardcoded `text-slate-700` in `MarketingResultCard` was sent to the report lane for a dark-theme check; it is not counted as a confirmed defect by this pass. Browser engines are automated desktop builds, including WebKit at a mobile-sized viewport, not physical iOS/Android devices. Hosted auth, email delivery, third-party page CSS, and human comprehension remain separate acceptance gates.
