# Result-email copy: bounded implementation plan

12 October 2026. This was the batch11 source-reviewed design; its bounded local copy/editor implementation is now verified in batch12 (see overnight-result-email-copy.md and overnight-batch12-quality.md). The design below is retained as acceptance history, not evidence of real delivery. Current result email is synthetic only; the fixed template, explicit request, immutable recipient, encrypted artifacts and revocable saved link already have local evidence. This plan does not enable real mail, a provider, automatic delivery or a scheduler.

## Creator experience

Offer three plain-text controls: subject, introduction and sign-off. Use a compact preview with sample quiz/brand values and a clearly labelled nonfunctional example link. Keep the expiry/private-link/marketing-consent footer and local-test label outside editable copy. Do not add arbitrary HTML, images, attachments, URL input or sender/reply-to configuration to this first increment. Native result downloads remain available from the saved page.

A creator can reset to sensible defaults, preview long/mobile content and see invalid-field feedback before saving. Copy changes follow normal draft saving and publication; they do not rewrite existing attempts, queued requests or saved reports. The interface must state when only a preview/local test is available. Production must not display a send/delivery promise until a separately authorized transport exists.

## Source boundaries and snapshot choice

Current source: `lib/result-email.ts` builds a fixed message at preparation time using `ResultReport`; `result-email-config.ts` gates synthetic mode and performs purpose-scoped encryption; `result-email-transport.ts` accepts one encrypted artifact. `ResultReport` intentionally excludes contact data and raw answers. Preserve that allowlist instead of adding an email configuration to portable reports.

1. Add an optional versioned `resultEmailCopy` to `FormSchemaType` and `FormSchema`, validated in one client-safe helper. Old quizzes retain current defaults. Read installed Next client/server and route guidance before integration; do not import crypto, recipients or delivery helpers into the editor bundle.
2. Resolve creator copy from the completed attempt's frozen form, never the latest mutable draft. A request is tied to the published campaign that produced that respondent's result.
3. On the first queue request, validate/resolve the copy and encrypt only its resolved subject/introduction/signoff plus rendering version in a new purpose-scoped job field. Keep this separate from the recipient box and artifact box. Freeze it at creation; concurrent replay must converge on the original job and cannot change its recipient or copy.
4. Preparation/retries use the stored rendering version and resolved copy. Preserve the canonical signed result-link lookup/revalidation at actual acceptance; never persist a reusable live bearer URL in plaintext. Do not snapshot a fully rendered expiring URL into creator-editable fields.
5. Existing jobs without the new copy field must use the exact legacy template, not whatever the creator has edited since. Existing prepared artifacts remain immutable. A format change needs an explicit migration/version contract, not a silent reinterpretation.
6. Status/diagnostic responses stay unchanged: no decrypted address, subject, link, body or ciphertext. No new preview endpoint should reveal respondent data. An editor preview uses only its own draft plus fixed safe sample values, with no real capability generation or queue mutation.

## Minimal copy rules

Use subject up to120 characters, introduction up to1,200, sign-off up to160, with an overall resolved-size cap. Validate bounds again after substitution. Reject subject CR/LF, control characters and Unicode line separators; normalize ordinary spacing without hiding a dangerous value. Preserve intentional paragraph breaks in introduction/sign-off. Validate UTF-8 byte size at an API streaming boundary wherever a new endpoint is introduced.

Support only literal `{quiz_title}` and `{brand_name}` placeholders initially. Use the frozen attempt title and theme brand name; a missing brand falls back to Pippi and an empty quiz title to “your quiz.” Do not expose contact names/emails, raw answers, scores, diagnosis-like result headings or arbitrary object paths in the first implementation. Expand the token set only after explicit privacy/copy requirements. Reject unknown or malformed braces with readable validation rather than rendering a broken token. A title containing braces remains literal text; substitutions must run once, not recursively.

Escape every inserted value for HTML, render paragraphs as text, and retain a separately assembled plain-text alternative. The only clickable link in generated HTML is the application-generated private result URL. Creator text containing URL-like material must remain inert text in HTML; a future real email client may independently auto-link text, so this is not a guarantee against client behavior. Local mode forces the unmistakable local-test subject/body marker after validation. Creator copy cannot remove the expiry UTC date, bearer-link warning or separate-consent statement.

These are proposed bounds, not new schema restrictions already applied to existing quizzes.

## Acceptance before merging

- Legacy absent config produces byte-compatible default message; existing job without config retains legacy behavior after a creator edit.
- Config save/reload/publish works through guided/full editor without changing questions, scoring, capture, theme or published snapshots early.
- New requests freeze copy from the completed attempt. Edit/republish before prepare/retry cannot rewrite the queued text; concurrent recipients/copy replays converge or conflict as before.
- All allowed/missing/unknown token cases, braces in a title, CRLF/control/unicode-line header injection, markup/quotes, long multibyte input, resolved overlength and empty values have literal expectations. HTML contains no injected tags/attributes and the generated link uses the canonical origin.
- Encrypted job/artifact raw records contain no plaintext recipient, full result URL or rendered body. Safe status responses still exclude them. Recipient, template and artifact boxes cannot decrypt under another purpose/owner/job scope.
- Existing twenty email queue/crash/revocation/timeout tests pass unchanged; add copy-freeze cases without weakening transport acceptance revalidation. No real network or email in tests.
- Compiled local UI/preview, keyboard focus, failure/retry,390px and320px reflow, visible local-only wording and settled accessibility checks pass. Existing actual native-PDF and report access remain unchanged.

## Ownership and deployment

Assign one lane exclusive schema/helper/result-email/job/UI ownership, or agree explicit independent subfiles before editing. `EditorStudio.tsx` is owned by guest-navigation work during batch11; this design deliberately avoids simultaneous edits. Root coordinates one source freeze, candidate copy, build and regression pass.

A real sender remains a separate release: authorized provider/domain configuration, transport idempotency, recipient verification policy, bounded processing schedule, bounce/delivery semantics, abuse and retention controls, and one explicitly approved mailbox test. Neither this plan nor later local copy tests can establish inbox delivery or production readiness.
