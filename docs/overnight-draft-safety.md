# Overnight draft protection and current previews

Implemented 12 October 2026. Local development only; no deployment, published quiz changes, real AI requests, mail or production data involved.

## Behavior

- The full editor's AI action is now **Suggest questions with AI**. Generating a response opens a review proposal without changing form state or triggering a replacement autosave. Creators inspect each question, answer choices, keys, points and explanations, choose suggestions, then explicitly accept or discard.
- Acceptance only appends the chosen questions. Existing title, mode, questions, pages, marketing rules/results, category mappings, branching, branding, cover, contact capture, ending, tracking and live publication state remain intact. New question IDs cannot collide. When the draft has pages, additions receive their own final page.
- Marketing creators are told that new answers need scoring/outcome connections and that existing branches may skip appended questions. Knowledge-quiz creators are told to check the changed point total and result thresholds. The reviewed AI questions do not import an AI-generated title, theme, cover, result logic or publishing settings.
- A browser-confirmed checkpoint is required before accepting AI questions, importing JSON or restoring a checkpoint. Quota/storage errors leave the draft unchanged and show an error inside the relevant dialog.
- **Draft history** in the full editor retains the latest five checkpoints for this quiz on this device. History survives reload; restore requires a review/confirmation and first checkpoints the current draft so the restore is itself reversible. Restoring retains the editor's current revision identity and does not change the published version. JSON import can no longer change the current quiz ID.
- All five private-preview entry points (toolbar, Results/Test Quiz, Results/empty state, Share/Preview privately, guided Save & preview) use one save-first handler. It opens a provisional tab during the click, drains current and in-flight edits through autosave, then loads the saved draft. A failed save closes the provisional tab and leaves the local backup/recovery controls available. Blocked popups produce actionable guidance. Guests receive sign-in/create-account links and do not get a broken preview tab.
- Preview/publish explicitly pass the rendered draft into autosave, avoiding reliance on the backup effect running before the action. Concurrent explicit actions share an in-flight failure instead of each retrying the same revision; waiters recheck the pending-save lock after every await. Existing server revision conflict protection stays in place.
- The new dialogs trap keyboard Tab within their controls, support Escape, and return focus to their triggers. Private preview copy no longer invites people to “submit a test response” into the real response table.

## Files

- `components/EditorStudio.tsx`: AI review, selective add, history and restoration UI, JSON identity/checkpoint protection, shared preview handler, keyboard behavior.
- `hooks/useAutosave.ts`: optional explicit draft snapshot for save-first actions.
- `lib/draft-history.ts`: bounded validated browser checkpoints, safe additive proposal application, revision-preserving restoration.
- `tests/draft-history.cjs`: pure-function regressions.
- `tests/browser-draft-safety.cjs`: isolated synthetic Playwright coverage; refuses non-local base URLs.

## Validation completed

- `node tests/draft-history.cjs` — PASS. Covers preserved campaign settings, stable existing IDs/mappings, non-mutating append, page order, collision handling, 200-question cap, empty selection, per-quiz isolation, malformed history, five-record retention, current revision restoration, storage write failure and silent-write failure.
- `node tests/browser-draft-safety.cjs` — PASS against `http://127.0.0.1:3162`. Covers review/discard/selection, preserved settings after autosave, unique IDs, history surviving reload, reversible restoration, all five preview routes, edits arriving while a save is held, concurrent Preview plus two navigation actions sharing one failed PUT (no duplicate retries or navigation), save failure, backup retention, blocked checkpoint writes, guest account guidance and Escape/focus return. AI responses are mocked in the isolated browser; no provider call occurs.
- `TEST_BASE_URL=http://127.0.0.1:3162 node tests/browser-draft-protection.cjs` — PASS. Existing two-tab isolation, failed-save reload recovery, successful restore, stale revision rejection and unavailable-storage warning.
- `npx tsc --noEmit --incremental false` — PASS.
- Scoped ESLint (`components/EditorStudio.tsx`, `hooks/useAutosave.ts`, `lib/draft-history.ts`) — **0 errors**. The existing files retain 18 warnings (unused imports, raw images and existing location navigation); the new history module has none. Existing effect/purity errors were corrected: editor mode now reads external storage using `useSyncExternalStore`, navigation uses a monotonically increasing request ID, and the single necessary storage-success effect state update has a documented narrow lint exception because success cannot be derived before an external write.
- Screenshots inspected: `../pippi-overnight-2026-10-12/draft-safety/ai-question-review.png` and `persistent-draft-history.png`.
- One early Playwright run caught a checkpoint-error toast covering dialog buttons. The error was moved into the relevant dialog and the complete suite passed afterward.

## Boundaries

This is checkpoint history for risky edits, not a full undo timeline or account-wide version history. It stores draft definitions, not respondent records. It is device/browser-local, limited to five entries, and is removed by clearing browser storage. Draft history is accessed from the full editor. Real provider quality, remote persistence, production sessions and mobile browser variants were not tested in this task. Existing autosave can still refuse a stale revision; no conflict overwrite bypass was added. Shared production build is intentionally left to the parent task.
