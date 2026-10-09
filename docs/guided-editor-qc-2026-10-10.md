# Guided quiz editor — 2026-10-10

New guest drafts and unpublished marketing quizzes open in five steps: Your quiz, Questions, Results, Design, Publish. Existing published quizzes retain the full editor by default. The chosen editor mode persists per quiz in browser storage. Both modes share the same form state, autosave, draft recovery, theme dialog, and publication validation.

Guided editing covers title/cover copy, one question at a time, answer wording and existing per-answer rule weights, result copy and destinations, scorecard results, theme customization, and basic capture/privacy configuration. Rule targets and IDs remain unchanged. Editing answer wording clears old rule explanations to prevent stale claims. Adding fields, branching, new rule mappings, tracking, integrations and analytics remain in the full editor.

The publish step has linked guidance for missing titles/questions/scoring/destinations/privacy and calls the existing confirmation dialog. Its checklist is not a replacement for full validation or testing all branches. Authenticated preview saves before opening the preview; guest preview uses the existing account/save flow.

Validation: TypeScript and production build. Playwright at 390px verifies title/cover synchronization, question and point editing, switching modes without losing edits, result link and privacy updates, theme dialog, saved reload, mode persistence, overflow, and publish confirmation handoff. Unit suites cover existing scoring/result sections and 768 template product paths. This is a usability improvement, not evidence that unfamiliar human users can complete the flow without help. Five uncoached usability sessions remain the next validation step.
