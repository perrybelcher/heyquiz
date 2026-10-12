# Bounded plan: click-to-open quiz popup

Read-only source review, 12 October 2026. **This is a plan, not an implemented or browser-verified feature.** No app files, server, dependencies, cloud data, providers or production configuration were changed. The only output of this pass is this document. No competitor research was needed.

## Recommendation

Add one original, click-to-open modal option to the existing published Share controls. A normal quiz link is progressively enhanced into a native `<dialog>` containing the existing public player. The dialog has a permanent close button and direct-link fallback. It opens only after an explicit visitor action; no timers, exit intent, automatic opening, completion-triggered opening, new tracking events or popup campaign settings.

Reuse the existing version-1 iframe handshake, dimensions and heading-reveal messages. Add an optional modal transport to that handshake for Escape handling. Keep the modal scroll target separate from the inline host-window scroll target. Do not paste the existing automatic-height snippet inside a generic scrolling modal: its current reveal handler calls `window.scrollTo`, which is intentionally correct for inline embeds but wrong for a nested modal viewport.

This is a small presentation/transport addition to the public player, not a new quiz session engine, marketing overlay system or popup builder.

## Existing functionality to retain and reuse

- `components/EditorStudio.tsx` mounts `QuizEmbedCode` only when the quiz is published. Pausing removes new-start share controls, while existing attempts retain their existing lifecycle.
- `components/QuizEmbedCode.tsx` already provides automatic height, fixed 700px iframe without script, editable-by-copy markup, clipboard failure feedback and a direct new-tab link.
- `lib/embed.ts` escapes attributes, encodes the quiz ID, validates HTTP(S) origins and defines channel/height bounds. The snippet never interpolates executable quiz content.
- `public/pippi-embed.js` has one loader per script origin, independent frame records, fresh channels on reload, exact origin/source/channel validation, duplicate-script protection and detached-frame cleanup.
- `components/EmbedResizeReporter.tsx` measures intrinsic player height, coalesces measurements without relying on animation frames, and sends only bounded dimensions plus optional heading bounds. It accepts initialization only from its actual parent. Only the empty readiness signal uses `*`.
- `/play/[id]?embed=1` already uses the public published snapshot and removes the viewport minimum. Ordinary direct player pages remain unchanged.
- `QuizPlayer` already saves resumable non-password answers in session storage where available. `QuizTracking` has a separate optional tracking choice. Opening a popup must not manufacture consent or change this behavior.
- Tests already cover inline cross-origin resizing, long landing shrink, active-frame reveal protection, two distinct quiz frames, reload channels, malformed messages, optional contact/scoring, and no-script fallback. Keep these as regressions; do not rebuild their features.

Two valid alternatives need no new app feature: use the existing inline code, or style the existing direct quiz link as a site button. A site builder's existing accessible modal may contain the **fixed-height** iframe; its author must verify focus, close controls and nested scrolling. That is an integration option, not a verified Pippi popup or a reason to reuse the current inline reveal handler unchanged.

There is one current misleading phrase to correct during implementation: the publish-success “Embed & Share” quick action says **“Iframe & popup codes”**, although the actual Share component only has inline automatic/fixed modes. Until popup support ships, “Link & embed code” is accurate. This planning pass did not change that label.

## Author-facing scope and copyable artifact

Extend the existing Embed type fieldset to three choices: **Automatic height**, **Fixed height (no script)** and **Click-to-open popup**. Keep the first two generated snippets byte-for-byte compatible where possible. Popup needs only a short, escaped trigger label; use a clear default such as “Take the quiz.” Do not introduce placement, audience rules, custom CSS, animation, size presets or automatic-trigger controls in the first slice.

Use a pure `quizPopupCode(origin, formId, title, triggerLabel)` helper in `lib/embed.ts` that emits ordinary HTML: a real link to the public quiz, a namespaced external stylesheet and the existing dependency-free loader script. There is no inline JavaScript, framework dependency, `eval`, user HTML or owner credential. It should be usable in an HTML block without a build step. For a React/Next host, installation documentation may explain its script component separately; Pippi should not require every host to use React or bundle a module.

