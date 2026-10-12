# Saved contact filters: bounded proposal

**Current status:** the bounded design was implemented in batch14. See [service/API evidence](overnight-saved-segments.md), [editor evidence](overnight-saved-segments-editor.md) and [batch14 acceptance](overnight-batch14-quality.md) for verification status. The planning and batch13 statements below remain historical; no deployment is implied.

Status: read-only design, 12 October 2026. The saved-segment feature remains unimplemented. A separately authorized historical-result display correction is recorded below. Reviewed `contact-filters.ts`, the contact context and saved-answer helpers, `ContactsStudio.tsx`, the contacts API, record CAS behavior, form deletion, and the durable report retirement receipt. Read `AGENTS.md` and the installed Next.js route-handler guide. No cloud data, provider calls, credentials, email, or production writes were used.

## Recommendation

Add **Saved filters** to the existing contact directory. A saved segment is a name plus the current supported filter definition. Applying it runs the existing contact filtering logic against the current retained contacts. It is not a frozen contact list, an automation, a new rule builder, or a promise that its membership stays constant.

Ship at most 20 definitions per quiz. Use one owner-scoped record containing the whole bounded set and one optimistic revision. That gives a reliable quota and prevents two tabs from silently overwriting each other. Keep the existing contact evaluation, date behavior, historical identities, pagination, and CSV output.

Accepted next-pass design decision: the bounded version will refuse saved-segment operations for a quiz ID that has ever been deleted. Normal newly generated quiz IDs are unaffected. Reusing a retired quiz ID cannot resurrect old definitions. Supporting that unusual API-level reuse requires a separate immutable form-incarnation mechanism; do not infer incarnation from mutable creation dates or a deletion timestamp.

## Scope and user flow

Place a labeled Saved filters select and Apply button above the existing directory filters, with Save current filters, Rename, Update saved filters, and Delete actions. Keep naming/edit controls inline so this does not become another editor. Delete requires a confirmation naming the selected definition; it deletes only that definition, never contacts.

- Applying replaces the current filter set in one state update, clears transient contact search, resets pagination to page 1, and reveals More filters if required. State clearly beside Apply: “Applying saved filters replaces the current filters and clears contact search.”
- Saving requires a name and at least one non-default supported criterion. It may match zero contacts. No contact count is saved or used as an eligibility check.
- Free-text search is not persisted because it searches name, email, and phone. While search is nonempty, disable Save/Update and explain “Clear contact search before saving filters.” Never silently strip search while claiming to save the current selection.
- After applying a definition, changing controls marks it as modified. Saving changes requires the explicit Update action; applying or editing filters never writes automatically.
- Keep dates absolute, with the existing full-day/device-timezone explanation. A saved date range is not “last 30 days”; its UTC boundaries can differ on another device. No new relative-date semantics in this pass.
- A failed saved-filter request leaves ordinary contact filtering available. A stale revision prompts the owner to reload the saved list before retrying; it must not discard current filters or an unsaved name.
- Accessible labels, status announcements, errors associated with inputs, keyboard focus after deleting a definition, and a 320-pixel/200% layout are part of acceptance.

## Data contract

Proposed record kind: `contact_segments`. Record ID: SHA-256 of JSON `[ownerId, formId]`. The adapter wrapper retains authoritative `owner_id` and `version`; neither comes from the request body.

```ts
type StoredContactSegmentSet = {
  schemaVersion: 1;
  formId: string;
  segments: Array<{
    id: string;              // server-created UUID
    name: string;            // trimmed, 1–80 characters
    createdAt: string;       // server timestamp
    updatedAt: string;       // server timestamp
    filters: Omit<ContactFilters, "query">;
  }>;
};
type ContactSegmentResponse = {
  schemaVersion: 1;
  revision: number;          // authoritative record wrapper version
  segments: StoredContactSegmentSet["segments"];
};
```

No response IDs, contact fields, raw answers, snapshot content, membership arrays, totals, or tokens belong in this record or API. Existing exact result/category keys contain quiz-authored identity and historical wording; source/campaign values are current supported attribution dimensions. A business label can itself contain sensitive text, so the UI should ask for a short descriptive label without asserting it can technically classify or remove all personal information.

