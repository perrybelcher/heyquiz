# Guest account prompt — 12 October 2026

## Behavior

- An anonymous save, preview or publish now opens a calm burgundy-and-cream account dialog instead of a large red save error. Guest Publish reaches this step before publication validation.
- The main action is **Create free account**. Benefits explain saving a quiz, sharing a link or embed, and seeing submitted answers/results. Existing users have a **Sign in** link. Copy explicitly says accounts are free, with no charges or credit card.
- Account links open a separate tab. The editor stays open, with instructions to return and select **Save to my account**. Closing the dialog or choosing **Keep editing** does not discard the draft.
- Device-backup confirmation is shown only when the current draft was successfully backed up. Blocked storage gets an honest keep-this-tab-open message.
- Already signed-in visitors retain the existing guest-claim flow. A claimed quiz is saved under the same ID, and publication remains an explicit action after saving.
- An expired owner session gets sign-in guidance for the account that owns the quiz, without inviting an unrelated signup. Non-authentication failures remain genuine save errors.
- Autosave now classifies an authentication error from the current response so an earlier 401 cannot disguise a later network failure, ownership error or uncertain save receipt.
- Keyboard focus returns to the actual invoking control, including WebKit pointer clicks and a desktop-to-mobile resize. The dialog supports Escape, keyboard navigation and an explicit close action.

## Verification

All testing used the isolated localhost app on port 3170 and synthetic local data. No production checks, real registrations, emails or provider calls were made for this change.

- Playwright account-prompt suite: all four scenarios passed in Chrome and WebKit. Covers anonymous publish/save/preview; duplicate pending retries; 401 followed by 503/network failures; exact draft claim without automatic publication; blocked browser backup; and expired owner session followed by an ownership failure without creating a duplicate quiz.
- Existing guest-builder regression passed, including reload/recovery and authenticated claim.
- All four existing guided launch flows passed, including save, publication, reload, edit detection and mobile width. Their test now waits for the claimed editor's new document and full page load; it previously clicked on the previous document or before hydration. Earlier failed runs are retained. Instant interaction with server-rendered controls before hydration remains an existing general limitation, not a verified capability of this pass.
- Six scoped accessibility scans (1440, 390 and 320 px in both engines) reported no violations. Axe left gradient contrast as incomplete. Visual review plus foreground/background calculations for the gradient header gave a minimum 5.61:1 ratio; this is not a whole-app accessibility certification.
- Core regression suite: 25 passed.
- Final isolated production build passed.
- Scoped application ESLint: zero errors, 16 existing warnings in EditorStudio/useAutosave. New dialog component and browser tests have no lint errors.

## Implementation and limits

The stylesheet uses unique `pippi-account-*` classes and a regular CSS import, matching the project's existing Tailwind/Turbopack setup. The initial CSS-module approach failed visual QA and was replaced. Initial screenshots/logs are retained separately from final evidence.

Account verification and email delivery remain the existing authentication workflow. This change improves the invitation and preserves the draft; it does not verify live email delivery or automatically complete signup.

The source and release checkout contain the change. It is a local preview, not a deployment. The production site has not been modified by this task.

Evidence: `outputs/pippi-account-prompt-review-2026-10-12` in the parent workspace. Final prompt suites are `chromium-complete` and `webkit-complete`; the final build log is `build-verified.log`.
