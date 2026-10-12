# Visual brand-kit management — batch 5

Implemented locally on 12 October 2026. No production, provider, email or credential changes.

## Creator experience

The existing reusable-kit picker in Theme now supports **Rename selected kit** and **Delete selected kit**. Both use a clearly named review panel inside the existing Theme dialog. Rename edits only the saved kit's name, even when the creator has a different unsaved theme preview. Delete explains that it removes the reusable kit while the current preview, saved quizzes and published quizzes retain their designs.

The selected kit's identity and revision are frozen during review, and selection is disabled so the action cannot silently target another kit. Escape cancels the inline review without closing Theme; cancellation returns focus to the triggering control and keeps the typed name. Successful deletion focuses the kit selector. Duplicate kit names receive an ID qualifier in the selector.

Initial loading, empty library, signed-out, saving/renaming/deleting, stale revision and transient failure states are distinct. A failed listing offers Refresh kits. A stale mutation disables confirmation until refresh and a new review. Refresh preserves the current preview and typed name. A transient mutation failure keeps the reviewed target available for explicit retry. A synchronous pending guard prevents duplicate submissions from rapid clicks.

Save as new, update confirmation, preview-copy and Apply theme retain their existing behavior. Kit updates never automatically change a quiz.

## API and concurrency

- Existing GET/list hide deleted records.
- Existing PUT still replaces a saved kit's design/name with a required revision.
- PATCH accepts only a name and revision; it does not accept a theme.
- DELETE requires a revision. It is idempotent for retries of the exact revision deleted.
- Every mutation checks owner and origin. Invalid IDs/foreign ownership do not reveal kit details. Stale writes return409 with a kit-specific refresh message.

Deletion atomically replaces the record payload with a minimal deletedAt tombstone using the existing adapter's expected-version write. The tombstone discards the saved name/theme, retains the record version, does not count toward the50-kit allowance, and prevents a concurrent stale PUT/PATCH from recreating deleted settings. It introduces no migration and does not change shared record-adapter behavior. Ordinary deletion cannot restore that kit; quiz theme copies are independent.

The existing50-kit check is a **best-effort create guard**, not a strict cap. Known open concurrency issue: with49 active kits, two simultaneous POST requests can both pass the count check and leave51 kits. A distributed quota protocol is outside this batch. The sequential regression verifies that deleting a kit frees one place under this guard; it does not establish a concurrent cap. Durable deletion tombstones remain until a deliberate account-erasure policy handles them.

## Owned files

- components/VisualBrandKitPicker.tsx
- lib/visual-brand-kits.ts
- app/api/visual-brand-kits/route.ts
- app/api/visual-brand-kits/[id]/route.ts
- tests/visual-brand-kit-management.cjs
- tests/browser-visual-brand-kit-management.cjs

ThemeEditor integration, shared schemas and quiz/player/storage files were not changed.

## Verification

Passed before the shared build:

- Seven checks in node tests/visual-brand-kit-management.cjs using an isolated filesystem and actual route/record code: auth/owner/origin and strict input boundaries; name-only rename; stale writes; concurrent rename; five concurrent deletes and exact retry; deterministic in-flight update/delete race; unchanged draft/published theme copies; deletion frees the active-kit quota.
- Existing node tests/visual-brand-kits.cjs passed.
- Scoped ESLint: zero errors or warnings.
- Browser test syntax check passed.
- Read repository instructions and installed Next client/route-handler documentation.

Compiled browser verification **passed in Chromium, Firefox and WebKit**, run serially against the parent's batch5 compiled app. The suite supports BROWSER=chromium, firefox or webkit (default Chrome channel) and uses only an isolated local server:

```sh
TEST_BASE_URL=http://127.0.0.1:3163 node tests/browser-visual-brand-kit-management.cjs
BROWSER=firefox TEST_BASE_URL=http://127.0.0.1:3163 node tests/browser-visual-brand-kit-management.cjs
BROWSER=webkit TEST_BASE_URL=http://127.0.0.1:3163 node tests/browser-visual-brand-kit-management.cjs
```

The suite covers mocked listing failure/empty-state recovery; actual kit creation; rename/cancel/keyboard focus; stale deletion and fresh target review; transient deletion failure/retry;390px layout; and unchanged current preview, saved quiz and published theme. It uses no public quiz starts, messages or providers. Screenshots/logs belong in the batch5 verification folder via ARTIFACT_DIR.

The existing tests/browser-visual-brand-kits.cjs also **passed** against that compiled app: auth/ownership/origin/validation; save/reuse/cancel/update/conflict; independent quiz theme; published logo/fonts; mobile width.

Evidence is preserved under ../pippi-overnight-2026-10-12/compiled-verification-batch-5:

- browser-brand-management-chromium-final.log, browser-brand-management-firefox.log and browser-brand-management-webkit.log.
- brand-management/chromium-final, brand-management/firefox and brand-management/webkit contain mobile review/deletion screenshots.
- browser-visual-brand-kits.log and brand-regression contain the unchanged-flow regression evidence.

The first browser attempt failed before application interaction because the synthetic cover fixture omitted its required buttonText. That test-only fixture was corrected and the original failure retained; no application repair was needed. The mobile review screenshot was visually inspected: confirmation identifies the kit, wraps within the narrow dialog, and preserves the existing Theme footer and controls. No shared build/restart or production changes were performed by this lane.