The link works before enhancement and if scripts are blocked. Only after native dialog support, required modal styles and initialization are available should the loader intercept an ordinary primary activation. Keep modified clicks and the link's new-tab destination functional. If enhancing an anchor as a dialog button, add supported button semantics, Space activation, `aria-haspopup="dialog"` and a unique `aria-controls` together; remove them if enhancement is torn down. Alternatively create a real button while retaining a visible direct link, provided it does not leave a nonfunctional trigger when the script fails. Choose one pattern and test its keyboard behavior; do not mix link and button semantics accidentally.

A separate static `public/pippi-popup.css`, with namespaced selectors, keeps copied markup free of inline styles/handlers. The script must leave the anchor usable if that stylesheet is unavailable or native `showModal` is absent. Strict host CSP still needs the app origin permitted for script/style/frame resources; do not promise compatibility with policies that prohibit embedding. No CSP header changes, wildcard permissions or broad iframe sandbox exemptions belong in this slice.

## Modal and lifecycle contract

1. The initial host page contains only trigger/fallback markup and static assets. Create no quiz iframe or public landing request until the visitor activates the trigger. Loading a functional JS/CSS asset is still a request to the app origin; describe this honestly rather than claiming zero network use.
2. Create the dialog with a text title, labelled Close button, short loading status, direct-link fallback and one dedicated scroll viewport. Use DOM creation and `textContent` for user-supplied title/label. Generate unique local element IDs rather than using a quiz title as an ID.
3. Call native `showModal()` from the visitor activation. Place initial focus on Close (or the short dialog heading if that proves clearer in the tested screen-reader flow). Background content must be inert while open, and Tab/Shift+Tab must remain in the dialog while allowing traversal into and out of its iframe.
4. Load `/play/:id?embed=1` in a meaningfully titled frame. Do not send `preview=1`, session tokens, host form fields or arbitrary host URL parameters. The URL must match the loader's exact origin and eligible public-player path. Existing publication/unavailable behavior remains authoritative.
5. Retain the frame while the dialog is closed so a reopen on the same page preserves the current quiz state without starting a new attempt. Hidden frames must not resize/reveal the open dialog or scroll the host. Pending player requests and a timed quiz's deadline retain current semantics; closing is not “pause,” “cancel submission” or guaranteed suspension of third-party media. Make no stronger promise. On SPA removal, detach handlers/observers and remove the dialog/frame.
6. Keep at most one popup open on the host at a time. Each distinct quiz URL has its own dialog/frame/channel and saved scroll position. Multiple triggers for the same canonical quiz URL should deliberately reopen that one dialog and restore focus to the actual activating trigger. This avoids creating competing duplicate same-quiz sessions just because a page has two buttons.
7. A second distinct quiz does not inherit the first quiz's dimensions, answers, title, channel or scroll position. Do not close/swap a currently active dialog in response to a background trigger or an iframe message. Ordinary background clicks are already inert; ignore synthetic competing opens safely.
8. On Close/Escape, close the dialog, release only this loader's body-scroll lock and restore focus to its recorded connected, usable trigger with `preventScroll`. If that trigger was removed, use a safe connected fallback in the host rather than throwing. Restore the original host scroll position and any pre-existing inline body/root styles exactly. Do not wipe a host's own modal lock or accessibility attributes.
9. Do not close on backdrop click in the first version; an accidental outside tap should not obscure an in-progress answer. Do not add an “are you sure?” dialog to every close because the same-page frame is retained. Retention across page refresh or blocked browser storage remains the existing player's behavior, not a new guaranteed service.

Existing player session-storage keys are per quiz, not per embed instance. Therefore arbitrary independently resumed copies of **the same quiz** in a popup and inline frame are outside the independence claim. Test/document this existing boundary; do not silently change storage keys or the attempt engine as part of a popup release. Two distinct quizzes must remain independent.

## Scrolling and mobile layout

Use one fixed modal shell with a stable header/footer and a single body scroll viewport. Let the iframe have its reported intrinsic height inside that viewport, subject to the existing 200–30,000px protocol bound. The shell width should fit a normal quiz comfortably on desktop and stay within the viewport on mobile. Use dynamic viewport height with a conventional viewport-height fallback and safe-area padding. Keep Close and the direct-link fallback reachable without scrolling the quiz back to the top.