Suggested hard bounds: 20 definitions, 16 KiB mutation request, 128 KiB serialized aggregate, names 80 characters, result/category keys 4,096 characters each, source/campaign 320 characters each, dates 10 characters, and score-limit strings 32 characters. Oversized legacy values get a clear save error; do not truncate or broaden them. Reject duplicate normalized names within the set to keep selection unambiguous. Keep an empty aggregate record after deleting the last definition so its revision never resets.

## Strict filter validation

Use a small shared schema for only the existing fields: consent; absolute from/to; saved result; overall score state/range; source/campaign; saved category state/range; saved question version/answer option. Reject unknown keys, `query`, invalid types, malformed identities, and oversized values. Do not accept arbitrary predicates or free-answer comparisons.

Reuse `contactFilterError` and the current evaluator for date/range behavior. Add persistence-specific validation for cases the interactive UI does not save as a complete definition:

1. A saved-answer pair must contain both valid `answer-version-<20 hex>` and option ID, or both must be empty. Selecting a question alone currently means “choose an answer to apply”; it must not become an apparently active saved answer segment.
2. Reject overall `unscored` with numeric score limits; the evaluator currently ignores those limits and the normal UI clears them. Reject category ranges with missing/unscored states as the existing validator already does.
3. Parse result keys as the exact `[kind, identity, historicalTitle]` tuple and category keys as `[identity, historicalTitle]`, preserving their canonical exact values. Do not replace historical identity or wording with the current draft's choices.
4. Validate typed source/campaign values using existing analytics query validation. Empty means all; `unknown` means not recorded. Literal labels “all” and “unknown” remain distinct through `utm:`, `ref:`, and `value:` prefixes.
5. Do not require a saved result/category/source/campaign to appear in today's option list. A valid historical definition can legitimately match zero retained contacts.

## One collection API

Use `/api/forms/[id]/contact-segments` with Promise-based route params, `requireUser`, explicit owned live-form lookup, and private/no-store responses. Mutations also use the existing same-origin guard. Owners of other quizzes and anonymous callers cannot list or mutate a set.

| Method | Strict body | Result |
| --- | --- | --- |
| GET | None; no query parameters | Current bounded set and revision; absent record returns empty set/revision 0 |
| POST | `{ revision, name, filters }` | Add server-generated definition and return committed set |
| PATCH | `{ revision, id, operation: "rename", name }` or `{ revision, id, operation: "replace", filters }` | Change only the requested definition |
| DELETE | `{ revision, id }` | Remove only the requested definition, retaining aggregate record/revision |

The client never submits the full aggregate, owner ID, timestamps, or a client-chosen new segment ID. The service reads and validates the current set, checks quota/name/target, applies one operation, and calls `writeRecord` with the supplied expected revision. A competing quota fill, rename, delete, or update gets 409. Do not auto-retry mutations with the newest revision. Repeated stale delete also returns a clear conflict without touching another definition.

Malformed stored records and read failures fail closed as 503; they must not be treated as an absent empty set. Use stable safe errors without echoing definition content. Return 400 for invalid bodies, 404 for unknown/foreign form or target, 409 for stale revision/quota/name conflict, and 410 for a retired quiz ID as described below.

## Deleted and recreated quiz IDs

Existing form saves accept/preserve `createdAt`; it is not an immutable server incarnation. The durable `result_report_revocations` receipt advances by time, and repeated retirement within the same millisecond need not advance it. Therefore neither field can safely distinguish every delete/recreate generation for this feature.

Recommended narrow rule: a valid existing quiz-retirement receipt permanently makes this quiz ID ineligible for saved segments. Require a live owned form first; then strictly read/validate the owner-bound retirement receipt. The new service can read the established receipt key/schema through the record adapter, without changing deletion or result-report behavior. A malformed receipt must fail closed, not be interpreted as no retirement.

Check live ownership and retirement before returning a list or attempting a mutation, and recheck after writing. If deletion races a write, a definition may remain stored, but the durable receipt keeps it inaccessible in all later operations, including same-ID recreation and same-millisecond repeated deletion. A request already in flight may have read data just before deletion; this is not a claim of cross-record transactional deletion. No later request may revive it.

