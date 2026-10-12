# Responsive quiz embeds

Implemented 12 October 2026. No production changes, emails, provider calls or deployments.

## Behavior

Published Share now offers automatic-height HTML (iframe plus `/pippi-embed.js`) and a script-free 700px option. Both retain native iframe scrolling and a direct new-tab link. Blocking the script therefore leaves a usable fixed-height quiz. Embed markup escapes titles/URLs and does not inline executable user content.

Only `/play/:id?embed=1` enables the resize reporter and removes the player's viewport minimum. Ordinary direct player pages are unchanged. The reporter measures the player's intrinsic bounding box rather than document height, avoiding the iframe-height feedback that prevents shrinking. ResizeObserver, DOM changes, image loads, details toggles, fonts and window resizing trigger measurement. Notifications coalesce in a microtask, because browsers can suspend animation frames in offscreen cross-origin iframes while still delivering their handshake messages.

The parent loader accepts messages only from each registered iframe's actual contentWindow, its exact configured application origin, and its current per-frame channel. Heights must be finite bounded integers from 200 to 30,000px. Larger content remains scrollable inside the capped frame. Repeated snippets do not duplicate listeners, new/removed frames are detected, and reloads get a new channel. The child accepts initialization only from its actual parent and sends dimensions to that explicit origin. A readiness signal alone uses `*`; it contains only protocol type/version. Referrer is deliberately not treated as authorization because iframe reloads can change it to the frame's own URL.

An explicit quiz-step transition may include the new heading's top/bottom dimensions. The loader reveals it only if outside the host viewport and that iframe still has focus, so a bottom CTA on a long landing page cannot strand the visitor below the shorter first question. Moving focus to another quiz or host control prevents delayed result messages from stealing the host's scroll position. Ordinary image and FAQ resizes do not request scrolling. No answers, contact details, quiz content, tokens or tracking identifiers are messaged to the host.

## Files

- `lib/embed.ts`: protocol constants, validation and escaped code generation.
- `components/EmbedResizeReporter.tsx`: intrinsic measurement, handshake and optional heading coordinates.
- `public/pippi-embed.js`: dependency-free parent loader and per-frame validation.
- `components/QuizEmbedCode.tsx`: code modes, copy feedback, manual fallback and direct link.
- `components/QuizPlayer.tsx`, `app/play/[id]/page.tsx`: explicit embedded mode.
- `tests/embed.cjs`: pure code/protocol regressions.
- `tests/browser-responsive-embed.cjs`: isolated two-origin browser test.

The publication agent owns mounting the new component in the existing published-only Share UI.

## Validation and limits

Unit tests pass code escaping, fallback, height bounds, origin/source/channel rejection, independent frames, reload channels, duplicate scripts, detached cleanup, and bounded navigation coordinates. TypeScript and scoped lint passed before the final browser handoff; the parent owns the combined build.

The browser suite passes against the final compiled local app at port 3163: desktop/390px hosts, two frames, long landing shrink, FAQ expansion, iframe reload, bottom-CTA visibility, passive late-image growth/removal, longer questions, capture, scoring, attribution, result details, malformed messages, dimensions-only payloads, focus protection, script-free fallback and ordinary direct-player sizing. Initial development runs encountered the shared HMR reload loop and were stopped. The first compiled run exposed an offscreen second frame that received initialization but did not execute its animation-frame measurement. The microtask fix has both the unit regression that never permits rAF to execute and a passing compiled browser regression. Test-only corrections subsequently accepted the legitimate CSS intrinsic `auto` value, checked attribution through the actual analytics endpoint, and brought the iframe onscreen before Playwright's screenshot stability check. Failing logs were preserved; incomplete runs were not counted as passes.

Final browser evidence is in `../pippi-overnight-2026-10-12/compiled-verification-batch-3/browser-responsive-embed-final.log`; desktop/mobile landing and first-result screenshots are alongside it in `responsive-embed/`.

The responsive script is a new opt-in snippet; existing pasted fixed-height iframe code continues to work. Cross-browser production evidence and integration with specific website builders remain future verification. Custom host CSS can still deliberately override iframe sizing. Heading reveal currently scrolls the host window; embeds inside separately scrolling modals/containers may need the host to manage that container's scrolling. Hosts that disallow both iframes and scripts should use the included direct link.
