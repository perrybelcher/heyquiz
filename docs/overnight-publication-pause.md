# Reversible publication pause — 2026-10-12

## Implemented

Owners can choose **Pause publication** from the full editor toolbar/Share panel or the guided builder's Publish step. A native modal explains the effect and offers **Keep published** or **Pause publication**. Escape and cancellation close it without sending a publication mutation. Publish and pause operations share an in-flight guard. Success updates the publication status, removes public share/embed controls, and announces the change. Publishing again restores the same public URL.

The confirmation explains the policy: new direct/embed starts close; valid sessions already in progress can finish their frozen attempt. Drafts, responses and private result reports remain available. Experiments stop admitting new assignments/starts while either variant is unpublished; publishing both again re-enables their existing frozen variants.

`DELETE /api/forms/[id]/publish` checks origin and signed-in ownership, removes only the `published` record, and returns an explicit no-store response. Repeating the operation is safe, including concurrent local removal races. It never calls `deleteForm` or writes report-retirement tombstones. The unavailable public page is generic, mentions pause/unpublished possibilities without exposing a draft, and specifies a dark foreground on its white card even in dark color scheme.

The Share panel now mounts the embed agent's `QuizEmbedCode({formId, title})` while published instead of the old fixed iframe snippet. Existing direct-link clipboard handling now awaits success; rejected/unavailable clipboard access displays a manual-copy message and selects the labelled public-URL field, with no false Copied indicator.

## Checks completed

- `node tests/publication-pause.cjs`: **9 passed** using in-memory records and synthetic identity with the real route/storage/report/tombstone functions. Covers auth/origin/foreign owner, publication-only deletion, retained records and absent tombstone, existing attempt/report access, repeat/concurrent pause, experiment pause/resume, restored URL, missing quiz.
- `node tests/experiment-lifecycle.cjs`: **11 passed**, retaining the prior permanent-deletion/recreation safeguards separately from pause.
- TypeScript `--noEmit --incremental false`: passed.
- Scoped ESLint: zero errors; the existing EditorStudio unused-import/navigation/image warnings remain.

## Browser verification

`tests/browser-publication-pause.cjs` creates unique synthetic quizzes, an experiment, a foreign-owner fixture and attempts/reports in the isolated local data directory, then cleans up its own records. It covers both editor flows, cancellation and Escape, public/share state, anonymous/foreign owner/origin rejection, owner preview, direct/embed/new-start closure, in-flight completion, report retention/creation, experiment pause/resume, repeat/concurrent pause, restored URL, clipboard rejection, dark-scheme unavailable page and a mobile confirmation screenshot.

Two development runs were interrupted at Share by repeated full-page reloads and are not counted as passing. The compiled run at port 3163 then **passed the complete suite**. A brittle RGB/OKLCH color-string assertion was changed to rendered sRGB contrast >=7 because compiled Chromium returned the equivalent dark color in CSS Lab notation. A shared localhost rate-limit collision required waiting for the preceding tests to finish; rate-limit code was not changed. Reproduction command:

```sh
HEYQUIZ_DATA_DIR=/Users/perry/Documents/Codex/2026-10-06/gr/outputs/pippi-overnight-2026-10-12/test-data TEST_BASE_URL=http://127.0.0.1:3163 node tests/browser-publication-pause.cjs
```

The directory must match the running isolated server. Chrome runs headless. The mobile confirmation screenshot was captured and inspected at `../pippi-overnight-2026-10-12/publication-pause/pause-confirmation-mobile.png`. Successful compiled log: `../pippi-overnight-2026-10-12/compiled-verification-batch-3/publication-pause-contrast-retry.log`. No application-source change or rebuild was required for this test correction.

## Scope

No player, quiz-page resolver, deployment or server configuration edits. No production calls, real emails, CRM or payment changes. Pause does not terminate an existing attempt or revoke saved reports. It differs intentionally from deleting a quiz, which still permanently retires previous result links and experiments.

Files: `lib/storage.ts`, `app/api/forms/[id]/publish/route.ts`, `components/EditorStudio.tsx`, `components/GuidedQuizEditor.tsx`, `app/play/[id]/not-found.tsx`, `tests/publication-pause.cjs`, `tests/browser-publication-pause.cjs`. The embed component belongs to the parallel embed work.