For a validated resize message, update only that modal's frame height. For an explicit navigation reveal, first require the dialog to be open, the sending frame to be the current modal frame, and focus still to be inside that frame. Calculate the heading relative to the dialog body's visible rectangle and scroll **only that body** if it is outside view. Clamp the target to that body's scroll range and use immediate motion. Images, FAQs, fonts and passive resizes never request scrolling. Do not change host-window `scrollY` for popup navigation. The existing inline branch keeps its current behavior.

On reopen, preserve that dialog's last scroll position; do not arbitrarily reset an unfinished quiz. On a genuine step transition, reveal the new heading as above. Contents beyond the protocol cap keep native iframe scrolling as the existing fallback. Verify this rare double-scroll case rather than hiding overflowing content. Recompute available space after viewport/orientation changes; test focus and visibility when the virtual keyboard is open. An address bar change or FAQ expansion must not steal focus or jump the surrounding page.

## Transport and trust boundary

Prefer one registry/validator path inside `pippi-embed.js`, with frame state identifying `inline` versus `modal` and carrying the modal's scroll target. Popup-created frames must not be simultaneously registered by the automatic inline selector. A dedicated marker or direct internal registration should make ownership unambiguous.

Keep all existing version-1 fields and height validation. Initialization can add optional `transport: "modal"`; an absent value remains inline. The child handles the optional transport only after the existing actual-parent/source, exact origin format, version and channel validation. Old clients ignore the new field; the parent must not wait for an optional Escape message to make Close functional.

Native dialog Escape/cancel should be handled in the host. Keyboard events originating in a cross-origin iframe do not act like bubbled parent DOM events, so add an optional child-to-parent **`pippi:embed:escape`** message when an unhandled Escape reaches the player's document and the validated transport is modal. It carries only type/version/current channel. Use a bubbling key handler after local controls have a chance to consume Escape; do not intercept composing input or a nested player control's handled Escape. The parent accepts it only from the exact registered origin and `contentWindow`, on its current channel, while that modal is open and its frame has focus. Repeated Escape is harmless; stale, hidden and foreign-frame events cannot close another dialog.

A cross-origin video nested inside the quiz is a separate browsing context; the player cannot synthesize a trusted Escape bridge for it. Test native dialog cancellation with that focus on supported browsers. If a browser cannot propagate cancellation there, the permanent Close control must remain keyboard-reachable and the specific limitation must be documented. Do not claim universal Escape behavior without this evidence or weaken iframe security to obtain it.

Keep payloads limited to protocol type/version/channel, dimensions/heading bounds, and the optional Escape signal. Do not message answers, email, results, quiz title, attempt/report tokens, consent values, attribution or host identity. Initialization and responses use explicit target origins; only the existing empty readiness ping may use `*`. Reject wrong origin/source/version/channel, non-object payloads, arrays where object records are expected, non-finite/fractional/out-of-range dimensions and stale reload messages. Ready alone can prompt reinitialization but cannot open, close or reveal a popup.

Closing and reopening without reloading may keep the same registered channel; current open/frame/focus gates still apply. An actual iframe reload rotates the channel, and removing the dialog invalidates its registry entry. Never implement a global “close all popups” message.

## Consent, telemetry and fallback behavior

Opening the quiz is an explicit presentation action, **not tracking consent**. Keep the existing quiz tracking-choice UI and optional lead-capture consent intact. Do not accept a host-provided “consent=true” attribute, replay provider events on reopen, or add popup open/close analytics. Existing landing/attempt observations happen through their current mechanisms after the player loads/starts; an unopened popup must create neither.

Use local request interception to verify no Google/Meta requests before the quiz's own consent and no added analytics endpoint calls by the loader. Do not exercise real tracker IDs or providers. Retained hidden frames may finish already-started operations; do not reinitialize a player just to force another observed landing on reopen.

