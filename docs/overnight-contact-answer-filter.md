# Historical answer contact filter

Batch9, 12 October 2026. Implemented locally with synthetic tests. No provider calls, email, production writes, new tracking or schema changes.

## Behavior

More filters now contains one **Saved question version** and **Selected answer** condition. A complete pair combines by AND with existing consent, date, search, saved result, score, source, campaign and category filters. Choosing a question alone leaves the condition inactive with an explicit prompt to choose an answer. Multi-select means “includes this selected option.” Clear filters clears both fields.

Versions use frozen question ID/type/title plus sorted option IDs and labels, preserving the existing analytics SHA-256 version ID exactly. Shuffled/reordered options remain the same version; renamed or replaced questions/options do not merge. Saved-version suffixes distinguish question wording, and equal option labels receive option-ID qualifiers. The current draft does not rewrite historical membership.

Supported types are the seven existing single-choice types and three multi-choice types: multiple choice, picture choice, dropdown, segmented, switch, like/dislike, thumbs, multi-select, checkboxes and image multi-select. Standalone checkbox/terms, text/contact/password, hidden fields, ratings/ranges, matrices/ranking and uploads remain outside this filter. Separate marketing consent controls keep their existing meaning.

Coverage counts distinguish valid answered, unanswered, skipped by saved quiz logic, other version/question absent, unavailable history and invalid answers. Counts describe all retained contacts in this quiz; final visible matches still use every active condition. No missing value is inferred as an answer. A partially invalid multi-answer is invalid as a whole; duplicate valid IDs count once; finite numeric legacy single answers are matched by their saved option-ID string.

## Projection and safety

The existing owner-checked eight-worker attempt join now collects answer catalog metadata and one requested option membership set. Retained submissions remain authoritative. Same response ID, owner, quiz and non-preview checks are unchanged; cached attempts, orphan records and matching emails cannot restore a deleted contact.

`answerCohort` contains only catalog IDs/titles/types/option labels, availability/omission counts, the echoed selection and matching canonical response IDs. It does not include raw person answers, arbitrary form content, logic rules, media, scoring keys, cached results or bearer links. Existing contacts and activity context remain in the same atomic response.

The catalog sends at most 60 versions and 100 options per version, with explicit omission counts. A valid active version/option is pinned into the bounded result on refresh. Projection rejects malformed/ambiguous snapshots rather than truncating identity: at most 200 questions, 1,000 options per supported question, 2,000 characters per saved title/option label, 1,000 routing rules and 200 pages. Invalid duplicate IDs or unsupported/malformed historical structure become unavailable. Catalog bounds are output bounds, not a claim that all retained-record scanning is bounded.

Frozen `resolvePath` determines eligibility. Show/hide rules, jumps and saved page order apply; malformed routing or loops yield unavailable history. Two intentional engine-compatible exceptions remain: unknown/missing question page IDs use the engine’s first ordering bucket, and `jump_to_ending` stops the path even when its optional outcome target is missing/unknown. These reproduce the path used when the response was graded; an outcome target does not determine later-question eligibility. Neither tracked `reached` nor formatted `grading.userAnswer` substitutes for raw retained submission answers.

GET accepts only a complete, unique `answerVersion`/`answerOption` pair. Invalid parameters fail before record scans; stale/deleted selections return a clear 400 with directions to choose another answer or clear the filter. Storage errors remain generic 503s after workers drain. Auth and quiz ownership still precede historical reads.

The client validates the returned catalog, selected pair, coverage total and matching IDs. It installs contacts/context/membership together and aborts obsolete requests. Pending, failed or mismatched membership cannot enable export; selecting a new option never exports the previous option's contacts. CSV still uses all matching rows across pages, without adding raw answer columns or changing existing column order, formula neutralization or consent proof.

Deploy the updated client and contacts route together. Nonempty older responses lacking `answerCohort` are intentionally retryable failures; empty legacy contact payloads remain accepted. No silent all-contacts fallback is permitted for an active answer condition.

## Files

- New `lib/answer-history.ts`: extracted canonical choice/signature/value helpers, with analytics semantics preserved.
- New `lib/contact-answer-cohort.ts`: browser-safe DTO, labels, query and response validation.
- New `lib/contact-answer-cohort-server.ts`: bounded retained-snapshot catalog, branching classification and membership collector.
- Narrow integration in `lib/analytics.ts`, `lib/contact-context-store.ts`, `lib/contact-filters.ts`, `app/api/forms/[id]/contacts/route.ts` and `components/ContactsStudio.tsx`.
- New `tests/contact-answer-cohort.cjs`, `tests/contact-answer-api.cjs` and `tests/browser-contact-answers.cjs`.

Schema, engine, player, record adapter, shared CSV writer and styles are unchanged.

## Validation

- `tests/contact-answer-cohort.cjs`: **12 scenarios passed**. Exact signature/hash compatibility, all ten types, numeric legacy singles, malformed values, frozen routing/page order including page fallback/optional ending targets, missing/other versions, bounded privacy projection, same-label options, 60/100 limits and pinning, query/client validation, AND filtering and all-matched safe CSV.
- `tests/contact-answer-api.cjs`: **6 scenarios passed**. Actual route with mocked records/auth: atomic sidecars/canonical ownership, eight-worker bound, pre-read query rejection, authentication, storage failure/retry, deletion non-restoration and stale selection.
- Existing `tests/analytics.cjs`: **30 checks passed** after extraction, including boolean checkbox analytics (still supported there), branching, shuffled wording, historical labels and aggregate privacy.
- Parent independently compared the batch8 analytics implementation with this extraction: **558 aggregate output comparisons passed**, covering answer types/shapes, historical edits, branching, typed cohorts and missing/deleted/preview/future cases (`analytics-extraction-parity.log`).
- Existing contact suites: context **9**, context API **5**, filters **11** passed.
- Scoped ESLint passed on all eight implementation files. `tsc --noEmit --incremental false` passed. New browser test syntax passed.
- `tests/browser-contact-answers.cjs`: **passed first run on the combined compiled batch9 server** in Chrome. Uses 44 synthetic contacts and zero public starts. Verified 30 exact all-page CSV matches, combined answer/source/campaign/consent conditions, six coverage states, multi-select containment, delayed obsolete option responses, pending export, failure/retry, keyboard focus/Escape and 390px layout. No page errors.
- Existing `tests/browser-contact-cohorts.cjs` and `tests/browser-contact-filters.cjs` both **passed unchanged** on the same compiled build. Their 38/62 synthetic responses verify prior cohort/activity behavior, malformed/empty responses, pagination, safe CSV and missing-legacy-history compatibility under the expanded response contract.
- Inspected desktop and mobile screenshots of the new historical answer controls: controls and coverage copy wrap cleanly without horizontal overflow. Parent independently owns the accessibility/reflow scan.

Compiled evidence: `../pippi-overnight-2026-10-12/compiled-verification-batch-9/contact-answers/browser-contact-answers-initial.log` (successful first run), `browser-contact-cohorts.log`, `browser-contact-filters.log`, plus `new/answer-filter-desktop.png`, `new/answer-filter-mobile.png` and `new/answer-matches.csv`. All synthetic fixtures were removed after each run. Application sources remained frozen during these browser checks.

## Limits

Only one positive option-membership condition is supported. There are no arbitrary condition groups, persistent saved cohorts, text searches over raw answers, automatic backfill or new event tracking. Historical catalog omissions and unavailable snapshots are visible. Large-account query/index work remains separate; the contacts directory still loads retained contacts before local combined filtering.
