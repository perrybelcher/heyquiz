# Result email copy editor — batch 12

## Scope

The new collapsed **Result email copy · preview only** setting lives in guided Results and the full editor’s Ending settings. It offers subject, introduction and optional sign-off, with the shared limits and token validation from `lib/result-email-copy.ts`. Only `{quiz_title}` and `{brand_name}` are supported. The editor also checks expansion against the actual quiz and brand titles before applying.

The preview uses fixed sample quiz/brand values, a fixed sample expiry, and a visibly nonfunctional example link. It renders React text, not supplied HTML. Local-test, expiry, private-link and consent notices come from the shared helper and remain uneditable. The UI explicitly states production sending is unavailable. Opening, typing, previewing, applying and resetting cannot create a capability, queue a test, read a recipient or send a message.

## Editing and recovery

Text changes remain outside the quiz form until **Apply email copy** succeeds. Invalid copy cannot poison autosave. **Apply default copy** immediately removes the optional configuration from the draft; it still follows normal autosave and publication. A failed ordinary draft save keeps the applied values in the editor and uses the existing Retry save behavior.

Unapplied text is owned by the parent editor so it survives guided steps, full/guided switching and panel collapse. A small session-only recovery record is keyed by quiz ID, bounded and parsed to an explicit raw-text allowlist. It restores only the controls, never the form. It keeps the original copy identity; if a restored form now has different copy, Apply is blocked until the current copy is explicitly reloaded. Apply, reset and discard clear only the matching session record. Storage failures are visible, and pending text retains a beforeunload warning. No browser history interception was added.

Files owned by this lane:

- `components/ResultEmailCopyEditor.tsx`: controls, safe preview and bounded session-only pending state.
- `components/EditorStudio.tsx`: narrow placement, pending state ownership and unload warning.
- `components/GuidedQuizEditor.tsx`: one optional ReactNode slot in Results.
- `tests/browser-result-email-copy.cjs`: isolated functional and accessibility coverage.

The helper/schema/backend and public-payload exclusion belong to other coordinated lanes. Installed Next.js client/server, Link and navigation guidance was read before implementation. The new client component imports only the pure copy helper and React/Zod, never email transport, encryption, secrets or recipient data.

## Verification status

- TypeScript: passed after the final application changes.
- Scoped ESLint: zero errors, 18 warnings in existing editor code; no new-component warnings.
- New browser script syntax: passed.
- The complete compiled browser suite passed in Chrome, Firefox and WebKit: invalid/long/expanded copy, inert markup, keyboard access, full/guided/collapsed retention, actual Next Link and back/forward, pending reload recovery, externally changed form conflict, failed session storage, malformed/foreign/bounded session records, apply/reset/503 retry, persisted reload, publication freeze, and 320px/390px/desktop reflow. All nine targeted axe scans reported zero violations. The parent ran the alternate engines; their final logs and scan JSON were read during handoff.
- The browser fixture makes two synthetic public starts solely to inspect frozen attempt snapshots. It never submits an email request or calls result-link/queue endpoints; it removes its own form and attempt records. Frozen queue rendering and encrypted job behavior are verified by the backend lane.
- Initial passing evidence is `compiled-verification-batch-12/email-copy-editor-initial-pass.log`. Final logs are `email-copy-editor-chromium-final.log`, `email-copy-editor-firefox.log` and `email-copy-editor-webkit.log`, with scan JSON and screenshots in `email-copy-editor/{chromium,firefox,webkit}/`. The editor’s existing scroll container clips oversized element screenshots below the viewport, so the final test additionally scrolls controls and preview separately for useful viewport captures. The mobile controls, sample and immutable footer were visually reviewed; their wrapping is readable and within the viewport. No application changes were needed after the first compiled pass. No delivery or production-readiness claim is made by these local editor tests.

Application source, tests and this final document are frozen for parent staging. No deployment or real email was performed.

A sample-only expansion overflow is distinguished from invalid actual copy: if the real quiz/brand values fit, Apply remains available and the fixed sample is hidden with an explanation. The prepared browser test covers a short real title with repeated allowed tokens whose longer sample title would exceed the subject bound.
