# Guided publication and sharing

Batch 18, 12 October 2026. Application changes are local. Compiled browser acceptance is owned by the independent QA lane and is pending the shared build.

## Completed application scope

- `EditorStudio.tsx` now makes **Embed & Share** open the existing Share tab from guided creation. It focuses **Share Your Quiz**, reuses the existing link and `QuizEmbedCode` controls, and offers **Back to guided Publish**. Returning focuses the guided Publish heading. The same in-memory form and autosave hook remain mounted. This temporary Share excursion does not overwrite the stored guided-mode preference; an intentional choice of Full editor still does.
- `GuidedQuizEditor.tsx` receives the same derived publication label used by the full editor and mobile header: **Draft · Not public**, **Published · Up to date**, or **Published · Unpublished changes**. Its Publish step explains the distinction between saving a draft and updating the public version, and offers sharing again without requiring another publication.
- `PublicationConfirmation.tsx` replaces the unlabelled overlay with a named native modal. The content describes the displayed link and embedding without claiming that a local URL is internet-accessible. Its public URL remains selectable even when the clipboard is unavailable.

## Publication identity and ambiguous replies

The separate receipt lane supplies the server response and `parsePublicationReceipt`. The editor uses only that validated receipt's exact normalized fingerprint after a successful publish. It never infers what was published from a captured local draft or whichever later form happens to render. Existing autosave, schema validation, publication storage and public URL semantics remain the source of truth.

A successful HTTP response with a missing, malformed, mismatched or unreadable confirmation is treated as ambiguous: publication may have completed. No success dialog appears, the draft and last known publication state are retained, and headers, guided Publish and Share say **Publication status needs checking** rather than guessing current/different/not-public. Publishing and pausing are blocked until the editor is refreshed to retrieve actual server state. A persistent notice explains this; dismissing the error does not clear uncertainty. Editing, autosave and owner preview remain available. No reload is forced and no unsaved draft is discarded.

The receipt identifies this request's committed snapshot. It does not establish real-time awareness of a different tab's later publication, pause or edit. Existing reload behavior remains necessary for that case. No new storage limits, schema fields, public receipt data or cross-tab synchronization are added by this UI lane.

## Focus and clipboard behavior

Publishing captures and focuses its actual invoking control before opening readiness, including pointer activation in WebKit. Ordinary readiness cancellation, success Close/Done/Escape and failure paths restore the connected visible opener. After a responsive replacement, restoration selects a visible enabled publish control; the uncertainty notice or current guided section is a safe fallback when publishing is disabled or unavailable at the current step.

The success dialog opens with focus on **Close publication confirmation**. Explicit Tab/Shift+Tab navigation walks its visible enabled controls and wraps in both directions. Native modal semantics make background content inert. The native dialog closes synchronously before Share navigation or deferred restoration, so native restoration does not compete with destination focus. Deferred focus checks require a connected visible destination, no newer native modal and no newer deliberately focused control. Frames are cancelled on unmount. Guided return records a pending request ID, quiz and target step, then waits for that step to commit before scheduling focus. Intervening manual navigation, pointer/Tab/input or a newer focused control cancels stale return focus.

Copy awaits the browser clipboard promise. Only a resolved current request shows **Copied!**. Rejection or an unavailable clipboard gives an in-dialog alert and selects the actual URL for manual copying when focus has not moved elsewhere. A late rejection after the creator chooses another control preserves that choice; closing or leaving the dialog invalidates pending copy feedback. No receipt or private data is copied.

## Validation and limits

The first compiled Chrome acceptance found that Share worked but return-to-Publish did not focus its heading. The original mount effect scheduled its one frame before the new step committed; its defensive target check could abort without another focus attempt. The narrow post-commit pending-focus correction is source-checked and awaits the final rebuild. The independent diagnostic continuation bypassed only that known assertion and found no further issue through five modal scans, responsive dismissal, clipboard handling, pause/republish and both creator entry paths; it is not acceptance. The original failure remains preserved.

Source-scoped ESLint and full TypeScript checking passed during implementation. Existing unrelated EditorStudio warnings remain; the new confirmation component introduces no lint warning. The independent QA lane owns `tests/browser-guided-publication.cjs`, including real blank/template creation, preview, publish/cancel/failure, sharing and return, saved/live labels, reload, pause/republish, native keyboard behavior, responsive opener replacement and clipboard failure. The receipt lane owns held save/publish race checks. Final compiled results will be appended after the shared build; prepared checks are not claimed as executed browser passes.

There are no new services, respondent starts, provider calls, real emails, payments, deployments, scoring changes, embed modes or custom domains in this change. Share return context is an in-session navigation aid, not a persisted workflow or new wizard. Production account/mail delivery, hosted persistence and unaided human usability remain separate acceptance work. CRM and Stripe remain last.
