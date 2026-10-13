# Builder adoption and help center — 13 October 2026

## Implemented locally

- Explicit `settings.presentation` preserves existing one-question behavior unless the creator selects “Fields together by page.” The player groups the resolved question path by contiguous page, respecting branching and hidden fields. Every visible field on a page is validated before advancing. Back and answer review use page navigation. Grouped immediate grading is deferred to the end. Per-field progress writes are serialized to avoid update conflicts.
- Editor control above page tabs explains grouping, contact fields and the existing Page assignment setting. Existing schema validation retains the presentation setting on save.
- Skippable/replayable first-quiz walkthrough with five steps, contextual explanations, target highlights, actions opening actual controls and per-step help links. Essential workflow first; advanced marketing is introduced as optional. This is a guided tour, not automatic quiz completion.
- Original `/help` portal: searchable 18-article guide, eight categories, first-quiz path, article pages and related links. Mobile layout, metadata and sitemap entries. Entry points in creation and editor.
- Multi-turn guide-grounded AI assistant at `/api/support/chat` using the existing server-side Gemini configuration. Signed-in users only; public guides remain available to guests. Source slugs are validated against retrieved guides and returned as internal links. Plain-text rendering, bounded history, per-process throttling, origin checks, timeout and guide fallback. No account tools, credentials, customer context, emails, ticket creation or provider changes. Model outputs remain fallible despite source validation.
- Integration setup explanation distinguishes authorization from confirmed lead delivery; no CRM provider behavior changed.

## Verification

- Configured Turbopack production build and TypeScript pass. A webpack fallback initially omitted Tailwind styling; discarded as visual evidence. Correctly styled Turbopack build verified afterward.
- `tests/browser-help-pages.cjs`: real local Chromium, synthetic records. Help search/article/mobile layout; AI guest gate; authenticated no-key guide fallback; cross-origin rejection; grouped name/name/email page, required validation, Back, review, submitted saved answers; editor presentation setting and walkthrough replay.
- `tests/browser-player-quality.cjs`: five existing literal respondent workflows and ten accessibility scans passed on the styled build.
- `tests/player-pages.cjs`: legacy grouping, page grouping, branch exclusion, missing page IDs and empty paths.
- `tests/support-chat.cjs`: mocked provider validates cited response, invented-source rejection, malformed-model fallback and auth gate. No real AI request or API spending.
- Existing regression suite and six Clarity privacy groups pass. Scoped new-code lint and diff whitespace checks pass.
- Browser fixture initially used an unsupported field type and two ambiguous selectors; corrected fixture and selectors before passing acceptance.
- Screenshots: `outputs/pippi-help-2026-10-13` in the parent workspace.

## Limits and release

Local changes only; not pushed or deployed. Local preview uses isolated `/tmp/pippi-help-qa`, no cloud credentials or Gemini key. No emails or integration deliveries sent. Real Gemini responses, production auth, published cloud persistence and destination integration deliveries are not verified by these tests. Existing per-process rate limiting is not a distributed production quota; apply platform limits before high-volume use. Guides cover the core workflow, not every advanced setting. No human-support inbox or ticket backend has been invented. A real provider test and hosted smoke check remain release tasks.

Reference used for information architecture only: https://support.scoreapp.com/ (searchable categorized support). Text, layouts and implementation are original.
