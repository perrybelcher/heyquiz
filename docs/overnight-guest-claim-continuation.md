# Guest claim continuation — batch 11

## Reproduced problem

The compiled batch 10 app could successfully create an account quiz while newer edits remained in the guest editor. Dismissing the actual browser `beforeunload` dialog with **Stay** preserved those edits, but left the guest controls mounted. Retrying sent a second creation POST and received 409. The first server snapshot and the newer browser backup survived; the editor nevertheless offered the wrong next action.

The reproduction used an isolated local account and a uniquely owned disposable quiz. Evidence lives in `compiled-verification-batch-11/guest-continuation/before.log` and `before-stay-duplicate-claim.png` under the overnight evidence directory. No public quiz starts, emails, provider calls, or production writes were used.

## Change

- `hooks/useAutosave.ts` adopts a successful claim only when the returned quiz ID matches the submitted snapshot and the returned revision is a positive safe integer. It keeps the submitted fingerprint rather than treating newer in-flight edits as saved.
- Confirmed claims switch subsequent saves to the existing revision-checked PUT loop. A canonical editor URL is installed before attempting navigation, so reload after Stay opens the account copy and can offer genuine browser recovery.
- The existing beforeunload protection remains active, including when browser backups fail. Conditional session/local cleanup from batch 10 remains unchanged and preserves newer same-ID drafts and another tab’s guest pointer.
- Successful but unreadable or invalid confirmations retain backups and do not issue a second creation POST. The UI explains that confirmation could not be verified.
- `components/EditorStudio.tsx` distinguishes an unclaimed guest draft from a confirmed account quiz still mounted in the guest view. It offers continued editing and **Save & open quiz**, which drains the current save before navigating. Auth/conflict/failure feedback remains available.
- Continued PUTs retain the confirmed server creation timestamp when the mounted guest draft has no timestamp. Only string response timestamps are accepted; user-editable content remains part of the fingerprint.

The installed Next.js native History API and navigation documentation were checked before implementation. Native `history.replaceState` is supported by the installed router. Hard navigation is intentional here because the existing unsaved-change guard must remain effective.

## Verification

- Final TypeScript check: passed.
- Scoped ESLint for the hook and editor: zero errors, 19 warnings, predominantly existing unused imports, image guidance, and intentional hard-navigation guidance.
- `tests/browser-guest-claim-continuation.cjs`: all 12 cases passed against the compiled batch 11 candidate in each of Chrome, Firefox, and WebKit (36 passing scenario runs). Cases cover actual Stay dismissal; revision-safe continued PUT; save/open; genuine reload recovery after conflict; back/forward; a stale returned revision; 401/403/503 continuation failures; unavailable storage; and wrong-ID, zero/string revision, and malformed-JSON confirmations. Each verifies that the acknowledged claim sends exactly one POST and removes only its own server fixture. The parent ran the alternate engines; their complete final logs were also read during this handoff.
- The first run exposed an asynchronous test-polling mistake, before the 600ms autosave completed. It was corrected to bounded Node API polling with unchanged saved-content assertions. The original failure is retained as `chromium-initial-polling.log`; final evidence is `chromium-final.log`. No application change followed that test failure.
- The existing guest-builder regression and all seven batch 10 claim-safety regressions passed, covering ordinary claim/reload, retained in-flight edits, shared same/different guest pointers, blocked local cleanup, and 401/409/503 creation failures. Evidence: `basic.log` and `claim-safety.log`.
- The mounted confirmation banner was screenshot-checked at 320px and 390px. Its text and **Save & open quiz** control wrap visibly without horizontal overflow; scoped axe WCAG A/AA scans reported zero violations at both widths. Evidence: `chromium/continued-editor-320.png`, `continued-editor-390.png`, and `banner-accessibility.json`. This is a targeted banner scan, not a new whole-application accessibility claim.

Chrome and the legacy regressions are under `compiled-verification-batch-11/guest-continuation/`. The parent’s alternate-engine evidence is at `compiled-verification-batch-11/firefox-final.log`, `webkit-final.log`, and the respective `firefox/` and `webkit/` screenshot/scan folders. Each alternate engine also passed the 320px and 390px banner checks. Their initial polling failures are retained separately. Application source, test, and this documentation are frozen for parent staging; no deployment was performed.

## Boundaries

An unverifiable successful response cannot safely invent a revision or blindly retry creation. The draft is retained and the user is directed to check their account copy. This change does not add cross-device recovery or alter the existing record conflict policy. It does not deploy the app.
