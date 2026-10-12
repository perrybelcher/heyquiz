# One historical answer condition — next bounded contact slice

Read-only plan after batch8. No application edits, calls to providers, new tracking or record writes. Source/campaign/category filters and recorded activity are already implemented; this proposal adds only one discrete answer condition alongside them.

## Recommended interaction

Inside the existing **More filters** disclosure, add **Saved question version** and **Selected answer**. A complete pair means “this response selected this option” AND every other active contact condition. For a multi-select question, it means contains this option, not exact-set equality. Changing question clears the answer; an incomplete pair is explicitly labeled “Choose an answer to apply this condition.” Clear filters clears the pair. No NOT, arbitrary AND/OR groups or saved segment builder in this slice.

Use saved wording and short “Saved version 1/2” qualifiers for otherwise indistinguishable titles. Qualify same-label options too; never merge distinct IDs. Preserve selection during refresh; if its version/option no longer exists among retained records, show an actionable unavailable selection, not an automatic reset to all contacts.

## Evidence and reuse

- `lib/analytics.ts` currently defines private `supportedAnswers`, `snapshotChoices`, `questionSignature` and the value-classification loop in `answerPatterns`. A signature is question ID, type, title and option IDs/labels sorted by ID. Option shuffling/reordering is not a wording change; renamed questions/options, removed options and ID changes are separate. Group IDs are `answer-version-` plus the first 20 hex characters of SHA-256 of that exact signature.
- `lib/engine.ts` exports `singleTypes`, `multiTypes` and `resolvePath`. The latter uses frozen pages/rules and earlier visible answers; a visibility/jump skip must not become unanswered. `attempt.reached` is tracking history, not authoritative branching eligibility.
- `app/api/forms/[id]/submit/route.ts` writes `result.answers = clean`: original selected IDs for the resolved path, excluding passwords. Optional absent values may disappear on JSON serialization. `grading.userAnswer` is formatted display text and cannot recover original IDs. The writer also permits timed-out responses with otherwise invalid values, so historical classification must validate values independently.
- Batch8 `lib/contact-context-store.ts` already joins each retained contact-bearing submission to its same-ID, same-owner, same-quiz, non-preview attempt using eight drained workers. Keep that single join and authoritative submission row. Never use cached `attempt.result`, a saved report, matching email, or the current draft to repair absent answers/snapshots.
- `tests/analytics.cjs` already covers historical wording, deleted options, distinct same-label options, duplicate multi-select IDs, branching, missing raw answers and invalid selections. Preserve those exact aggregate semantics while extracting helpers; contacts add a narrower supported-type policy.

## Supported scope and classification

First release supports the seven existing `singleTypes` (`multiple_choice`, `picture_choice`, `dropdown`, `segmented`, `switch`, `like_dislike`, `thumbs`) and three `multiTypes` (`multiselect`, `checkboxes`, `image_multiselect`), provided a usable frozen option list exists. Exclude `terms` and standalone `checkbox` in this slice, even though analytics supports their boolean answers: they are easy to confuse with separate marketing permission. Also exclude free text/contact/password, hidden/calculation, ratings/numeric ranges, matrices, ranking, uploads and display fields.

For a selected historical question version, classify each retained contact exactly once:

| Status | Meaning | Matches selected option? |
| --- | --- | --- |
| Answered | Version exists, frozen path includes it, value is valid for frozen options | Only if its validated selected IDs contain that option |
| Unanswered | Eligible, but undefined/null/empty string/empty array | No |
| Skipped | Version exists, but frozen resolved path excludes it | No, even if an old stray raw value exists |
| Other version / not present | Snapshot is usable but lacks this exact question version | No; distinguish from skipped |
| Unavailable history | Missing/unusable snapshot, absent/non-object raw answers, or unresolved/broken routing | No; never guess |
| Invalid answer | Eligible and nonempty, but wrong shape or unknown option IDs | No, including a partially valid multi-select array |

Match analytics' intentional legacy behavior: single values may be strings or finite numbers converted to option-ID strings; multi values must be arrays entirely of strings, deduplicated before matching. Numeric zero is not empty. Do not normalize labels, parse comma-separated display answers, trim option IDs, or salvage the valid subset of a malformed multi-answer. Empty snapshot options, duplicate option/question IDs, malformed identity/label values or ambiguous signatures should be unavailable rather than produce a broad match. A page/routing error must not silently fall back to question order.

Display concise counts for these statuses, clearly scoped to all retained contacts in this quiz (not the whole analytics funnel or current combined contact cohort). Analytics includes starts/completions with different date semantics; identical option percentages across the two screens are not promised. A selected answer's actual contact results and CSV still use the complete AND filter.

