# Contact directory and export improvements

Implemented 12 October 2026 in the isolated overnight development workspace. No production changes, real contacts, email delivery, CRM activity or billing calls.

## What changed

- Contact search now includes saved knowledge-tier titles as well as name, email, phone and marketing result titles.
- Combinable consent, submitted-from/through, saved-result, score-availability and minimum/maximum-score filters. Clear filters resets the directory to page one. Invalid dates and ranges show an actionable message and disable export.
- Calendar dates include the full local day in the viewer's device timezone, including daylight-saving transitions. The interface states this explicitly. Filtering uses submission time, not later contact-consent time.
- Saved-result choices come from stored responses. Old, renamed and deleted outcome labels remain accessible; identity plus saved wording prevents accidental merging. Same-title distinct results receive numbered saved-result qualifiers.
- One contact per response is retained. Repeat attempts with the same email are not deduplicated.
- 25 rows per page, bounded previous/next navigation, correct matching/total counts, and all-matching CSV export regardless of the displayed page.
- A compact capture-settings disclosure keeps the contact directory prominent while preserving all existing capture controls and publish behavior.
- Cards show response date and the meaning of the available score. Keyboard-expandable response details retain answers, consent wording, contact fields and the frozen result card. Mobile controls wrap into a single column.
- Initial loading, a successful empty collection, no filter matches and a failed request have separate messages. Refresh failure retains the last successfully loaded list with a stale-data notice and disables export until refresh succeeds. Requests abort on unmount/quiz change.
- Missing legacy marketing consent is treated as no affirmative consent; it does not enter the opted-in count/filter.

## Score semantics and CSV compatibility

The primary score now means the score actually appropriate to the saved response:

- Marketing scorecard: its stored `marketing.overallScore`, when it is a finite 0–100 value.
- Category-only or insufficient-data scorecards: no overall percentage. Category scores remain in the result details/export; they are never averaged into a fabricated overall score.
- Product finders and audience segmentation: no percentage score.
- Graded knowledge responses: their saved percentage, only when points were available.
- Ungraded surveys: no percentage, even though the historic generic grader stores 100.

Every previous CSV column remains in its original position through `result,score,answers`. The existing `score` column uses the corrected semantics above and is blank when unavailable. New columns are appended: `scoreType`, `scoreStatus`, `legacyKnowledgeScorePercent`, `scorecardCategoryScores`. The explicitly named legacy column preserves the old raw `percentageScore` for migration, including meaningless generic-grader 100 values from historical ungraded/marketing responses; it is never used for filtering or displayed as a marketing score. CSV formula neutralization, multiline/quote escaping and all consent-proof fields remain intact.

## Files

- `components/ContactsStudio.tsx`
- `lib/contact-filters.ts` (new, pure filtering/scoring/pagination helpers)
- `lib/contacts.ts` (typed export-row mapping; capture parser/CSV escaping preserved)
- `tests/contact-filters.cjs`
- `tests/browser-contact-filters.cjs`

No schema, contact endpoint, grading engine or database changes.

## Validation

- `node tests/contact-filters.cjs`: 11 scenarios passed. Covers score semantics (zero/null/invalid/category-only/marketing/ungraded), saved-tier search, renamed/same-title results, repeated attempts, missing consent, inclusive dates across DST, combined filters, invalid ranges, pagination, original CSV column order, consent proof and formula escaping.
- `tests/contacts-api.cjs`: all 19 existing capture/API regressions passed against isolated local port3162. Includes required/optional/after-results capture, no preview contacts, declined/affirmative consent, idempotency, storage-failure retry, authentication and CSV safety.
- Targeted ESLint on all three implementation files: passed with no errors or warnings.
- New Playwright scenario passed on the combined compiled server at port3163: 62 synthetic stored responses, directory controls, all-page and filtered downloads, keyboard details, mobile width, failure/empty/retry states, anonymous/wrong-owner access, and fixture cleanup. Earlier dev attempts were interrupted by repeated Next HMR reloads also observed by the other agents.
- Existing `tests/browser-contacts.cjs` passed unchanged when run alone on compiled3163: after-results recommendation/capture, affirmative opt-in persistence, Contacts UI, CSV contents and 390px viewport with 390px document width. A prior concurrent run timed out at its first answer, consistent with the shared start rate window observed by other suites; no fixture/locator or app fix was needed.
- Compiled desktop and mobile contact screenshots were visually inspected: controls and result rows wrap cleanly without horizontal overflow.

Compiled browser command (root owns server/build):

```sh
TEST_BASE_URL=http://127.0.0.1:3163 HEYQUIZ_DATA_DIR=/Users/perry/Documents/Codex/2026-10-06/gr/outputs/pippi-overnight-2026-10-12/test-data node tests/browser-contact-filters.cjs
```

Verified compiled artifacts: `../pippi-overnight-2026-10-12/compiled-verification-batch-3/browser-contact-filters/contacts-desktop.png`, `contacts-mobile-filters.png`, and `contacts-mobile-list.png`. The default artifact directory is `../pippi-overnight-2026-10-12/contact-filters`; earlier failed dev-run screenshots there are diagnostic only.

## Remaining boundary

This is display pagination and local filtering after the authenticated contact list loads. The existing endpoint still reads the owner's submissions and returns all contacts for this quiz. It does not claim bounded database/network work, server-side filtering, persistent saved segments, cross-quiz deduplication, contact editing, CRM sync or bulk email. Server-side contact querying remains a separate scaling task.
