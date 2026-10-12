# Click-to-open quiz embeds

Implemented locally on 12 October 2026. Unit/protocol checks, existing inline regressions, scoped lint and TypeScript passed. The root-controlled combined production build and compiled three-browser acceptance passed; application source is frozen. No live host, production deployment, provider, email, credential, payment or cloud work was performed.

## Behavior

Published Share now offers a third embed type, **Click-to-open popup**, alongside the existing automatic-height and script-free fixed-height options. A creator can edit the short trigger label and copy ordinary HTML containing a real public quiz link, the namespaced popup stylesheet and the existing loader script. Titles/labels are escaped as text/attributes; quiz IDs are encoded; no executable creator content or private tokens appear in the snippet.

The link is enhanced only when native dialogs and the required stylesheet are available. Before enhancement, or if JavaScript/styles/dialog support fail, it remains a working new-tab link. Modified clicks retain ordinary link behavior. If the trigger is inside another host dialog, the ordinary direct-link fallback is retained rather than silently ignoring it. The dialog is created on the first explicit click; no quiz iframe or player request exists beforehand. Loading the functional static script/stylesheet still makes requests to the app origin.

The native dialog has a named heading, visible Close quiz button, loading/help text, permanent direct link and its own keyboard-focusable “Quiz content” scroll region. There is no timer/exit-intent/automatic opening, backdrop-close behavior, popup tracking or host consent override. Ordinary quiz tracking choice, contact capture, scoring, publication and attempt semantics are unchanged.

The frame is retained when closed so reopening it on the same page preserves current answers and capture fields. Closing is not a request to cancel an in-flight submission or pause a timed quiz. Multiple buttons for the same canonical quiz URL reopen the same frame; different quiz URLs retain separate states/channels. At most one Pippi popup is open on a host at a time. Removing all associated triggers removes its retained dialog/frame and releases owned scroll/focus state.

## Focus, layout and protocol

- The host opens a native `<dialog>`, focuses Close initially and leaves background inertness/focus traversal to the browser's modal behavior. Enter and Space activate an enhanced trigger. Close/Escape restore focus to the actual connected trigger; a removed trigger has a safe host fallback. Scroll locking preserves and restores individual original style values and their priorities. Properties changed by another host component while open are not overwritten on cleanup.
- `aria-controls` is added only after the lazily created dialog exists. Long titles retain their full accessible and hover text while visually clamping to two lines. A compact short-height rule keeps Close/direct fallback usable on small viewports. There are no motion effects.
- Existing version-1 dimensions-only messages and origin/source/channel validation are reused. Popup initialization adds optional `transport: "modal"`. An unhandled, non-repeating Escape from the player's own document sends only type/version/channel to the validated parent origin. Consumed Escape and composing input do not forward. The validated connection persists across question/capture observer restarts, so a fast Escape is not lost while the next handshake response is pending. Nested third-party frames cannot use this bridge.
- The parent accepts Escape only from the current registered frame while its dialog is open and that frame has focus. Hidden, detached, wrong-origin, wrong-source and stale-channel frames cannot close or scroll another popup. Only the existing empty readiness ping uses a wildcard target.
- Modal frame registration requires the exact canonical public quiz URL plus only `?embed=1`. If host code changes it to a different quiz/parameters, the stale modal is removed; its old messages cannot resize the original frame or retain misleading title/fallback association.
- Valid reported heights stay within 200–30,000 pixels. The intrinsic-height iframe sits in the dialog scroll area. An explicit step transition reveals a heading only when the sending frame remains focused, scrolling that area rather than the host window. Passive image/FAQ/font resizing does not request scrolling. The inline branch retains its existing behavior and markup.

## Files

- `lib/embed.ts`: pure escaped popup snippet, retaining inline helpers.
- `public/pippi-embed.js`: progressive popup triggers, per-quiz dialog/frame records, shared validation, focus/scroll lifecycle and modal reveal target.
- `public/pippi-popup.css`: isolated modal layout, focus styles and mobile/short-height treatment.
- `components/EmbedResizeReporter.tsx`: optional validated modal Escape transport with the existing intrinsic measurement.
- `components/QuizEmbedCode.tsx`: third mode, trigger label, copy help and clear fallback/consent copy.
- `components/EditorStudio.tsx`: only the publish-success quick-action phrase updated to “Inline & click-to-open embeds.”
- `tests/popup-embed.cjs`: synthetic VM/unit protocol/lifecycle checks.
- `tests/browser-popup-embed.cjs`: real second-origin compiled tests across Chrome, Firefox and WebKit.

This lane did not change ordinary QuizPlayer, schema, storage, authentication, records adapter, global stylesheets or provider configuration. Root separately corrected existing player-footer text contrast in the combined build.

