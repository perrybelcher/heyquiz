# Contact cohorts and recorded response activity

Implemented 12 October 2026 in the isolated overnight workspace. No production deployment, real contacts, email, provider requests or new event collection.

## Delivered behavior

- A compact **More filters** disclosure adds quiz-start source, start campaign and saved scorecard category filters. They combine with each other and existing search, consent, date, saved-result and overall-score filters using AND. Escape closes the disclosure and returns focus to its button.
- Source and campaign use the same normalized dimensions as analytics: explicit UTM source/campaign, sanitized referrer hostname when available, and genuinely unknown attribution. Literal campaign names such as `all` and source names such as `unknown` remain separate from missing values. Unknown is not relabeled direct traffic.
- Category identity includes its saved ID and wording. Renamed categories retain their historical label; distinct same-title categories receive a qualifier. Filters distinguish a present numeric score (including zero), a present category without a score, and an absent category. No score is inferred for product or segmentation outcomes.
- Numeric category ranges are inclusive and require a selected category. Invalid/reversed ranges show an error and disable export. Choosing missing/unscored clears and disables the range. Clear filters resets the whole directory and pagination.
- Existing 25-row display pagination remains. CSV always exports every matching response across all pages. Existing columns, consent proof and formula escaping remain intact; `startSource`, `startCampaign` and `activityHistory` are appended after the existing columns.
- Expanded contacts show source/campaign and at most five retained facts: quiz start, contact details recorded, response recorded, first recorded result interaction, and first result-action click recorded. Their actual timestamps determine the order, including contact capture after results.
- The interface explicitly calls this a partial history. A result interaction is not claimed to be a separately verified page view: the existing offer-click writer may populate the same timestamp. No per-question duration, email delivery/open, PDF download or report-link creation event is invented.

## Data and privacy contract

The owned quiz route now returns `{ contacts, contextByResponse }` with `Cache-Control: private, no-store`. Each sidecar is keyed by the canonical retained submission record ID. The submission remains authoritative: an orphan/cached attempt or shared email cannot recreate a deleted response or merge people.

At most eight retained-attempt reads are active at once. The join requires the same response ID, owner, quiz ID and an explicitly non-preview attempt. Missing, foreign, wrong-quiz and preview records supply no history or attribution. The sidecar projects only normalized source/campaign, a history availability flag, an incomplete flag and allowlisted event timestamps; no answers, form snapshot, cached result, bearer URL or extra contact information is copied into it.

Timestamps must be real ISO calendar dates or safe integer attempt timestamps, not future times. Impossible dates (for example February 30), invalid offsets, and causally inconsistent facts are omitted and flagged. Genuine timezone offsets are accepted and normalized to ISO UTC. An unreadable record is different from a missing one: workers drain, the route returns a generic 503, and the client keeps its last loaded list with export disabled until a successful retry. No private storage error is exposed.

The client rejects nonempty successful responses with missing or incomplete context rather than silently exporting an all-unknown cohort. **Deploy this client and route together.** An old cached/server `{ contacts }` payload with nonempty contacts is intentionally a retryable read failure. An empty legacy `{ contacts: [] }` remains accepted. Existing mocked browser tests have no nonempty old success payloads requiring migration; the new suite deliberately tests this failure contract.

## Implementation files

- `components/ContactsStudio.tsx`
- `lib/contact-filters.ts`
- `lib/contact-context.ts` (new pure projection, validation, facet and export helpers)
- `lib/contact-context-store.ts` (new owned retained-record join)
- `app/api/forms/[id]/contacts/route.ts`
- `tests/contact-context.cjs`, `tests/contact-context-api.cjs`, `tests/browser-contact-cohorts.cjs`

No schema, engine, player, generic record adapter, contact capture writer or shared CSV writer changes.

## Validation

- `node tests/contact-context.cjs`: **9 scenarios passed**, including allowlisting, attribution distinctions, strict dates and chronology, malformed sidecars, combined cohorts, null/zero/missing categories, historical labels, invalid ranges, all-matched export, consent proof and formula safety.
- `node tests/contact-context-api.cjs`: **5 scenarios passed** using mocked local records and the real route/helper: ownership and canonical IDs, eight-worker bound and drainage, authentication, deleted-response non-restoration, generic read/list failure and retry, empty directory.
- `node tests/contact-filters.cjs`: **11 existing scenarios passed**.
- Scoped ESLint on all five implementation files: passed.
- `node --check tests/browser-contact-cohorts.cjs`: passed.
- `tests/browser-contact-cohorts.cjs`: passed on the parent-owned batch8 compiled server at port3163 in Chrome, first run. Uses 38 synthetic responses and zero public starts. Verified source/campaign/category AND filtering, all-30 matching CSV identity and consent/formula safety across two pages, null/missing/zero semantics, unknown versus reserved literal values, correct after-results chronology, missing/foreign/preview history, keyboard/Escape focus, 390px width, malformed success retry and stale mount cancellation. No page errors.
- `tests/browser-contact-filters.cjs`: existing compiled browser regression passed, first run. Its 62 synthetic historical responses retain owner isolation, existing filter combinations, 25-row pagination, mode-aware export, consent, formula escaping, empty/error/retry states, keyboard detail and mobile width behavior.
- Visually inspected desktop and 390px activity screenshots plus the expanded mobile filter screenshot: labels and controls wrap without horizontal overflow. Parent independently owns the combined accessibility/reflow scan.
- Parent's accessibility scan found an existing expanded-contact definition-list error in all four widths: the Response ID helper paragraph sat outside its `dd`. Moved the ID and helper inside that `dd`, preserving their individual styles; scoped lint passes. Final combined rebuild/accessibility verification is parent-owned. Filter states had no violations in the initial scan.
- After the final semantic-fix build, `tests/browser-contact-result-links.cjs` passed unchanged: correct selected contact, keyboard focus/return including collapsed contact reopening, retained filters, delayed prior-response isolation, named cancellation/confirmation, other-response protection and mobile width. Zero public starts.

Compiled evidence: `../pippi-overnight-2026-10-12/compiled-verification-batch-8/contacts/browser-contact-cohorts-initial.log` (successful first run), `browser-contact-filters.log`, `cohorts/activity-desktop.png`, `cohorts/activity-mobile.png`, `cohorts/filters-mobile.png` and `cohorts/matching.csv`. Fixtures were removed after each suite.

Final-build shared UI regression evidence: `contacts/browser-contact-result-links.log` and screenshots in `contacts/result-links/`. Pure helper/API suites were re-run to preserve successful logs in the same evidence directory: `contact-context.log` (9), `contact-context-api.log` (5), `contact-filters.log` (11).

## Boundaries

This adds bounded concurrent history reads, not a bounded total query. The current record adapter still scans retained submissions, and contacts/filtering remain an all-loaded client collection. Server query pagination and indexes are a separate scaling task. Retention is unchanged: expiry of an attempt capability does not itself mean the record was deleted. No automatic retention or new tracking is introduced.

Answer-specific cohorts are deliberately deferred until they can use frozen question/option versions, rather than formatted answer strings or the current draft. Persistent saved segments, cross-quiz people profiles, email/CRM activity and bulk messaging are outside this batch.
