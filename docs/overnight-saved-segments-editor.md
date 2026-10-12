# Saved contact filters — editor, batch 14

## Implemented behavior

The contact directory has a compact Saved filters panel above its existing filters. A saved item is a named definition, not stored contact membership. Selecting it does not change the contact view. **Apply saved filters** explicitly replaces all supported criteria, clears contact search, returns to page 1, and reveals historical/source/category controls when needed.

The normal panel shows a saved-filter picker, Apply, a compact Reload action, and short help. **Save current filters** opens an inline name editor with **Save filter** and **Cancel save**. **Manage saved filter** opens Update, Rename and Delete only when requested. Closing these disclosures preserves typed names and pinned confirmations; changing the selected definition clears management for the previous target. Successful Reload preserves draft names.

Creators can save a new definition, rename it, explicitly update it from the current filters, and delete it through a confirmation naming that definition. Delete removes only the definition. Changes to ordinary filters never automatically update saved definitions; a visible Modified state explains the difference. Saving can match zero contacts. No free-text contact search, contact records, response IDs, or membership arrays are sent.

The shared strict helper validates current criteria and every API response. Nonempty search, incomplete/invalid criteria, and an empty definition block Save/Update with an explanation. Up to 20 definitions are available per quiz. Names remain editable after a failed request, and errors are associated with the name controls. Missing historical result/answer choices remain explicit rather than reverting to All.

## Request and state boundaries

- `ContactSavedFilters` is keyed by quiz ID. One cancelable list read runs on mount or explicit Reload. There is no polling or automatic write retry.
- Writes capture their target ID, aggregate revision and submitted definition/name. Saved-list management controls lock while a write is pending; ordinary contact controls and name text remain usable. Successful responses never apply filters. Newer edits typed during a save are preserved. Successful create/rename closes its editor only when no newer name was typed. Focus returns only if it was still in the closing disclosure; delayed responses preserve focus moved to another contact filter. Cancelling after an error/reload uses an enabled visible fallback when the saved-filter select is disabled.
- Stale revisions, uncertain network outcomes, malformed successful responses, and responses that do not advance the aggregate by exactly one revision require an explicit saved-list reload. Current filters remain unchanged. Rename and delete are tied to their opening revision. A refreshed list cannot silently rebase a pending rename: its typed name is preserved, the latest saved name is shown, and an explicit Review latest name action is required before saving. A stale delete confirmation must be reopened.
- Unmounted requests are aborted and ignored. A guarded request sequence and selected-ID check prevent a late response from retargeting the visible action.
- Saved-list errors do not disable valid ordinary filtering or CSV. Contact request/loading/error/historical-answer gates remain separate. `exportCsv` now enforces the same readiness guard as its button, including exact answer-pair association, before creating a file.
- CSV continues to use the existing matching set across all pages. No second membership evaluator was added.

The lifecycle/ownership/CAS API and shared persistence schema are implemented in the separate service lane. This UI preserves its explicit retirement and conflict errors. Absolute dates retain the existing device-timezone behavior; audience membership can change as contacts and history change.

## Owned files and checks

Owned application files: new `components/ContactSavedFilters.tsx` and narrow `components/ContactsStudio.tsx` integration. Shared helper/API files, evaluator/storage/player code remain outside this lane.

Scoped TypeScript and ESLint checks passed. `tests/browser-contact-segments.cjs` passes against the coordinated compiled candidate in Chromium, Firefox and WebKit. It uses two synthetic owner quizzes, real local saved-definition operations, and 30 mocked contacts; it creates no respondent attempts or emails. Cleanup deletes only its synthetic forms, definition sets, and retirement receipts.

Verified browser coverage includes persistence/apply/rename/update/delete; all-27 matching CSV versus a 25-row page; search blocking; modified state without autosave; stale rename revision and typed-name retention, including open rename → external rename → reload → explicit latest-name review; failed/malformed list and mutation responses plus skipped-revision rejection; captured pending-save definition with newer edits and held-rename focus preservation; unavailable historical answers; out-of-order answer requests; delayed cross-quiz GET and POST isolation; capacity display; long names; 320/390/720/1440 widths and a separately labeled CSS 200% zoom check. It supports Chromium, Firefox and WebKit. The initial expanded-layout implementation passed Chrome and Firefox with five scoped accessibility scans each, but screenshot review identified excessive management space above ordinary filters. Those logs remain as initial evidence; the compact disclosure revision and additional cancellation/outside-focus regressions await the coordinated final build. The revised suite captures four compact widths, two expanded mobile states and CSS 200% zoom (seven scoped scans). Its first compact Chrome run passed all seven scans and reached final deletion, where disabling the submitting control caused native focus loss to BODY. The strict final focus assertion exposed the issue; that failure is preserved in `chromium-compact.log`. The component now tracks actual focus movement so native disabled-control focus loss can return to an enabled control without taking focus away from another filter. The rebuilt candidate passed the unchanged strict suite in all three engines. No deployment was performed.

Evidence directory: `compiled-verification-batch-14/saved-segments-editor/` under the overnight output directory.

## Final compiled verification

Candidate: `http://127.0.0.1:3164`, parent build `build-batch-14-accepted.log`. Application source remained frozen during all final runs.

| Engine | Functional suite | Scoped accessibility scans | Page errors | Public starts |
| --- | --- | --- | --- | --- |
| Chromium (Chrome channel) | Passed | 7, zero violations | 0 | 0 |
| Firefox | Passed | 7, zero violations | 0 | 0 |
| WebKit | Passed | 7, zero violations | 0 | 0 |

Each run used 30 synthetic contact rows and 17 browser mutation requests, with local fixture cleanup. The suite also exercises direct local API writes to model a second writer. The accessibility scopes are the saved-filter panel at 320, 390, 720 and 1440 pixels; expanded creation/management at 320 and 390; and CSS zoom 200% at 1440. CSS zoom is a reflow check, not a claim about browser-toolbar zoom or whole-app accessibility.

Final logs: `chromium-final.log`, `firefox-final.log`, `webkit-final.log`. Each corresponding engine directory contains results, scan JSON, empty/default and selected directory screenshots, expanded panels, and exact CSV outputs. Earlier failures and pre-compact passing logs remain intact.

Visual review covered Chrome empty desktop/390 and selected390, Firefox expanded390, and WebKit200% reflow. Controls are readable, long names wrap in management, and no horizontal overflow was detected. The default empty saved panel measures 210.5 px on Chrome desktop (about 44% below the prior 375 px layout), 295.5 px at390, and323.5 px at320. Firefox differs by less than1px; WebKit measures188.5/273.5/301.5px respectively. Only applying saved definitions stays immediately visible; naming and maintenance are deliberate disclosures.

Remaining scope limits: these are supported filter definitions, not a general rule builder or frozen audience membership. Native select rendering differs between engines. No real contacts, provider connections, email, cloud writes, or deployment were exercised.
