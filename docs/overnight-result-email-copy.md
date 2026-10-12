# Result-email copy — local implementation and evidence

12 October 2026, batch 12. This adds editable copy and deterministic preview support to the existing synthetic email foundation. It does **not** add real email delivery, a provider, attachments, sender/reply-to settings, automatic sending or a scheduler. Production delivery remains unavailable by default.

## Copy and rendering contract

`FormSchemaType.resultEmailCopy` is optional and versioned. Version 1 has only `subject`, `introduction` and `signOff`, with maximum lengths of 120, 1,200 and 160 JavaScript string characters respectively. The subject and introduction must contain non-whitespace text; sign-off may be empty. Unknown fields or versions are rejected. Subject ordinary spaces are normalized; intentional body/sign-off paragraph breaks remain. Header newlines, unsupported control characters, Unicode line separators, directional overrides/isolates and malformed surrogate characters are rejected. CRLF paragraph breaks normalize to LF.

The client-safe `lib/result-email-copy.ts` imports only Zod. It exports the schema/type, immutable defaults, a resolver, a resolved-copy validator, shared text/HTML renderer and fixed-sample preview. No recipient, contact, score, raw answer, report token, records adapter, crypto, server auth or network capability enters the helper. Only `{quiz_title}` and `{brand_name}` are supported; unknown or incomplete braces fail with field-specific feedback. Substitution happens once, so braces in a title remain literal text rather than becoming another token.

The resolver takes only title and brand. It bounds them to 160/100 code points, normalizes unsafe controls to spaces, and falls back to “your quiz” / “Pippi” when empty. It validates field limits again after substitution and caps combined resolved copy at 4,096 UTF-8 bytes. It never silently truncates creator-authored subject/introduction/sign-off. Later title/brand changes can invalidate expansion; publication validates the current context too, returning a friendly422 before replacing the live snapshot while keeping the draft editable.

Preview uses the fixed samples “Your sample quiz” and “Your brand”, the explicit expiry example `2030-01-31`, and an inert example-link label. Preview performs no HTTP request, token issuance, report creation or queue mutation. The UI lane renders returned text as text, rather than injecting the returned HTML.

Configured messages share the preview's paragraph/text renderer. Text is escaped before HTML; URL-like creator text stays plain HTML text. The only generated HTML anchor comes from the server's canonical private result URL. The pure renderer additionally refuses active schemes, credentials, query/fragment data and non-result paths; server code retains exact configured-origin validation. A future real mail client may independently auto-link text; this implementation does not promise to control mail-client behavior.

The local-test subject suffix/body notice, expiry UTC date, bearer-link warning and separate-marketing-consent statement remain fixed outside creator copy. Subject's 120-character limit applies to creator copy before the additional fixed local-test suffix.

## Immutable queue and legacy behavior

The first explicit request resolves copy from the **completed attempt's frozen form**, including its title and brand. It never reads the newest mutable draft to choose copy. Resolved subject/introduction/sign-off and rendering version `1` are encrypted into optional job field `copyBox`, using the existing AES-GCM primitive with owner/job/purpose/version context `${owner}:${jobId}:copy:v1`. This is separate from recipient and artifact encryption. No reusable bearer URL is frozen into creator fields or stored in plaintext.

Optimistic first creation retains the existing deterministic job ID and one-recipient policy. Concurrent requests converge on the original job; replays cannot replace recipient or copy. Retries use the stored rendering version and encrypted resolved text, not current form settings. Unsupported frozen versions fail closed instead of silently falling back. Existing lease, timeout, bounded retry, receipt reconciliation and report availability/revocation checks are preserved.

An absent form configuration creates no `copyBox`. Existing jobs without the field use the **unchanged legacy subject/plain-text/HTML renderer**, even after a creator adds or edits copy. Existing prepared artifacts remain unchanged. This is an explicit rendering-version contract; future formatting changes require another version rather than reinterpreting queued version-1 text.

Status DTOs remain unchanged: state, attempts, truthful synthetic message, next-attempt time and retry availability only. They expose no decrypted copy, address, ciphertext, raw answers or bearer link. Explicit transactional request remains separate from marketing consent; no capture/contact fields are modified.

## Files and coordination

Owned source: `lib/result-email-copy.ts`, narrow optional schema field in `lib/schema.ts`, and configured-job integration in `lib/result-email.ts`. No transport/config gate changes were required. New tests: `tests/result-email-copy.cjs` and `tests/result-email-copy-api.cjs`.

The guided-editor lane owns `ResultEmailCopyEditor` and editor integration. The parent owns removal of creator copy from public form/start/SSR projections, publication-time expansion validation, recovery compatibility and compiled boundary/accessibility checks. The portable saved-report allowlist is unchanged; email configuration is not added to reports. No template, PDF, player, sender or provider files were changed in this lane.

## Checks

- **10 pure groups:** strict shape/version; exact default preview; allowed/missing/once-only tokens; malformed tokens; control/header/bidi/surrogate rejection; character/UTF-8 limits; expanded bounds; HTML/URL safety; frozen text validation; deterministic client-only preview.
- **10 in-memory API/service groups:** save/reload/publish snapshot isolation; auth/origin/malicious-update rejection without mutation; encrypted completed-attempt copy; concurrent first creation/replay and recipient conflict; failed preparation/manual retry after edits; one artifact; safe status; exact legacy message; unsupported version failure; revocation/invalid expansion; production-mode disablement. These groups contain multiple assertions, not ten browser journeys.
- Existing **20 synthetic email checks** pass unchanged, including crash-after-acceptance recovery, late final-timeout acceptance, revocation during preparation, strict retries, canonical Host/Origin behavior, body streaming limits, owner isolation and deletion/expiry.
- Scoped ESLint and full TypeScript check passed with the final URL-safety assertions and the shared editor source present. Both new suites passed their final source run.

Evidence directory: `../pippi-overnight-2026-10-12/compiled-verification-batch-12/email-copy/`; logs `pure.log`, `api.log`, `legacy-20.log`, `lint.log` and `typecheck.log`. Tests use synthetic local configuration and in-memory records; they make no cloud, provider or real recipient calls. Compiled acceptance passed on the combined batch12 candidate: five boundary groups verify public projection, rejected-publication preservation, immutable encrypted copy/recipient/artifact and legacy behavior. The full editor suite passed in Chrome/Firefox/WebKit with nine scoped accessibility scans. See overnight-batch12-quality.md and the editor handoff for exact evidence. This does not establish inbox delivery or human usability.
