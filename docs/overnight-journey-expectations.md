# Expanded saved journey expectations — batch 7

## What the saved cases now check

`evaluateJourneyCase` retains the real marketing evaluator's category IDs, numeric/null score, answered/applicable/minimum-answer counts, and the ordered IDs of the result sections actually resolved for the answers. It does not recalculate these from the overall score or current page text. Valid ordinary quizzes and outcomes with no categories/sections produce explicit empty arrays.

New saved cases capture those arrays along with the existing status, named result, overall score and visible question sequence. Reruns report precise category-ID differences, including added/missing categories, score changes, zero versus insufficient information, and each coverage count. Resolved section appearance, removal and order are compared exactly. Two category scores changing in opposite directions now fail even when their overall average and named result remain identical.

Question/category/result wording, advice text and visual design are not assertions. An editorial edit still makes the draft fingerprint stale and requires a new run, but a passing result says the saved behavior matches and that wording/styling/unasserted settings may have changed. This avoids treating a renamed label as a scoring failure or claiming that every possible behavior was checked.

## Existing cases and explicit review

The existing browser/quiz storage key and version-1 envelope remain compatible. `categories` and `resultSectionIds` are optional only for older/partially expanded expectations. **Missing means not checked; an empty array explicitly expects none.** Older cases load and run with their original narrower checks, with a visible limited-coverage label.

The **Review additional checks** action:

1. Runs the existing assertions and refuses expansion if any already fails.
2. Shows the currently observed category scores/coverage and ordered section identities.
3. Offers **Keep existing expectations** or **Add reviewed checks**. Escape cancels the review without closing the conversation map. Keyboard focus moves into the review and returns to a useful control afterwards.
4. Adds only fields that were missing. Existing assertions are preserved; no value is silently rebaselined. The draft fingerprint/revision is updated only after the explicit successful reviewed save.
5. Rechecks the draft, case and proposed values on confirmation. A changed draft/case or tampered proposal is rejected. Cancelling does not mutate the original case. Browser storage failure keeps the stored case and the review available for retry.

The selected simulated result and each saved case expose the category/section evidence for inspection. Stable IDs remain visible alongside current labels, so a renamed category still identifies the same assertion.

## Bounds and contract

- Existing simulation limits are unchanged: default 256 and hard 512 distinct paths, bounded traversal, representative probes plus honest enumeration/unsupported-path labels.
- Saved cases remain finite-choice, browser-local, per-quiz and capped at 25; no attempt, response, email, integration or cloud record is created.
- Existing 500,000-character serialized storage limit remains. Expanded arrays accept at most 20 unique categories and 12 unique section IDs. IDs, finite 0–100/null scores and bounded integer coverage/minimums are validated on load; malformed/duplicate new expectations fail safely.
- The shared `JourneyExpectation` contract exports optional `categories: {id, score, answered, applicable, minAnswers}[]` and `resultSectionIds: string[]`. `expectationFor` supplies both for new valid evaluations. Campaign fixtures can provide literal expectations and use `runJourneyFixture` for the same checks.
- A saved baseline is author-reviewed change detection, not independent proof that the initial result was correct. Section content, layout, category bands/advice and CTA URLs remain outside these new assertions. No broad engine/schema/player/publishing changes were made.

## Files and checks

Changed application files: `lib/journey-testing.ts`, `lib/journey-fixtures.ts`, `components/ConversationMap.tsx`.

- `node tests/journey-testing.cjs`: existing representative/boundary, branching, cap, storage and staleness regression suite passed.
- `node tests/journey-fixtures-expanded.cjs`: **13 checks passed**, covering full output extraction, paired category changes with unchanged overall, answered/applicable/minimums, null-to-zero with unchanged unavailable overall, section order/conditions, editorial distinction, added/removed category identities, legacy review/cancel/upgrade, stale/tampered/failing upgrades, partial upgrade and quiz isolation, malformed storage fields and network exclusion.
- Focused ESLint for the three application files passed.
- `tests/browser-journey-fixtures-expanded.cjs`: passed in isolated Chrome against the combined compiled batch-7 app on port 3163. Checked legacy labels, keyboard review/cancel/Escape, quota rejection/preservation, explicit upgrade, precise same-overall category/section failures, editorial wording, reload/quiz isolation, 390px layout, no API mutations and no browser exceptions. Screenshots and full log: `../pippi-overnight-2026-10-12/compiled-verification-batch-7/journey-expanded/`.
- Existing `tests/browser-conversation-map.cjs`: passed against the compiled batch-7 app in isolated Chrome. It now opens the existing mobile **More** menu for editor actions, matching the batch-4 toolbar instead of querying hidden desktop buttons; existing behavioral assertions remain. Verified bounded representative simulation, fresh/blank template recovery, guided/mobile editing, scoring and image preservation, named case persistence/staleness/removal, zero API writes and no browser exceptions. Full log and copied desktop/mobile screenshots: `../pippi-overnight-2026-10-12/compiled-verification-batch-7/conversation-map/`.

Root completed the shared TypeScript/build and started the combined compiled batch-7 server for these browser runs. Both named generic UI containers now use `role="group"` so their accessible labels have supported meaning. Root separately owns settled axe/reflow scans. No production/cloud/email/provider calls or deployment were performed.

## Final keyboard review follow-up

Root's settled scan found no axe violations but separately reproduced a real keyboard issue: closing the map via Escape left focus on `body` on desktop and mobile. The native dialog was being closed only during passive unmount cleanup, after it could be detached.

The narrow follow-up closes the connected dialog before dismissing, captures its opener, and restores a connected visible opener on the next frame. If a breakpoint has replaced it, restoration falls back to the visible mobile **More** or desktop **Conversation map** action. A newly opened modal is not interrupted; edit navigation closes synchronously without scheduling return focus. The nested expectation-review Escape/cancel behavior is unchanged.

Focused ESLint and TypeScript checks passed. After root rebuilt and restarted the final compiled app on port 3163, `tests/browser-journey-focus.cjs` passed in **Chrome, Firefox and WebKit**, with 16 focus checks per engine covering both editor modes, desktop/mobile Escape and close button, breakpoint changes in both directions, and theme-editor navigation without focus theft. Each run observed zero API mutations and no browser exceptions. Evidence: `../pippi-overnight-2026-10-12/compiled-verification-batch-7/journey-focus-chromium/`, `journey-focus-firefox/` and `journey-focus-webkit/`.

The expanded journey suite was then rerun once against the same final compiled build and passed, including nested review Escape/cancel, quota-error preservation, explicit upgrade, precise difference reporting, editorial distinction, reload/isolation and mobile reflow. Its separate evidence directory is `../pippi-overnight-2026-10-12/compiled-verification-batch-7/journey-expanded-focus-final/`; earlier logs remain preserved. No further application changes were needed during these four final browser runs.
