# Basic builder design 1 integration

Base: `ee1299c` (preserves existing mode/navigation edits); prior deployed revision `b5a4628`.
Reference: `exec-511a1102-0382-48b4-a8d6-492be03470d8.png`.

## Ownership
- Lead: GuidedQuizEditor controller, EditorStudio state/persistence wiring, Next build configuration, integration tests and QA.
- A (`/tmp/pippi-basic-layout`): BasicBuilderShell, scoped CSS, EditorModeSwitch.
- B (`/tmp/pippi-basic-fields`): BasicQuestionEditor, BasicResultsEditor, narrow editing adapters/tests; existing result components only by explicit handoff.
- C (`/tmp/pippi-basic-preview`): BasicVisitorPreview, BasicQuizSettings, BasicDesignSettings, BasicPublishSettings and focused tests.

Workers start from the same commit, commit only owned files, and integrate sequentially. No evaluator/schema/API changes.

## Contracts
- Controller owns active step, result-review acknowledgement, selected question/result IDs and checklist focus. EditorStudio retains this UI state across Basic/Advanced; form state remains its existing state.
- Shell receives title/status/action callbacks, ordered steps, questions and selected ID, content/preview/footer slots. No draft mutation from selection/search/preview.
- Question and result controls receive form/onChange and stable IDs; reuse reference-safe operations. Field-ref callbacks retain checklist targeting.
- Other steps receive existing controller callbacks. Preview receives form/step/questionId/resultId and uses ephemeral local values only.
- Desktop >=1200 three columns; tablet >=768 two columns plus preview panel; mobile accessible question/preview drawers. 320px and zoom supported.

## Field acceptance
Results: names, explanations, advice, CTAs, minimum points, ties/fallback; qualification conditions; scorecard categories/coverage/bands; knowledge tiers/ranges.
Questions: wording/help/required, supported type settings, ordered answers, knowledge points/keys/explanations, multiple associations with points/reasons/exclusions; blank differs from zero.
Your quiz: title/intro/welcome/media/button/presentation/progress/feedback/review.
Design: existing theme and brand controls, distinct PDF/report settings.
Publish: capture/consent/privacy, existing checklist and publication actions.

## Baseline
Guided editing: 11 scenarios passed. Guided checklist: 10 groups passed. Additional standard suites recorded in `/tmp/basic-*-baseline.log`.
Local webpack lacked the Tailwind loader configured only for Turbopack; verify a corrected compiled stylesheet before visual acceptance.
