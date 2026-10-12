# Synthetic transactional result email — batch 5

## Scope and availability

This is a **local-only delivery foundation**, not live email delivery. No SMTP, Resend, email SDK, provider call, credential lookup or new dependency was added. The only transport writes one encrypted synthetic message artifact to local records. The UI says no email is sent throughout.

Every availability condition must hold:

- `HEYQUIZ_RESULT_EMAIL_MODE=synthetic`
- `HEYQUIZ_LOCAL_MODE=1`
- `HEYQUIZ_RESULT_EMAIL_ORIGIN=http://127.0.0.1:3163` (or an explicitly configured HTTP loopback origin; no credentials, path, query or fragment)
- Existing `SESSION_SECRET` is configured with at least 32 characters.
- `VERCEL` and `VERCEL_ENV` are empty, and every supported `SUPABASE_*` URL/auth/storage key variable is empty.

Requests cannot enable these conditions. The actual request Host and any supplied Origin must exactly match the configured local origin; the internal URL must also be HTTP loopback. Next normalizes loopback URL hostnames to localhost, so validation uses the actual Host rather than treating the rewritten hostname as the public origin. Forwarded host headers are ignored. Production receives unavailable metadata and cannot use the endpoints even when request bodies claim synthetic/local mode.

`result-link` returns only safe availability metadata. After creating a private result link, SaveResultLink optionally shows **Result email · local test**. The user enters an address and explicitly requests a test copy. Marketing consent remains separate; no contact is created or changed, no subscription is made, and no CRM callback occurs.

## Authorization, privacy and fixed recipient

All respondent actions require the original matching, completed, non-preview attempt capability. They reuse `issueResultReport` for immutable snapshot, original expiry, quiz retirement and individual revocation checks. A saved report read token cannot request mail. No request creates a new report schema or bypasses existing report lifetime/revocation.

One deterministic owner/form/response job is permitted. Concurrent requests converge. The normalized recipient is immutable: requesting another address returns an understandable conflict without disclosing the original address. A separate affirmative `requested: true` is required; marketing opt-in is neither required nor inferred.

Recipient and synthetic message content use AES-256-GCM with HKDF purpose derivation from the configured secret and owner/job/payload-purpose associated data. The recipient digest is scoped and keyed. Job/status diagnostics include state, attempt count and safe timing only; they contain no email address, ciphertext, result bearer token, contact details or raw answers. The synthetic artifact stores encrypted content, not plaintext HTML or links. Its fixed template includes the escaped quiz title and the canonical local private link, with expiry and privacy language; it excludes scores, answers and captured contact data.

The request body is byte-limited while streaming to 4096 bytes, including chunked and multibyte content. Excess bodies are cancelled and invalid UTF-8/JSON is rejected. Origin checks and per-process request/owner limits supplement the one-request-per-response constraint. These are local test safeguards, not production anti-abuse infrastructure.

## Queue and synthetic acceptance

States are **queued**, **preparing**, **prepared**, **failed** and **cancelled**. No state claims real delivery.

- Queue creation is durable before the API acknowledges it.
- Optimistic claims have 90-second leases. Concurrent workers cannot claim the same record version.
- Synthetic transport has a 1.5-second deadline; transient failures and 408/425/429/5xx use bounded exponential backoff, with bounded Retry-After support.
- At most three actual preparation attempts are permitted. Other 4xx, including 422, require explicit manual retry, still within that total. Failed final attempts cannot silently reset the budget.
- The transport revalidates the current job claim and the report at the actual acceptance boundary. Deferred acceptance cannot proceed after timeout, claim loss or report revocation. Report access is checked again before acknowledging a successful preparation.
- The encrypted artifact ID is deterministic. A crash after acceptance but before updating the job recovers the same receipt after lease expiry, without a second artifact or another attempt.
- A local artifact write that completes after the final timeout is also reconcilable from **failed**, by checking status/preparation or the local drain. A late accepted receipt does not remain falsely failed forever.
- Deleted, expired, individually revoked or retired-quiz responses cancel pending work before acceptance. Publication pause preserves existing results and does not revoke them.

This deterministic encrypted artifact is a synthetic idempotency guarantee. A future real provider needs its own independently verified idempotency contract. The application does not claim distributed exactly-once email delivery. There remains a narrow non-transactional race between the final authorization read and artifact storage; already accepted or downloaded material cannot be recalled, and revoked result URLs remain inaccessible on later reads.

## Explicit local processing

The request endpoint accepts `request`, `status`, `prepare` and bounded `retry` actions. UI controls queue and prepare the local copy; reload checks and restores existing status. There is no automatic email or scheduled retry activation.

`POST /api/forms/[id]/result-email/drain` additionally requires the authenticated local owner and processes at most five due jobs/late receipts for that owner and quiz. This can cancel jobs even after the quiz is deleted. It does not invoke CRM dispatch. The existing generic adapter scans owner records before selecting five; this is not a production indexed queue.

No automatic retention scheduler was added. Encrypted local jobs and artifacts remain until test cleanup/local data cleanup. Never enable this synthetic path against real customer data. The browser fixture removes its own jobs, artifacts, attempts, responses and report receipts. Real delivery activation still needs sender/domain configuration, approved destination testing, provider acceptance/delivery events, anti-abuse controls and retention policy.

## Files and checks

New modules: `lib/result-email.ts`, `result-email-config.ts`, `result-email-transport.ts`, `result-email-request.ts`; request and owner-drain routes; optional UI in `components/SaveResultLink.tsx`; safe availability metadata in the existing result-link endpoint.

- `node tests/result-email.cjs`: **20 checks passed**. Covers disabled environments/body override, installed NextRequest loopback normalization and canonical Host/Origin isolation, bounded streaming/UTF-8, request consent, malformed/cross-quiz/preview capabilities, immutable recipient/concurrent requests, purpose-scoped encryption, actual escaped encrypted message, unchanged marketing data, worker concurrency, final-attempt crash, late final-timeout acceptance, deferred revocation, 429/5xx/422/manual retry, timeout, response deletion/expiry, safe API diagnostics, bounded owner drain and quiz retirement.
- Focused ESLint: no errors or warnings. `npx tsc --noEmit`: passed.
- `tests/browser-result-email.cjs`: **passed against the compiled batch-5 server** on `127.0.0.1:3163`. Exercised a real quiz completion, explicit local request, no-email copy, immutable recipient, one encrypted artifact, replay prevention, reload, 390px mobile layout, local owner drain and revoked-job cancellation. No browser errors or outbound email calls. The settled synthetic panel axe scan reported **zero WCAG 2/2.1 A/AA violations and zero incomplete checks**. Mobile screenshot inspected: readable, contained layout with accurate local-only state. This is not evidence of inbox delivery.

Browser command used against the compiled server with the above server flags:

```
TEST_BASE_URL=http://127.0.0.1:3163 HEYQUIZ_DATA_DIR=/Users/perry/Documents/Codex/2026-10-06/gr/outputs/pippi-overnight-2026-10-12/test-data node tests/browser-result-email.cjs
```

The browser process also needs empty cloud environment variables. Screenshots and compiled browser logs go to `../pippi-overnight-2026-10-12/compiled-verification-batch-5/result-email/`. The first compiled run caught a Next loopback hostname normalization failure; its log is preserved as `browser-result-email.initial-origin-failure.log`. The final corrected run passed and is recorded in `browser-result-email.log`; the actual installed NextRequest regression is included in the 20 unit checks. Screenshot: `synthetic-result-email-mobile.png`. No native PDF generation or email attachment was added; existing browser print/save-PDF remains available.
