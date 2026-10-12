# Next priority after evidence: finish the guided publish-to-share flow

12 October 2026. Recommendation against the original competitive acceptance items 2 (routine guided creation) and 12 (practical publishing/embedding). This is a focused reliability and accessibility pass, **not another feature or wizard**. No application source was changed for this review.

## Why this is next

All 43 campaigns, the guided checklist, manual synthetic journey cases, published snapshots, pause/resume, three embed modes, private reports and native PDFs already exist locally. Batch17 adds the bounded Results-to-experiment evidence handoff; its final acceptance is tracked in the batch17 quality note. Do not rebuild those capabilities or add more advanced controls to ordinary creation.

There is instead a reproduced failure at the end of an ordinary creator's workflow: guided publishing offers **Embed & Share**, but clicking it does not show either tool. A saved change to an already published quiz also appears only as **Saved · Published quiz** in guided mode, concealing the distinction between the current draft and the live version. Fixing this path is more useful than another niche expansion.

## Compiled evidence, not just source inference

An isolated Chrome diagnostic ran against the final batch17 candidate at `http://127.0.0.1:3164`. It created one synthetic local quiz, used the actual guided Review & publish confirmation, clicked Embed & Share, then edited and saved its title at 390px width.

| Check | Observed |
| --- | --- |
| Publication confirmation | Visible success title; zero dialog roles and zero open native dialogs. |
| Embed & Share action | Confirmation closes; Guided builder remains visible; zero Share Your Quiz headings and zero Embed your quiz regions; focus is on BODY. |
| Saved mobile edit | Saved draft title differs from the retained published title, but the header says Saved · Published quiz and no unpublished-changes message is visible. |
| Isolation | Zero public starts, experiment mutations, external requests or page errors. The synthetic form and published record were removed successfully. |

Evidence directory: [`guided-share-before`](../../pippi-overnight-2026-10-12/guided-share-before/), including `diagnostic.cjs`, `diagnostic.log`, `result.json` and three screenshots. The post-action desktop and mobile-edit screenshots were visually inspected. This establishes the specific Chrome failures; it is not a cross-browser usability study or production check.

The source explains the result. `EditorStudio.tsx` renders the Share panel only inside `!guided`. The confirmation action closes its overlay and changes `activeNavTab` to `share`, but leaves guided mode active. The full editor already compares `liveFingerprint` with `publicationFingerprint(form)` and distinguishes unpublished changes; `GuidedQuizEditor.tsx` receives only a published boolean. `EditorMobileHeader.tsx` already accepts a publication-label string. The existing confirmation is an ordinary fixed div, unlike the native publish-readiness and pause dialogs.

## Bounded batch18 scope

1. **Make the existing action arrive somewhere real.** Explicitly open the existing Share surface from guided publication and focus its heading. Provide a clear return to the guided Publish step while preserving the draft. Reuse `QuizEmbedCode` and its established inline/fixed/popup behavior; do not duplicate the embed generator, introduce a new wizard or require creators to discover advanced tools first. The exact navigation implementation can be chosen within the editor components.
2. **Use one truthful publication state.** Pass the already calculated draft/live distinction into guided desktop, mobile and Publish views: not public, published and up to date, or published with unpublished changes. Explain that saving protects a draft while publishing updates the live quiz. Retain the existing saved/error indicator separately. Verify fresh publication, subsequent saved edits, reload, pause and republish against the actual retained published snapshot.
3. **Finish the success confirmation.** Use a named modal dialog with initial focus, keyboard containment, Escape/Close/Done and intentional focus restoration. Opening Share is navigation, so restore focus to its destination rather than the obsolete publish control. Replace the internal “when your server is accessible” wording with plain instructions about the displayed quiz link, without claiming that a localhost URL is reachable on the internet. Keep the existing awaited clipboard handling and manual selection fallback.

Suggested exclusive application ownership: `components/EditorStudio.tsx`, `components/GuidedQuizEditor.tsx`, and a new small `components/PublicationConfirmation.tsx` only if extraction simplifies lifecycle/focus handling. `EditorMobileHeader.tsx` should not need changes because its label contract already exists; coordinate explicitly if that assumption proves false. Add dedicated publish/share browser regressions and a feature note. Root owns shared staging, builds and compiled acceptance.

No schema, scoring, template, player, experiment, report/email, storage or publication-API changes are expected. In particular, retain pause semantics, the stable public URL and frozen public content. Do not add slugs, domains, installation detection, analytics or hosted-provider work to this slice.

## Compatibility and race boundaries

- Editor mode is already browser-persisted. An explicit transition to Share may change that preference, but must not reset the form or lose the guided return context. A publication label is derived state, not a new persisted schema field.
- Capture the actual connected opener for ordinary dialog dismissal, with a visible fallback after responsive header replacement. A late response or animation frame must not steal focus from a control the creator has since selected. Avoid competing restoration between the readiness and success dialogs.
- Autosave completion is not evidence that the same draft is public. Test a held save/publication response with later edits and require truthful status. The present endpoint returns success and URL, not the exact published snapshot digest. If those tests expose a concrete receipt/concurrency issue, report it and coordinate narrow API ownership before changing the contract; do not guess a live fingerprint from a newer local draft or silently expand into a new revision system.
- Keep clipboard failures actionable, and ensure a failed or cancelled publish cannot open a success dialog or Share under a false published state. Existing authorisation, revision conflict, pause and preview boundaries remain unchanged.

## Acceptance before claiming this fixed

- A blank-start and an enriched-template creator can follow guided edit → owner preview → confirmed publish → Embed & Share, see the existing Share/embed tools and return to the guided Publish step with the same saved draft. Cancellation creates no publication or navigation. Verify the public snapshot by local read without starting a respondent session.
- Desktop and 320/390px guided views distinguish saved unpublished edits from the current public snapshot, including after reload. Pause removes public availability; republish restores the same URL. A pending edit during asynchronous work cannot be mislabeled as live.
- Success dialog Tab/Shift+Tab, Escape, Close and Done work in Chrome, Firefox and WebKit. Share navigation focuses its destination; dismissal restores the opener or visible replacement after a resize. No keyboard action is trapped behind or escapes through the modal, and intentional outside navigation receives no delayed focus theft.
- Copy succeeds when available. Rejected/unavailable clipboard preserves the actual URL and provides manual selection instructions, with no false Copied state. Existing embed modes and public-link semantics remain intact; rerun the established publication/pause and embed regressions appropriate to the touched components.
- Preserve the before evidence, capture final narrow/mobile views, and run scoped accessibility/reflow checks. Report actual browser coverage, not a claim that all publishing has been tested.

This closes a concrete local usability defect, not the original human or production acceptance bar. Unaided creator observation, fresh hosted-account and mailbox verification, remote persistence/deployment rollback, readable slugs and custom domains remain separate work. CRM and Stripe remain last; no real email, provider, cloud, spending or deployment action is part of this recommendation.
