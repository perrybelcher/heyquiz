# Mobile editor navigation — 12 October 2026

## Change

The full editor and guided setup now share a compact mobile header. Quiz name and save/publication status occupy the first row; Theme, Preview, Publish and (when published) Pause stay visible in the second row. All workspace tabs or setup steps remain in a horizontal strip with an overflow fade and automatic reveal of the selected tab. The header measures **134px at a 390px viewport** in Chromium, Firefox and WebKit, below the 140px target.

A labeled More button opens a native modal containing secondary tools. Full-editor tools include fields, question/form settings, conversation map, guided setup, draft history, manual save, schema JSON and dashboard navigation. Scoring mode and canvas preview size remain available there. Guided mode includes full-editor access, history, manual save and the conversation map.

The native dialog provides an inert background, with explicit Tab/Shift+Tab wrapping to keep focus inside its controls across browsers. Escape, its close button and an outside click dismiss it and return focus to More. Commands close the dialog synchronously before opening history/other tools. A resize to desktop closes it and moves focus to a visible desktop control. Mobile controls unmount on desktop so hidden duplicate inputs cannot intercept editing or accessibility queries. Pause captures its actual triggering button, including WebKit pointer clicks, and restores focus after its native modal has unmounted.

Existing save, guest/authentication, draft history, preview, publish and pause handlers are reused. Save failures remain actionable in the short status and the existing full error banner. Desktop controls retain their layout, now with a labeled quiz-name input and darker save-status/inactive-tab text for contrast.

## Files

- `components/EditorMobileHeader.tsx` — shared mobile navigation and modal behavior.
- `components/EditorStudio.tsx` — full-editor wiring, accessible desktop title/status and visible publish focus target.
- `components/GuidedQuizEditor.tsx` — guided mobile navigation with existing step/actions preserved.
- `tests/browser-mobile-navigation.cjs` — synthetic local browser regression.
- `tests/browser-guided-editor.cjs` — configurable local server and mobile More-menu mode switching.

## Verification

Completed before the shared build:

- Read repository AGENTS instructions and the installed Next `use client` documentation.
- `node --check tests/browser-mobile-navigation.cjs` — passed.
- `node --check tests/browser-guided-editor.cjs` — passed.
- Targeted ESLint on the three changed components — no errors. Existing EditorStudio warnings remain for unused imports, its existing image and window navigation; the mobile dashboard command reuses the same save-before-navigation behavior.

Compiled browser verification completed against the isolated app:

- `browser-mobile-navigation.cjs` — **passed in Chromium, Firefox and WebKit**, serialized against the final focus-fix build. All three measured a 134px header.
- `browser-guided-editor.cjs` — passed on the batch-4 compiled build: mobile editing, per-answer scoring, shared draft, theme, saved recovery, mode preference and publish checklist.
- `browser-guided-creation.cjs` — passed on the batch-4 compiled build: reviewed deletion, guarded reordering, stable scoring and recovery, AI-goal navigation, and blank/template access.

The initial strict runs caught fractional-width tab clipping and two focus issues (native More Shift+Tab escaping to browser chrome, and Pause cancellation trying to focus while the background remained inert). All were fixed before the final three-engine strict pass. A diagnostic run temporarily skipped the known assertions in memory to discover remaining issues; its log is labeled diagnostic and is not counted as a verification pass. Test waits now await the resize/focus effects rather than asserting in the same frame as a viewport change.

Run against an isolated compiled app:

```sh
TEST_BASE_URL=http://127.0.0.1:3163 node tests/browser-mobile-navigation.cjs
BROWSER=firefox TEST_BASE_URL=http://127.0.0.1:3163 node tests/browser-mobile-navigation.cjs
BROWSER=webkit TEST_BASE_URL=http://127.0.0.1:3163 node tests/browser-mobile-navigation.cjs
TEST_BASE_URL=http://127.0.0.1:3163 node tests/browser-guided-editor.cjs
BASE_URL=http://127.0.0.1:3163 node tests/browser-guided-creation.cjs
```

The new suite covers 390px header height and page overflow; all tabs/tools; active-tab reveal; keyboard, Escape, outside dismissal and focus return; history handoff; fields/settings; theme access; saved preview; publish/pause cancellation; guided mode; a stubbed unauthorized-save failure and retry; resize to desktop and desktop keyboard access. It creates and cleans one synthetic local quiz. It never starts a public response, sends email or calls providers.

Evidence is preserved under `../pippi-overnight-2026-10-12/compiled-verification-batch-4`: separate `browser-mobile-navigation-{chromium,firefox,webkit}.log` files and corresponding `mobile-navigation-{engine}` screenshot folders; guided regression logs/screenshots; original failures and diagnostic-only runs retained. Chromium mobile Contacts, More and guided screenshots were visually inspected: the primary actions and status remain legible, the menu fits the viewport, and the page has no horizontal overflow.

Root owns the combined build, editor accessibility scan and wider draft/publication regressions. No production deployment or live account changes are part of this batch.
