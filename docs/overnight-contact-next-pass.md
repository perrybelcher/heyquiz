# Next contact improvements — read-only proposal

Reviewed the current local record model after batch 7. No application files, records, providers or cloud services were changed. This is a proposal, not completed functionality.

## Recommendation

Implement **source/campaign and category filters plus a short recorded-activity list** first. Use an owner-checked metadata join to existing retained attempts; no new public tracking or database schema is needed. Then add **one discrete-answer condition** using the same join. Avoid a general audience-rule builder or an invented full event timeline.

Keep the existing directory, 25-row pagination, all-matching CSV, date/result/overall-score/consent/search filters and saved-result-link action. Put the extra conditions behind one “More filters” disclosure and show activity inside the existing expanded contact. Each row remains a response, not a deduplicated person; repeated email addresses must not merge histories.

## What is available and what is missing

| Area | Current evidence | Smallest missing part |
| --- | --- | --- |
| Contact filtering | `lib/contact-filters.ts:4` and `:71` have search, consent, local-calendar date, historical result and mode-aware overall score conditions. `ContactsStudio.tsx` already resets/clamps pages and exports every match. | Add new conditions to this same combined pipeline, not a second list/export implementation. |
| Source and campaign | `Attempt.attribution` is retained with the frozen form (`lib/attempts.ts:6`). `lib/analytics-filters.ts:27` already produces distinct UTM-source/referrer/campaign/unknown keys. | Contacts API currently returns only submissions (`app/api/forms/[id]/contacts/route.ts:12`); there is no attribution on `QuizSubmissionResult` (`lib/schema.ts:494`). Join the corresponding retained attempt and reuse the existing dimension semantics. |
| Categories | `row.marketing.categories` already stores historical titles, numeric or null scores and coverage. CSV already includes saved category scores (`lib/contacts.ts`). | A category selector plus its own score-availability/range condition. Overall-score controls cannot answer “low in this specific area.” |
| Answers | Submission `answers` contains saved raw IDs; `grading` contains historical question titles and formatted answers (`lib/schema.ts:482`). The attempt retains original option IDs/labels and routing. `lib/analytics.ts:18`–`:76` already distinguishes wording versions, skipped/unanswered/unavailable/invalid choices for aggregate reporting. | No contact answer filter. Exact option identity requires the retained question snapshot; parsing formatted `grading.userAnswer` or using today's question/options would misclassify history. |
| Activity | Attempts retain start, completion, first result interaction, first offer click and a last question-view timestamp. Contact `recordedAt` and submission `submittedAt` survive separately. | No owner-facing activity projection. There is no complete event stream or timestamp per answer/question. |

## Safe first implementation

Add a server helper returning the existing `contacts` array plus a small `contextByResponse` sidecar. Derive authoritative response IDs from stored submission records, then join the same record ID in `attempts`. Validate **owner, quiz ID, response ID and non-preview status** on every join. The retained contact-bearing submission is authoritative; never restore a deleted response or contact from `attempt.result`, reports, matching email addresses or orphaned attempts.

Allowlist only source/campaign keys and labels, optional publication timestamp, and the handful of valid event timestamps. Do not send the whole attempt, frozen form, tokens or cached result to the browser. Missing/invalid metadata yields an explicit unavailable state; a failed record read must surface an error rather than silently classify a whole cohort as unknown. Bound parallel reads. Keep `private, no-store`, existing auth/404 behavior and stale-request cancellation.

- **Source/campaign:** reuse `analyticsDimensions` and `analyticsFilterLabel`. “Unknown / not recorded” includes missing attribution; it is not “Direct.” Keep real labels named `unknown` or `all` distinct with the existing typed keys. These are start-session labels, not verified first-touch or cross-device attribution.
- **Category:** select saved category ID plus saved title, with duplicate-title qualifiers like the existing result selector. Filter the saved category's percentage; null is never zero. Distinguish a present-but-unscored category from a response that has no such category. Product/segmentation/knowledge rows cannot fabricate category scores. Explain that these are scores recorded at completion; changing rules under an unchanged category name can produce different historical scoring versions.
- **Export:** use exactly the same matching response IDs as the visible list. Preserve existing columns/order, formula escaping and consent evidence. Append source/campaign metadata only; category scores are already exported. Do not add hidden raw tracking data or credentials. Refresh failure continues to disable export.

