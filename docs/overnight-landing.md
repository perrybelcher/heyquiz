# Landing composer — 12 October 2026

## What changed

Pippi now has a focused landing-page composer in both guided setup and the full editor. Creators can keep a short introduction, choose a compact cover or an image beside the promise, and add up to eight structured sections. The public page and in-editor design preview share the same renderer.

The six section choices are a benefit list, helpful context, testimonial, FAQ, introduction video, and another Start button. Sections have stable IDs, reorder controls, and removal review when they contain copy. Benefit lists have up to six items. Content remains structured plain text; the composer accepts no arbitrary HTML, CSS or iframe code.

Guided Results also exposes the result-layout selector produced by the results workstream. That integration changes `marketing.presentation` without duplicating result-rendering or scoring logic.

## Behavioral details

- All opening and repeated Start buttons call the supplied player `onStart` callback. The root integration adds a synchronous in-flight guard and preserves the existing attempt, capture and tracking path.
- Resume remains available without creating another attempt. Repeated controls show “Start over” when a resumable response exists.
- Required contact capture is disclosed before starting.
- Disabling a custom cover retains its draft configuration while hiding its custom title, media, sections and time estimate. The basic start screen then uses the quiz title and description.
- The question-count flag is honored. Display-only fields do not inflate the count.
- Split covers respond to their container width, including the editor's phone preview. They stack without an image or below 700 pixels of available width.
- Videos use the existing YouTube/Vimeo allowlist and load only after selection. A design preview Start action creates no response.
- New landing fields are optional, so existing quizzes require no migration. The full existing launch-template library passes schema and landing-publication checks.

## Safety and publication

`lib/landing.ts` defines bounded section data and publication validation. `CoverPageConfigSchema` rejects duplicate section IDs, unsafe cover URLs, oversized lists and excessive sections. Incomplete section copy is valid in an editable draft but blocks publication when the custom cover is enabled. Unsupported video providers cannot publish. `publishForm` runs this check before writing its published snapshot.

Saving new draft content does not change the live landing page. Later publication explicitly replaces the snapshot. Hidden custom content is preserved when the cover is disabled.

## Changed files

- New `lib/landing.ts`
- New `components/QuizLanding.tsx`
- New `components/LandingPageEditor.tsx`
- Cover-only extension in `lib/schema.ts` (existing theme changes preserved)
- Landing import/publication check in `lib/storage.ts`
- Landing integrations in `components/GuidedQuizEditor.tsx` and `components/EditorStudio.tsx`
- Guided integration of the existing new `ResultLayoutEditor`
- New `tests/landing.cjs` and `tests/browser-landing.cjs`

The parent owns the `QuizPlayer.tsx` renderer integration and duplicate-start guard.

## Validation

- `node tests/landing.cjs`: **9 scenarios passed**. Covers all existing catalog/launch constructors, absent and disabled covers, question-count semantics, section rendering and escaping, draft/publication separation, unsafe media, duplicate IDs, size limits and legacy cover values.
- `node tests/browser-landing.cjs`: passed local Chromium checks for composition, stable IDs, reorder, cancel/confirm removal, save/reload, guided result-layout persistence, draft/public snapshot isolation, server publication rejection, desktop/mobile layout and overflow, FAQ keyboard operation, click-to-load video, inert editor preview, simultaneous Start controls producing one request, resume producing no second start, required capture, and disabled/compact cover behavior.
- The capture test stops at the email field; no contact is submitted and no email is sent. Video-provider requests are fulfilled by a local test fixture. No AI request is made.
- Targeted ESLint: no errors, one standard `<img>` warning for the creator-supplied cover image.
- Shared production build belongs to the parent workstream.

Browser evidence is saved under `outputs/pippi-overnight-2026-10-12/landing/` in the enclosing `gr` workspace. The synthetic quiz is removed after each browser run.

## Deliberate limits

This is a quiz landing composer, with one landing page per quiz and six purposeful section types. It does not add a general website builder, custom HTML, automatic proof claims, generated testimonials, custom domains or a second analytics pipeline. Existing visitor instrumentation belongs to the analytics workstream. Full quiz/playback testing still uses Save & preview; the inline landing preview tests presentation only.
