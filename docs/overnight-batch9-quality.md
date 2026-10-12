# Batch 9 quality handoff — 12 October 2026

This batch is implemented and verified against an isolated local production build. It has not been pushed or deployed. No real email, provider, credential, payment or cloud changes were made. CRM and Stripe remain last.

## Delivered

**Historical answer contact filtering.** One saved question version and selected option combine with the existing contact conditions. Frozen question wording and option IDs determine membership; multi-select means includes the option. Coverage distinguishes unanswered, skipped by saved routing, other versions, unavailable and invalid history. Contacts, activity, catalog and membership arrive atomically; pending/failed/obsolete responses cannot enable an incorrect CSV export. The current draft cannot rewrite historical membership. The output catalog is bounded to60 versions/100 options with omissions and the active selection retained. This does not bound backend record scans. See `overnight-contact-answer-filter.md`.

**Click-to-open popup embeds.** Share offers a popup link alongside automatic-height and fixed-height inline embeds. Frames load only on activation; native dialogs contain a Close button, named keyboard-scrollable quiz region and permanent direct-link fallback. Reopening on the same page preserves answers/capture state. Long titles and very short viewports retain usable controls. Exact source/origin/channel/URL checks isolate frames; messages carry protocol/dimensions only. Closing does not pause the quiz deadline or cancel a pending submission. Script/style/native-dialog failures retain an ordinary link. See `overnight-popup-embeds.md`.

**Six more original campaigns.** Tea, desk, language, nonprofit, course-readiness and workshop-readiness now have full landing/result content and setup guidance, bringing enriched campaigns to18 of43. Existing IDs, questions and scoring remain unchanged. New result guidance provides useful neutral outcomes, including uncertain/incomplete answers. No purchased assets, fake proof, live placeholder destinations or real delivery promises. See `overnight-template-campaigns-batch9.md`.

**Player footer readability.** Branding text now inherits the quiz’s configured text color instead of a hardcoded faint slate color. The default tested contrast failure is corrected; arbitrary creator-chosen color pairs are not certified.

## Verification

Final build: `../pippi-overnight-2026-10-12/build-batch-9-final.log`, TypeScript and static generation passed. Final isolated server3163/session43417; `server-batch-9-final.log`. All cloud credentials were blanked in the server environment. `.env.local` was not printed, changed or archived.

Nine distinct compiled browser suites passed: historical-answer contacts; existing contact cohorts/activity; existing contact filters/export; six new campaign journeys/PDFs; popup embeds; independent accessibility/reflow; existing analytics cohorts; existing answer/source attribution; existing responsive inline embeds. Popup flows passed Chrome, Firefox and WebKit at desktop/mobile widths. Campaign browser evidence is Chrome only; the earlier generic PDF downloader was independently verified in three engines in batch6.

- Contacts:44 synthetic historical-answer rows, exact30-match all-page CSV,44/38/62-record new/existing browser fixtures, selection races, failure retry, focus and390px layout. No public starts for these suites.
- Analytics extraction:558 exact comparisons against the archived batch8 implementation, including types/raw shapes, historical edits, branching, cohorts and missing/deleted/preview/future records. Existing30 analytics checks,11 cohort checks and4 API checks passed. New contact-answer12 unit and6 mocked-route scenarios passed; existing contact context/filter/API checks remain green.
- Campaigns:44 new literal cases,96 cases across all18 enriched campaigns, existing catalog64,000 scoring paths and768 legacy paths. Six previews/public completions/native PDFs, optional capture, guest autosave and frozen publication/report behavior after republishing changed guidance. All9 PDF pages rendered and visually inspected.
- Popup:12 final browser groups across three engines, actual arrow-key scrolling, state-preserving duplicate triggers, short-height title layout, fallback behavior, capture/scoring, fast Escape, scroll/focus restoration and spoofed/stale message rejection. Existing inline browser regression passed unchanged.
- Accessibility:17 populated automated A/AA scans, zero violations and no page-level horizontal overflow. Contact states use1440/640/390/320 CSSpx widths. Popup includes320×320 and568×256; Close/direct link remain visible and scroll area remains at least60px. Root visually inspected mobile contacts, desktop popup and short popup screenshots.640CSSpx approximates reduced effective width; it is not an actual browser zoom test or screen-reader certification.
- Remaining automated manual-review findings: the decorative aria-hidden minus glyph in More filters cannot be contrast-assessed as text; `aria-controls` points to the real retained native dialog but axe cannot fully evaluate the hidden/inert relationship. These are recorded separately from violations. Native focus/close tests and source/DOM structure were reviewed.
- Scoped lint passed with zero errors. The one-line QuizPlayer color change retains four pre-existing warnings (unused type, hook dependencies and two image optimization notices); they were not silently described as warning-free.

Exact evidence is in `compiled-verification-batch-9/final-status.json` and associated logs/screenshots/CSV/PDFs.

## Findings fixed, with original failures retained

The independent audit found a keyboard-inaccessible popup scrolling area and a low-contrast player footer. Both were fixed before the final build. The popup functional test caught a real navigation race: observer restart briefly discarded the validated transport, so immediate Escape from a new capture step could be lost. A deterministic failing unit reproduced it; preserving the validated connection across navigation fixed it.

Pre-build review also corrected long-title/short-height crowding, altered iframe URL association and dangling pre-open aria-controls. Test-only corrections included a split numeric/percent score locator, Firefox disallowing a fabricated cross-origin WindowProxy in MessageEvent, and WebKit needing a realistic100ms ArrowDown press (confirmed with an app-free native overflow fixture). These are not application defects or extra passing runs.

## Checkpoints and next scope

Active source is outside Git. Local batch9 archive/manifest preserve this increment; they are not a pushed commit or a deployment package. A release audit found legacy `data/forms.json` and `data/submissions.json` in earlier local archives because their baseline allowlist included them. Those original private recovery artifacts remain local and must not be published. The new checkpoint excludes data and runtime folders, and active `.gitignore` now excludes `/data/`. Pathname inspection alone does not establish that every historical QA log is safe to publish. The old Git checkout also tracks a historical full backup ZIP; review that history before any later push.

Read `overnight-release-staging-plan.md` for an isolated, allowlisted Git staging approach and `overnight-storage-bounds-plan.md` for shared local read concurrency. These are plans, not completed changes. Real account-email verification, real result delivery/scheduler, indexed backend pagination, native PDF language/assets limits and production verification remain open. No new production-readiness or full competitor-parity claim is supported by this batch.