The visible “Open quiz in a new tab” link remains available if the iframe cannot load, is paused/unpublished, or scripts/styles are blocked. A load event is not proof that a cross-origin app rendered successfully: show bounded loading/help copy without inventing a success check. A same-origin valid handshake can clear initial loading, but absence of a handshake must never hide the direct link or Close. Cross-origin host fallback cannot bypass the app's publication or access controls.

## Suggested implementation ownership

| File | Narrow responsibility |
| --- | --- |
| `lib/embed.ts` | Pure escaped popup snippet; optional transport/message validation helpers |
| `public/pippi-embed.js` | Progressive trigger enhancement, native dialog lifecycle, mode-specific resize/reveal, exact per-frame gates |
| `public/pippi-popup.css` (new) | Namespaced modal shell, focus indicator, mobile/safe-area/reduced-motion layout |
| `components/EmbedResizeReporter.tsx` | Optional validated modal Escape transport; retain measurement behavior |
| `components/QuizEmbedCode.tsx` | Third mode, short trigger label, code-copy help and truthful fallback copy |
| `components/EditorStudio.tsx` | Only correct the existing premature popup phrase if needed; Share mounting remains unchanged |
| Own unit/browser test and feature note | Protocol, accessibility, lifecycle, regressions and exact evidence |

No schema, records adapter, form storage, scoring, authentication, provider, deployment configuration, global stylesheet or ordinary player route changes should be necessary. Any apparent need to change session identity, event attribution, CSP for the whole app or third-party media APIs should trigger a separate scope review.

## Acceptance before calling it complete

1. **Pure snippet tests:** HTML/attribute escaping with quotes, markup and Unicode; origin/path rejection; no inline executable content or private values; fixed/inline output unchanged; direct link remains usable without enhancement.
2. **Registry/protocol tests:** two distinct quiz frames and inline-plus-popup on one host; repeated snippets; distinct channels; reload rotation; removed frames; closed-frame/stale-channel/wrong-source/wrong-origin attempts to resize, reveal or close; finite height bounds; malformed Escape payloads. Assert neither frame modifies the other's height, title, modal state or scroll.
3. **Real second-origin browser fixture:** one long host page, two popup triggers for distinct quizzes, repeated trigger for the first quiz and one existing inline quiz. No public-player request before click; open/close/reopen preserves the selected quiz; one popup active; direct fallback opens the intended URL. No real provider calls.
4. **Keyboard and accessibility:** Enter/Space activation, visible focus, announced dialog name and iframe title, initial focus, Tab/Shift+Tab across the iframe, Escape from host and player inputs, Close, exact trigger focus restore, removed-trigger fallback, background inertness, 200% zoom/320px reflow and automated dialog accessibility scan. Test nested video focus separately and report any browser boundary.
5. **Viewport/scroll:** desktop and 390/320px mobile, long landing bottom CTA to a short question, longer question, capture, result and result FAQ; local dialog scrolling; no host jump; close restores host scroll; reopen preserves modal position; orientation/keyboard-sized viewport; active-focus guards after closing or opening the other quiz; passive image/FAQ changes never scroll.
6. **Fallbacks:** JS disabled, loader blocked, stylesheet blocked, missing dialog support, iframe blocked/unavailable and clipboard failure. No dead button, unreachable Close, clipped content, frozen host scroll or false loaded claim. Existing fixed-height code still works.
7. **Privacy/consent:** payload allowlist contains no personal data/tokens; no player loads before click; no new loader tracking; quiz tracking decline remains usable, and allow/revoke is tested with network mocks only. Email-marketing choice remains separate. Do not count reopen as a new quiz start.
8. **Publication and regressions:** public snapshot unchanged by draft edits, pause blocks new starts while already valid sessions retain current behavior; run current embed unit suite and compiled responsive browser regression after modifications. Include current Chromium, Firefox and WebKit local evidence for the new dialog flow; do not call that a substitute for human VoiceOver/NVDA or real-device testing.

Root should continue owning the single combined build/server and scheduling synthetic browser runs under the public-start limit. Share exact failures before changing other lanes. A single complete modal flow plus these bounded checks is the next deliverable; chat-style floating widgets, custom domains/slugs, host analytics, automatic triggers, installation dashboards and production rollout remain separate work.