## Factual activity labels

Use a short chronological list with device-local dates, explicit missing-history text and no new collection:

1. **Quiz started** — valid retained `startedAt`.
2. **Contact details recorded** — retained `contact.recordedAt`; label the actual marketing permission separately. After-results capture may correctly appear after completion.
3. **Response recorded** — authoritative `submittedAt`; do not create a duplicate completion event from the attempt's nearly identical `completedAt`.
4. **First recorded result interaction** — retained `resultViewedAt`. It must not be called a separately verified page view: `progress/route.ts:30` also sets it when an offer click arrives without an earlier view event.
5. **First result-action click recorded** — `offerClickedAt`. A click is not a purchase, successful destination load or conversion outside Pippi.

Optional supporting text may say how many distinct questions had recorded view events. `reached` has no timestamps and is deduplicated; do not present a timed question-by-question history. `lastSeenAt` means the last recorded question view, not the person's latest activity. Omit malformed/future/causally inconsistent events and disclose unavailable history. Do not label report `createdAt` as link creation: `lib/result-reports.ts:64` sets it to submission time. Saved-report reads, native downloads and email opens have no such event history here. Keep link management in the existing control.

## Bounded answer-filter follow-on

Add one question-version/answer selection, combined with existing conditions by AND. Start with supported single/multiple discrete choice questions; exclude free text, email/name/address/password, uploads, hidden fields and matrices. Multi-select means “contains this selected option,” not exact set equality. Do not reinterpret a questionnaire checkbox as marketing permission.

Version identity must include original question ID/type/title and sorted option IDs/labels, consistent with current aggregate answer patterns. Reordered options should not create a new wording version; renamed/reused IDs must not silently merge. Use raw retained submission answers, frozen routing and the historical snapshot to validate applicability. Unknown snapshot/answers stay unassignable; skipped, unanswered and invalid values must not match a chosen option. Keep those availability counts visible. Do not backfill from cached attempt results or infer IDs by splitting formatted answer strings.

## Ownership scope and acceptance

One implementation lane can own `components/ContactsStudio.tsx`, `lib/contact-filters.ts`, a new shared DTO/pure projection helper (for example `lib/contact-context.ts`), a server-only join helper, and `app/api/forms/[id]/contacts/route.ts`. A narrow `lib/contacts.ts` append-only export change is optional. Reuse `analytics-filters`, `attribution` and engine helpers read-only. No change to `QuizPlayer`, public progress routes, result-report access, `schema.ts`, integrations or record adapter is required for the first slice. Coordinate any shared answer-signature extraction before touching `analytics.ts`.

Required synthetic checks:

- Foreign owner/form, preview, mismatched record IDs, orphan attempts and deleted submissions never produce context or a contact; repeated emails retain separate histories.
- UTM versus referrer fallback, literal reserved words, absent/invalid attribution and missing attempts; old contacts stay visible with all filters clear.
- Category null/zero/100, missing categories, historical names/duplicate titles and mixed quiz modes; AND combinations with current date/result/consent filters.
- Timeline before/after-results capture, absent timestamps, malformed/future dates, click-without-view, no invented per-question or report-link creation event.
- More than 25 matches: correct pagination and all-matching CSV with unchanged column order/consent/formula safety; cancelled/stale refresh and error recovery.
- Answer follow-on: renamed/reordered/reused options, multi-select containment, branching skips, missing snapshot/raw answers and malformed values.
- Compiled desktop/390px browser and keyboard/Escape/focus checks; existing contact filters, saved-link selection and accessibility suites remain green. No email or provider calls.

The existing endpoint still loads the full retained contact set, and owner record listings are scans. This proposal does not claim large-account scalability or add a retention scheduler. Attempt token expiry (24 hours) is not deletion of the stored attempt; missing retained history remains a normal supported state. Saved/cohort presets, arbitrary boolean rule groups, cross-quiz people profiles and additional tracking belong in later separate work.
