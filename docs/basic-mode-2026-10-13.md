# Basic and Advanced modes — 13 October 2026

Basic builds on the existing guided editor rather than creating a second quiz format. New unpublished quizzes default to Basic; stored per-quiz mode choices and published-quiz Advanced defaults remain. Mode switches change UI state only.

Basic keeps five steps, title/description, five common question types, Cards/Form presentation and existing-page assignment, answer editing, optional scoring, simple result wording, five accent presets/custom color, contact capture, preview/save/publication. Complex landing composition, result layouts, PDF design and email copy remain in Advanced. Existing hidden settings remain active. Advanced branching is explicitly called out when present. Scorecard bands and scoring mode controls are collapsed.

Text/email additions have no automatic grading points. Guest text makes no unsupported promise that blank questions already have scoring. New creation page and help guidance explain the modes.

Verification: production build/TypeScript, scoped lint, nine guided-editing dependency/regression cases, new local Chromium Basic default/add-email/edit-result/color/mode-round-trip/mobile checks. All data synthetic. Hosted customer workflows are not certified by these tests.

Final mobile review removed duplicate status and moved the readiness checklist to Publish. Existing mobile guided creation acceptance passed, including guarded reorder/deletion, scoring preservation and saved recovery. Basic round-trip acceptance passed again on the final layout. No AI or external messages used.