The UI message should be specific to Saved filters: “This quiz ID was previously deleted. Duplicate the quiz or create a new quiz to save filters.” Existing contacts functionality must remain usable. Old definition records stay private and bounded; no new cleanup task is proposed.

Any future requirement to support retired quiz IDs must first introduce a server-owned immutable form generation and coordinated deletion semantics. Do not ship an unreliable timestamp-based substitute.

## Historical choices, loading, and exports

The existing contacts request is scoped by form ID, refresh generation, and exact saved-answer pair, with AbortController and stale result suppression. Preserve those checks. Fetch the saved list independently and scope its state/mutation responses to form ID and request generation. Capture target segment ID and revision when starting Rename/Delete/Update; a later selection must not redirect the operation or let its response overwrite newly edited filters.

Saved-answer history that is no longer available currently produces 400 from the contacts API. Preserve the requested pair, show the actionable error, and disable export until the owner clears or changes it. Never silently fall back to all contacts. Missing non-answer options should remain visibly selected with an unavailable/zero label and retain exact filtering.

Applying a saved set must use the same `filterContacts` result for table, matching count, pagination, and CSV. Do not add a second membership implementation or a segment-count endpoint. While the matching answer request is loading, failed, malformed, or not associated with the selected pair, exports remain disabled. Add the same conditions as an early guard inside `exportCsv`, not only its button. A stale saved-list error by itself need not block CSV for an otherwise valid, fully loaded current contact filter. Bound requests to one active saved-list read per form; abort superseded reads and provide manual Retry without polling or an automatic retry loop. Mutations get one attempt at the supplied revision, never hidden CAS retries.

Separately scoped UI issue: `ContactsStudio.tsx:127` renders the saved-result select without a fallback option for a selected value missing from refreshed `resultOptions`. Source/campaign/category/answer selectors already preserve missing selections. If the final contact for result R is removed and the owner refreshes, `filters.result` remains R and returns zero matches, while the select can display its first “All saved results” option. The unchanged compiled app reproduced this behavior with mocked synthetic contact responses; the narrow correction and regression are described below.

## Proposed implementation ownership

For the accepted future implementation pass, one lane should own these files together:

- New `lib/contact-segment-schema.ts`: shared strict definitions/body/response parsing and normalization.
- New `lib/contact-segments.ts`: bounded owner-scoped record operations, lifecycle guard, CAS, safe errors.
- New `app/api/forms/[id]/contact-segments/route.ts`: collection API.
- New `components/ContactSavedFilters.tsx`: bounded management controls and request state.
- Narrow `components/ContactsStudio.tsx` integration: atomic apply, modified state, missing-result placeholder, export guard.
- New `tests/contact-segments.cjs` and `tests/browser-contact-segments.cjs`, plus feature documentation.

Keep `records.ts`, `storage.ts`, schemas, contact evaluator, scoring, analytics, tracking, player, auth, and current contacts API unchanged unless a separately reviewed correctness issue requires it. No new dependencies, migration, cloud action, scheduler, CRM work, or deployment is required.

## Acceptance before shipping

1. **Definition parity:** round-trip every supported field; compare current evaluator membership before/after save/apply across consent, exact historical results/categories, null versus missing category, score zero, date boundaries/DST, two sources/campaigns, unknown history, and a saved-answer pair. No contact or count fields serialized.
2. **Validation:** reject free search, incomplete answer pair, contradictory ranges, noncanonical/oversized keys, unknown fields, invalid dates/numbers, duplicate names, and malformed stored sets without broadening a selection. Preserve real dimensions named all/unknown.
3. **Ownership and origin:** anonymous, foreign owner/form, wrong origin, injected owner/timestamps/IDs denied; responses private/no-store; another quiz's set unchanged.
4. **CAS and quota:** simultaneous creates at 19 definitions yield one success and one conflict; two tab updates/renames/deletes cannot lose an edit or retarget; last deletion retains revision; stale revision cannot resurrect deleted definitions.
5. **Lifecycle:** delete then recreate identical ID cannot expose or mutate the old set; same-millisecond repeated retirement and interleaved delete/create/write remain denied; fresh unrelated quiz works; malformed retirement receipt fails closed; ordinary contacts remain available.
6. **UI persistence:** save/reload/apply/rename/update/delete through the compiled app. Switching quizzes during delayed GET/mutation cannot contaminate the next quiz. Applying then manually editing marks modified without autosaving.
7. **Historical and stale export:** remove the final matching result, refresh, and preserve an explicit zero-result selection; unavailable answer pair stays selected with error and no CSV. Delay answer A, switch to B, resolve out of order; table/count/full CSV must contain only B, with exports gated until B is ready. Failed contacts refresh never exports stale rows.
8. **Accessible small UI:** keyboard-only operation, labeled controls/errors/status, predictable focus on delete/cancel, long labels, 320-pixel and 200% reflow. No live participant sessions or emails are necessary for these synthetic owner/API tests.

