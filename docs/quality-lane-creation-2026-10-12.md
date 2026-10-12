# Creation, drafts and account UX — 12 October 2026

## Scope and status

This lane exercised isolated local Pippi with synthetic quizzes and blocked external/provider traffic. Initial evidence uses the frozen compiled app at `127.0.0.1:3171`, with records under `/private/tmp/pippi-overall-qa-20261012/creation-data`. Accessibility corrections were first verified against the local development app at `3170`, then accepted on the second combined production build served at `3171` from `work/pippi-qa-final-2026-10-12`. Chrome, Firefox and WebKit each passed the final strict manual rehearsal. No deployment, real signup, email, AI generation, payment, or customer data was used.

## Defects corrected

A new complete manual-creation rehearsal found unlabeled choice-answer text inputs, unassociated field-type/page/points labels, and insufficient contrast on seven visible labels in the desktop state (three repeated on mobile). `EditorStudio.tsx` now associates those labels and darkens the affected text. `SortableQuestionCard.tsx` gives each answer a question/answer-position name and darkens the options/key guidance. Scoring, IDs, save state, and theme behavior are unchanged.

Screenshot inspection of the first combined-build run caught a further defect that axe and document-wide overflow checks missed: at 320 px, the delete-question button ended at x337 while the viewport ended at 320 and its card at 271. Answer removal also extended outside the card. The card header/metadata now wrap, its toolbar stays intact, answer inputs can shrink, and remove buttons retain their width. Enabled card icons/handles now use darker text without opacity fading; unchecked answer-key borders are darker too. Measured pre-fix non-text contrast was 1.43–2.60:1 for affected controls. The strengthened test measures all 19 controls against card and viewport bounds and checks enabled strokes at ≥3:1. Development verification passes at 1440/320/390; the minimum measured enabled contrast is 3.65:1 (the existing checked-answer icon), with fixed toolbar controls 7.56:1. Disabled movement retains its visual fade.

The same rehearsal verifies a manually authored multiple-choice question, three edited options, correct key, added/removed fourth option, 25 points, applied brand/color, exact claim to account, second short-answer question, autosave/reload, cancelled theme edit and mobile title save. The initial functional run passed while explicitly recording accessibility failures. The stricter development rerun passed with zero axe violations and no horizontal overflow at 1440 and 390 px. The first combined compiled run passed all three engines at 1440/320/390, but its screenshots exposed the clipping described above; those passes are functional/axe evidence only, not acceptance of control visibility. Final acceptance after the bounds correction passed in Chrome, Firefox and WebKit. Each engine measured all 19 question/answer controls at 1440/320/390: every control stayed inside its card and viewport, enabled-control contrast stayed at least 3.65:1, and all three axe scans had zero violations. Nine final scans across the three engines had no horizontal overflow. The full functional rehearsal also passed in each engine with zero public starts, provider requests or application errors. Screenshots inspected include WebKit 320 and Firefox 390; controls are visible and the compact editor header remains usable. This is scoped state coverage, not a whole-application accessibility certification.

## Initial compiled acceptance

| Test | Result and useful boundary |
| --- | --- |
| `browser-creation-paths.cjs` | Pass: four entry choices, blank has zero questions, explicit resume, new independent drafts, guided goal path, template preview, AI auth return; six chooser scans at 320/390/1440 have zero violations/incomplete items. |
| `browser-account-prompt.cjs` | Pass: four account/session scenarios, new-tab account links, backup honesty, resize/Escape/reopen/focus, auth vs network/server errors and claim without automatic publication. Three modal scans have zero violations; color-contrast manual-review items remain recorded. |
| `browser-draft-safety.cjs` | Pass: mocked AI review and selective application, history restore, saved previews, failed/quota saves and guest preview account gate. |
| `browser-guided-creation.cjs` | Pass: question/option manipulation, dependent-branch removal review, scoring, reload and goal-specific AI entry. |
| `browser-guest-claim-continuation.cjs` | Pass: 12 scenarios including actual Stay on navigation, PUT continuation, conflict and reload/back/forward, invalid claim receipt, auth/permission/server errors, and unavailable browser storage. |
| `browser-guest-claim-safety.cjs` | Pass: seven scenarios proving exact submitted claim, newer backups, same-ID/different-ID other-tab pointers, independent session cleanup, and failed 401/409/503 claims. |
| `browser-creation-auth-return.cjs` | Pass: four groups with six mocked account actions; no actual signup, email or AI calls. |
| `browser-draft-protection.cjs` | Pass: two-tab failed-save isolation/recovery, later restore, stale revision rejection, and honest unavailable-browser-storage warning. |
| Pure checks | `draft-history`, `guest-draft-recovery`, `creation-auth-return`, `guided-editing` all pass. |

Evidence is in `../pippi-overall-qa-2026-10-12/creation/`, especially `entry-browser.log`, `account-chromium-browser.log`, `draft-safety-initial.log`, `guided-initial.log`, `continuation-current.log`, `claim-safety-isolated.log`, `auth-return.log`, `draft-protection-final.log`, and `manual-dev/`. Initial three-engine results are under `manual-final-{chromium,firefox,webkit}/`; `manual-bounds-before/` and `manual-icons-before/` preserve failing strict geometry/contrast evidence, while `manual-bounds-dev/` confirms the correction before final rebuild. Accepted combined-build evidence is in `manual-accepted-chromium/`, `manual-accepted-firefox/`, `manual-accepted-webkit/` and matching `.log` files; each has screenshots, accessibility/bounds/contrast measurements and a functional summary.

## Test maintenance and preserved failures

Legacy creation tests still assumed `/create` immediately opened the wizard and older title/status/auth labels. They now use the explicit guided or draft-resume routes and current account dialog, without dropping content, error, conflict or recovery assertions. One old claim test expected only the POST snapshot on the server, although confirmed-claim continuation may legitimately PUT newer edits before navigation completes. Its recovery scenario now deliberately makes that newer PUT unavailable (503), then restores service and proves the retained newer backup can save. The exact submitted POST assertion remains.

Initial permission-related browser launch failures, stale-locator failures and the old race assumption remain in separate logs. No application failure is hidden by treating them as passes. Scoped lint for the two modified app files and current tests has zero errors; the two large editor files retain 28 pre-existing unused-import/image/navigation warnings.

## Limits

These are local synthetic browser and source checks. They do not establish hosted authentication/email delivery, real provider generation, physical-device/assistive-technology usability, production scale, or user conversion. The parent lane produced the accepted combined build; any live deployment remains separate from this local acceptance. CRM and Stripe remain deferred.
