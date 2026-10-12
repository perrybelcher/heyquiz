# Publication receipt race — batch 18

12 October 2026. The receipt lane reproduced a stale closure bug, then made a narrow owner-only response/helper repair. No storage, form schema, revision system, public URL, scoring, provider, email or deployment behavior was changed. Root owns combined builds/staging; the separate UI lane owns the guided publish/share flow and confirmation dialog.

## Reproduced finding

`EditorStudio.handlePublish` captured its rendered `form`, awaited `saveNow(form)`, posted to the publish endpoint, then set the live fingerprint from the captured local object. The autosave contract can drain newer edits before resolving, and another owner tab can save after this tab's save but before the server reads the draft. The endpoint previously returned only `success` and `url`, so the UI had no receipt identifying the normalized content actually published.

The deterministic diagnostic executes the actual extracted source `handlePublish` with controlled async save/response boundaries and the actual publish route/storage logic over in-memory records. It does not execute the React autosave hook or claim a browser reproduction of the held-save schedule; that schedule models the hook's existing drain contract. The other-tab schedule requires only a changed saved draft before the real route read. No network or persistent records are used.

| Controlled schedule | Actual retained content | Before-fix status |
| --- | --- | --- |
| Handler captures A; pending save drains newer B before resolving | Local B, published B | Incorrectly claims unpublished changes |
| Handler captures local A; another owner tab saves B before POST reads | Local A, published B | Incorrectly claims up to date |
| Handler captures A; publication commits A; local draft becomes B while response is pending | Local B, published A | Correctly reports a difference; retained as a regression boundary |

Before evidence is under `compiled-verification-batch-18/receipt-before/source-handler.log`. The default acceptance assertion fails on the old handler/endpoint, preserved in `regression-fails-before.log`. The special `PUBLICATION_RECEIPT_BASELINE=1` observation mode is before-evidence only, not an accepted regression pass.

## Implemented receipt contract

Successful `POST /api/forms/[id]/publish` retains the existing `{ success: true, url: "/play/<id>" }` fields and adds:

```ts
publication: { version: 1, formId: string, fingerprint: string }
```

The route first awaits the existing `publishForm` write, then derives `fingerprint` from the same captured server form it passed into that write. `publishForm` only adds `publishedAt`, which the existing comparison deliberately excludes. The route does not reread a potentially newer draft or guess from a client object. All success/error responses are `Cache-Control: private, no-store`. Authentication and owner checks remain in place; errors have no receipt. Existing callers that read only `success`/`url` remain compatible.

This fingerprint is **canonical normalized full-form JSON, not a cryptographic digest**. It excludes the comparison's existing storage metadata and preserves its existing key/order semantics. It can include owner-authored quiz/settings content. It must remain only in the authenticated owner response and volatile comparison state: do not display it, log it, put it in a URL/localStorage or add it to public props. The existing authenticated editor already receives this canonical comparison through its page initialization; the change does not introduce a public endpoint for it.

`lib/publication.ts` now exports `PublicationReceipt`, `parsePublicationReceipt(value, expectedFormId)` and `PUBLICATION_CONFIRMATION_ERROR`. Parsing requires the exact wrapper keys/version/quiz identity, valid form content and canonical normalization. It validates original JSON without substituting schema defaults, so older stored content with missing newer defaults is not silently altered or rejected solely by those defaults. Unknown wrapper fields, foreign identities, malformed/noncanonical content and missing receipts fail.

Current form POST/PUT and owner reads have no shared body/content maximum. The parent explicitly chose **not to add a new publication size limit** in this repair. The provisional 2 MiB guard was removed before final source freeze; the regression verifies a valid receipt above that size. Existing unbounded owner form size and canonical response cost remain an operational limitation. This note makes no bounded-payload claim.

## UI handoff and remaining races

The UI owner uses only the validated returned fingerprint for the request's live identity and separately validates successful response `success` and public URL. A missing, malformed, foreign or unreadable successful response can mean publication already happened. It must not display success or assign a guessed up-to-date/unpublished label. The shared message is:

> Publication may have completed, but its confirmation could not be verified. Keep your draft and refresh this editor to check the published version before publishing again.

The UI's transient unverified state preserves the draft and prior known state, labels publication as needing a check, and prevents blind publication retries until refresh. It is not a persisted form field. The current source-extracted handler tests cover missing/foreign/unreadable 200 responses, no success modal, unchanged live identity and that explicit unverified state.

A receipt identifies **the snapshot written by this request**, not a subscription to the latest cross-tab publication. Another publisher or a pause after this request can still make the local view stale until refresh. This repair adds no cross-record transaction, last-writer prevention, new revision guarantee or cross-tab synchronization. It preserves the distinction between saving the draft and publishing a snapshot.

## Acceptance at service freeze

- `tests/publication-receipt.cjs`: five groups pass using the actual extracted UI handler, actual route/storage implementation and in-memory rows. Coverage includes the three async identity schedules, strict and legacy/large receipt parsing, missing/foreign/unreadable 200 responses, a draft changing during the server publication write, and owner/origin/write errors. The test verifies content identities and boolean status conclusions; it does not print the canonical fingerprint content.
- Existing `tests/publication-pause.cjs`: 9 checks pass, preserving pause/resume, old sessions/reports, stable URLs, idempotence, owner/origin protection and publication availability.
- Scoped ESLint of the helper/route passes. TypeScript passes at this source check.
- Logs are under `compiled-verification-batch-18/receipt-final/`: `final-count-corrected.log`, `pause-regression.log`, `lint.log`, `typecheck.log`. Earlier `final.log` had the same passing checks but an incorrect six-group summary; the corrected rerun reports the actual five groups. Initial intermediate failures are retained (including an extracted-handler test harness update when the independently owned UI added its transient state).
- Compiled browser guided Share/navigation/modal/clipboard/accessibility coverage is owned by the UI/QA lanes and is pending at this receipt source freeze. No production or human usability conclusion is inferred from this source test.

Owned application files: `lib/publication.ts` and `app/api/forms/[id]/publish/route.ts`. Owned new test/document: `tests/publication-receipt.cjs` and this note. Installed Next Route Handler guidance and AGENTS were read. The current storage behavior was inspected read-only; there were no adapter or Supabase changes.

## Independent UI source review after the combined build

The receipt lane separately read the new `PublicationConfirmation`, its `EditorStudio` transitions and the guided handoff. No actionable blocker was found within this change. The native dialog closes before the parent schedules restoration/navigation; delayed focus avoids a newer deliberate focus target or another open dialog and resolves a visible replacement opener after a responsive change. Clipboard completion uses both a sequence and mounted guard, and delayed rejection does not move focus away from a newer control. The successful-but-unverified response path retains the draft and previous fingerprint, labels the state as needing a check, disables further publish/pause actions and does not show a success dialog. The separate QA suite covers these browser transitions, including a held clipboard rejection, responsive opener replacement, Escape, Share return and malformed successful responses.

The parent reported that the combined batch 18 build and full ESLint passed, and its independent actual-HTTP fixture passed four groups, with three returned receipts matching retained published snapshots. The parent did not log private receipt bodies. Cross-engine browser acceptance was still in progress at this review handoff; that result belongs in the central batch report.

One existing limitation remains outside this bounded repair: a network rejection before any HTTP response reaches the browser is still handled as a normal publish failure. The server could have committed before that disconnect, but the current uncertainty gate is deliberately limited to a received successful response that cannot be verified. This is not a new regression or a claim that all distributed failure cases are solved.