## Limits kept explicit

This saves reusable definitions, not contacts, dashboards, bulk actions, notifications, or audiences synced to another service. It does not improve the existing full owner-row contact read or turn display pagination into backend pagination. Definitions can match different contacts as retained history changes. Absolute dates still use the viewing device's timezone. A retired quiz ID cannot use saved filters under the recommended minimal lifecycle policy. Saved-segment implementation, acceptance, and deployment remain unperformed at this planning checkpoint.

## Batch 13 historical-result display correction

The pre-fix compiled browser run confirmed the defect: after replacing the three-contact mocked response with the one unrelated contact, the matching table correctly fell to zero but the selected result element's value became the empty All choice. The expected historical identity was `["knowledge","earlier","Earlier plan"]`. The first failure and screenshot are retained under `compiled-verification-batch-13/contact-result-retention/before/`. This is a display mismatch, not evidence of broadened CSV output; export was already disabled at zero matches.

The authorized application change is limited to `components/ContactsStudio.tsx`: preserve the missing exact key as a “Previously selected result (0)” option and, following a successful refresh, explain that the filter remains active until cleared or changed. Existing matching, request cancellation, export gates, scoring, and API behavior remain unchanged.

New `tests/browser-contact-result-retention.cjs` creates one synthetic local quiz and mocks three contacts. It checks exact CSV membership before/after refresh, holds a request to test the existing loading gate, removes and restores the selected result, checks 503/malformed payload failure gates, releases a stale unmounted request, and checks a 390-pixel view. No contacts, attempts, or emails are written; no public quiz starts occur. The synthetic quiz and deletion receipt are cleaned in `finally`. The test already fails on the old compiled app at the missing-selection assertion. Final compiled verification passed against the batch 13 candidate at local port 3164; the new test syntax check, scoped ESLint, and full `tsc --noEmit` also passed. Their logs are retained beside the pre-fix evidence.

### Final compiled acceptance

The new regression passed from the clean candidate against the root-owned batch 13 compiled server. Evidence is under `compiled-verification-batch-13/contact-result-retention/after/`: `browser.log`, `results.json`, desktop/mobile screenshots, and three exact-membership CSVs. The retained `before/browser.log` fails at the intended selection assertion on the unchanged batch 12 build.

The final run proves the missing value remains selected as “Previously selected result (0)”, its explanatory status is visible, the unrelated contact does not appear in matching rows or CSV, restoring the result restores the original human label and exact two-contact membership, and delayed/503/malformed/stale responses preserve the existing export gates. There were no page errors.

A second run used an in-memory viewport-only change from 390 to 320 pixels, without changing candidate or application source, and passed the same checks. Evidence is retained in `after-320/`. Desktop, 390-pixel, and 320-pixel screenshots were visually inspected. At 320 pixels the browser truncates the long closed-select label within its native control, while the adjacent full explanation remains readable and controls fit their container. This run is not a broad accessibility audit.

Both runs used Chrome, one disposable synthetic quiz per run, three mocked contact records, and zero public starts, real contacts, cloud requests, emails, or provider operations. The current contacts API/record adapter were not changed or newly revalidated by this mocked-response test. Saved-segment persistence remains only the accepted next-pass plan; it has not been implemented or deployed. No further source edits remain in this lane.
