# Guided creation improvements — 12 October 2026

## Result

Marketing quiz authors can now do the common question work inside the guided builder. They do not have to leave the guided flow to add a choice question, arrange its answers, or connect an answer to a result. The workspace AI entry now asks what the quiz should accomplish before choosing the creation flow.

## Implemented

- Add single-choice or multiple-select questions, with stable generated question/answer IDs and no invented scoring rules.
- Add, remove and move answers for supported choice fields. Fixed-shape controls such as switches retain their advanced settings in the full editor.
- Move questions within a page. Moves that would reverse a branch or cross pages are rejected with an explanation; rules are never discarded to make a reorder succeed.
- Rename answers while preserving their ID. Unambiguous legacy exact-label branch conditions become ID-based before renaming. Stale marketing explanations are cleared. Authors are reminded to review substring-based branching.
- Review deletion in a native confirmation dialog. It explains affected scoring and branch rules before removal. Cancel leaves the draft untouched.
- Question deletion removes dependent scoring, branching, page membership and selected tracking references. If the deleted question was the only explicitly selected tracking step, question-view tracking is disabled rather than silently switching to every step.
- Calculation dependencies block deletion until the formula is revised in the full editor. The editor does not quietly replace a calculation input with zero.
- Edit answer-to-result/category mappings through the existing AnswerScoring component in an expandable “Connect answers to results” panel. Existing quick point controls remain visible.
- Set required answers and mark correct answers for supported knowledge-quiz choice fields.
- AI goal chooser separates business-aware marketing creation (product finding, segmentation, scorecards) from knowledge tests. Marketing routes to `/create/marketing`; knowledge tests retain the existing API. Blank and template routes remain available.
- Mobile creation controls wrap vertically; the AI dialog supports Escape, focus restoration and keyboard focus containment.

## Files

- `components/GuidedQuizEditor.tsx`
- `components/Dashboard.tsx`
- `components/WorkspaceWelcome.tsx`
- `lib/guided-editing.ts`
- `tests/guided-editing.cjs`
- `tests/browser-guided-creation.cjs`

## Validation

- `node tests/guided-editing.cjs`: nine behavior scenarios covering score/ID preservation, page-aware insertion, dependency cleanup, minimum answer count, calculation blocking, duplicate tracking references, backward branching, label renaming, and the 200-question limit.
- `node tests/browser-guided-creation.cjs`: local Chromium, 390 × 844. Covers guarded reorder, cancel/accept deletion with explicit dependency review, add/move choices, direct answer mapping, save/reload persistence, correct movement limits, no horizontal overflow, AI goal routing, keyboard Escape, and retained blank/template access. Uses synthetic local fixtures and deletes its quiz afterward. Does not call an AI provider or send email.
- `node tests/browser-guided-editor.cjs`: passed the existing mobile guided editing, per-answer scoring, shared draft, theme dialog, saved recovery, mode preference and publish-checklist regression. An earlier run during shared development timed out after save; the unchanged test passed on rerun after edits settled.
- Targeted ESLint: no errors. Four existing Dashboard warnings remain (three internal `window.location.assign` calls and one logo image).
- Parent performs the shared production build and broader regression checks.

Saved browser evidence: `outputs/pippi-overnight-2026-10-12/guided-creation/guided-editing-mobile.png` and `ai-goal-chooser-mobile.png` (relative to the enclosing `gr` workspace).

## Boundaries

- Advanced question types, page reassignment, branch authoring, calculation editing and complex result layouts remain in the full editor.
- Answer removal keeps at least two choices. New answers are deliberately neutral until the author assigns rules.
- Removing a scorecard question may change percentages or minimum-answer coverage; the deletion review calls this out instead of silently changing the author's thresholds.
- Reused AnswerScoring is unchanged. Its existing target and schema rule limits still apply.
- This work does not change API schemas, publish anything, connect external systems, or test production authentication/email.