## Minimal projection and request design

Extend the existing owned contacts read, rather than send the full attempt/form to the browser or add a second independently timed response list:

1. In the existing bounded join, build an allowlisted historical version catalog from contact-bearing retained snapshots. Each catalog item needs only opaque version ID, saved question title/type, `multiple`, and option IDs/labels. Reuse the canonical signature; hash only on the server. No descriptions, scoring keys, images, logic, hidden values or raw free text enter this catalog.
2. Keep the catalog bounded to 60 versions and 100 options per version, matching current answer reporting limits. Include explicit omitted counts. The initial catalog may rank by retained contact count; a still-valid selected version/option must be pinned into the bounded result on refresh. If an item cannot be represented safely, show unavailable/omission rather than treat it as an unknown answer. Bound strings and snapshot complexity without silently truncating identity-bearing text.
3. Optional `answerVersion` + `answerOption` query parameters must be supplied together, be unique, syntactically bounded and belong to a retained eligible catalog. A stale/unknown selection returns a clear validation failure; it does not broaden the list. Catch storage errors separately as the existing generic 503. Validate authentication/quiz ownership before accessing history.
4. Return the normal contacts and activity sidecar plus an allowlisted answer-cohort result containing the echoed pair, status counts and **matching canonical response IDs only**. The client already receives these response IDs. Do not append per-person raw choices or entire per-question answer maps to the sidecar. When no condition is complete, return only catalog metadata, not a match map.
5. Add a single answer-membership predicate to `filterContacts`. Accept a response's match only when the response's returned pair exactly equals the active pair. Rows, contexts, catalog and answer membership are installed atomically from the same request. Abort/ignore stale requests when selection, quiz or refresh changes; keep export disabled while pending or failed. Old rows may remain visibly stale, never exportable under a new condition.

CSV remains the exact matching rows from the same final filtering pipeline, across all pages. Existing answers/consent/formula escaping and columns stay intact; no extra raw-answer column is necessary. This design does not solve all-contact listing scalability, but avoids a contacts × questions × options browser sidecar and adds no unbounded concurrent reads.

## Small ownership scope and extraction conflict

One lane can own new `lib/answer-history.ts` (pure canonical choice/signature/selection helpers), new `lib/contact-answer-cohort.ts` (server projection/query contract), the narrow join extension in `lib/contact-context-store.ts`, the contacts route, `lib/contact-filters.ts`, `ContactsStudio.tsx`, and targeted tests/docs. UI imports DTO types only from server-facing code; never pull `node:crypto`, analytics aggregation or records into a client bundle.

**Coordinate `lib/analytics.ts` before implementation.** Its helpers are private today, not a ready exported API. Extract the exact existing supported-choice/signature/value behavior once and use it from analytics and contacts; keep analytics' terms/checkbox support and hash format intact. Do not duplicate subtly different signatures in contact code. `resolvePath` and schema remain read-only. Validate malformed snapshots at the new contact boundary without casually changing analytics results for valid existing fixtures.

## Acceptance and verification

- Identical snapshots give the same existing answer-version ID. Reordered options retain it; renamed/reused/removed options and questions split; same-label options remain separately selectable.
- Literal expected contact sets for each supported single/multi type; numeric legacy IDs; duplicate multi selections; malformed scalar/array/object/nonfinite/partly invalid values; unanswered versus skipped versus other version versus unavailable.
- Frozen show/hide, jump-to-question and jump-to-ending fixtures, including stray answers on skipped questions, page ordering and broken historical loops. Current draft changes cannot alter saved membership.
- Same owner/quiz/non-preview checks, malformed canonical IDs, absent attempts/raw answers, deleted submissions/orphan attempts and repeated emails. No cached-data restoration and no sensitive snapshot/free-text data in the projection.
- More than 60 versions/100 options with explicit omissions and pinned valid selection; stale selected version after record deletion; duplicate/invalid query parameters; read failure and retry; two rapid selection changes with reversed response order; old-server/missing-sidecar contract.
- Combine selected answer with source/campaign/category/consent/date, exceed 25 matches, and assert exact exported response IDs with unchanged formula/consent fields. No export while new answer membership is pending, stale or invalid.
- Existing analytics and contact helper/API suites unchanged in meaning, followed by compiled desktop/390px keyboard, Escape/focus, dropdown labels, empty/no-match states and parent accessibility/reflow checks. Synthetic local fixtures only; zero public starts needed for most tests.

No separate high-priority application defect was established during this read-only review. The key implementation risk is allowing shared signature/classification extraction to drift from existing aggregate analytics, or using a stale answer-match map with a new UI selection.