## Verification

`tests/popup-embed.cjs` passes escaping and no-frame snippet behavior, CSS/native readiness, exact URL grouping, duplicate handlers, one-open gate, wrong origin/source/channel rejection, bounded heights, modal-only reveal, focused Escape before a navigation handshake reply, reload channels, hidden/detached frames, altered same-origin player URL rejection, normalized style restoration and optional child Escape payloads.

The existing `tests/embed.cjs` passes unchanged, including inline exact origin/source/channel isolation, fixed-height fallback, reload/detached behavior, active-frame-only host reveal and offscreen measurement independent of animation frames. Scoped ESLint and full `tsc --noEmit --incremental false` pass. Logs are in `../pippi-overnight-2026-10-12/compiled-verification-batch-9/popup/{unit,inline-unit,lint,typecheck}.log`.

The final compiled acceptance passed against the isolated production build on port 3163: **12 groups, Chrome/Firefox/WebKit at desktop 1280×900 and mobile 390×900, 12 synthetic public starts**. Two different synthetic quizzes per engine covered lazy player loading, bottom-CTA shrink/reveal, actual ArrowDown scrolling of the named region, same-page state on duplicate triggers, Escape from answers/contact input, optional tracking decline, capture and 100% scoring, second-quiz isolation, host scroll/focus restoration, malformed messages, no personal-data messaging, screenshots and page errors. The Share control and generated popup label were also exercised. Additional Chrome cases passed at 320×320 with long ordinary/unbroken titles, disabled JavaScript, blocked loader/style, missing native dialog and blocked iframe. Fallback cases created landing requests only, without extra starts. Synthetic quizzes were cleaned up; all browser contexts closed.

Final evidence is retained in `../pippi-overnight-2026-10-12/compiled-verification-batch-9/browser-popup-embed-final.log`, `popup/results.json`, twelve engine/width landing/result screenshots and `popup/chrome-320-short-long-title.png`. Visual review included mobile landing/result in Chrome and WebKit, Firefox mobile landing, desktop result in Firefox and WebKit, and the Chrome short-height long-title case; the controls, score content and direct-link fallback remain readable without overlap. Root owns independent accessibility/reflow and unchanged inline-browser verification; these are separate from this lane's functional results.

Earlier failures remain retained rather than overwritten:

- `browser-popup-embed-first-failure.log`: the correct score appeared as split DOM text; the assertion now checks actual response percentage plus visible points.
- `browser-popup-embed-escape-failure.log` and `popup/navigation-race-before.log`: a genuine fast-Escape race during navigation reset the validated parent connection. The persistent connection fix has both a deterministic unit regression and passing real answer/capture Escape checks.
- Root's independent scan identified the popup scroll region's missing keyboard focus. Its named focusable region now has an actual ArrowDown assertion in all three engines.
- `browser-popup-embed-firefox-constructor.log`: Firefox rejects the test's constructed cross-origin WindowProxy event source. The test now uses a real wrong-origin host postMessage; unit tests retain source-spoof coverage.
- `browser-popup-embed-webkit-keypress.log`: a zero-duration synthetic ArrowDown does not scroll in native WebKit, reproduced separately in a plain overflow container. The browser test uses a 100 ms keypress; this required no application change.

These failed runs are not counted as passes. The final corrected build and complete test run are the acceptance evidence.

## Explicit boundaries

- The popup must be installed on a host that permits the app's script, stylesheet and iframe origin. No wildcard CSP changes or unsupported host-builder compatibility claim is made. Host CSS deliberately overriding the namespaced rules can still interfere.
- Existing fixed-height and direct-link options remain safe alternatives. A host's custom modal can use the fixed-height code, but generic inline auto-height code must not be assumed to scroll an arbitrary nested container correctly.
- Same-quiz storage remains keyed per quiz. Duplicate popup buttons share one frame intentionally. Independently resumed copies of the same quiz in an inline frame and popup are not promised to be separate sessions; distinct quiz URLs are isolated.
- Closing preserves a live same-page frame, including any in-flight work and original timer deadline. It does not guarantee pausing third-party video/audio. Reload/blocked-storage recovery remains the existing player's behavior.
- Escape from nested third-party video frames is outside the player's document. Permanent Close and direct link remain available; real-device and assistive-technology checks are still needed before claiming universal keyboard/screen-reader coverage. No iframe security boundary was weakened to obtain nested frame access.
- A handshake is a rendering signal, not proof of availability or a completed quiz. Unavailable/paused quizzes keep their app behavior and the modal remains closable. There is no new provider delivery, analytics promise, custom domain, automatic trigger, chat widget or production rollout in this batch.
