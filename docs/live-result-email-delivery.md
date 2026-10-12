# Live result email delivery

Implemented 12 October 2026. This document describes the real Resend path and the preserved local synthetic path. Local mocked acceptance is complete; real deployment, sender configuration, scheduled execution and inbox verification are performed separately by the release owner. No provider request or real email was sent by the service test suite.

## Delivery contract

A respondent explicitly requests one result email after completing a published quiz. The request requires the existing completed, non-preview attempt capability and an unambiguous single mailbox. It does not change marketing consent or subscribe the person. The message contains creator-authored plain-text copy and the frozen private result link; it does not copy raw answers or contact fields into the message. Link expiry and revocation remain those of the existing saved report.

The API first persists a version 2 `result_email_jobs` record, then schedules a bounded Next `after` callback. The job has an immutable recipient digest, encrypted complete provider payload, payload hash, provider-credential fingerprint and original report expiry. The same response cannot silently change recipient, message, sender, link or idempotency key on retry. Old version 1 synthetic jobs cannot become real sends when configuration changes.

The real transport uses one Resend `POST /emails` request with a one-element recipient array, frozen payload and `Idempotency-Key: pippi-result-v2/{jobId}`. There are at most three claimed attempts. Each provider POST has an eight-second deadline. Compare-and-swap claims have a 90-second lease; interrupted workers can be reclaimed. A receipt in `result_email_receipts` is stored independently before acknowledging the job, so a failed job acknowledgment does not forget accepted mail. A receipt-write outage leaves the claim recoverable by repeating the same key and payload.

Resend retains idempotency keys for 24 hours; this application stops attempts at 23 hours from its first claimed attempt. Ambiguous exhausted/expired requests become **unknown** and cannot be resent through the UI. A changed provider credential also prevents a retry under another account. These are deliberate duplicate-prevention limits, not a guarantee that every request will be delivered. No fresh idempotency key is invented to repair a mismatch or uncertain outcome.

A revoked/deleted/expired result is checked before the provider call. Once a provider has accepted the email, later revocation cannot recall it: the state remains accepted/delivered, while its link is unavailable. A lifecycle change in the final network boundary cannot be made atomic with an external email provider.

## Honest states and interfaces

`POST /api/forms/{id}/result-email` keeps the existing `request`, `status`, `prepare` and `retry` action contract. In real mode `prepare` explicitly processes an already requested job; ordinary status refresh must use `status`, which never sends. Request requires `email` and `requested: true`; all other real actions reject unknown fields. Success returns `{ mode: "resend", job, sent }`; `sent` means confirmed provider acceptance, not inbox delivery. The status DTO is:

```
{ mode, state, attempts, message, nextAttemptAt, canRetry,
  acceptedAt, deliveredAt }
```

States are queued, sending, accepted, delivered, delivery_delayed, bounced, complained, failed, unknown and cancelled. **Accepted** means Resend accepted the submission. **Delivered** means the recipient mail server accepted it; inbox placement and reading are not asserted. Status failures retain the last confirmed receipt. Owners can retrieve at most 100 recent status rows plus a total through `GET /api/forms/{id}/result-email/drain`; rows use response ID/date and status, with no recipient, token, body or provider ID. Authenticated POST drains only that owner's quiz jobs, up to five sends and five receipt checks per call. A deleted quiz may still have queued jobs cancelled through this owner-scoped maintenance call.

Owner GET returns `503` with `code: "RESULT_EMAIL_UNAVAILABLE"` only when real mode is not configured. A configured storage failure returns sanitized `503` without that code, so the UI can retain its status panel and offer retry. Auth/ownership errors remain distinct. All new response paths use private/no-store headers and sanitized errors. Provider payloads, addresses, signed links, credentials and provider error bodies are not logged or returned by management endpoints. Pending payloads are AES-256-GCM encrypted with a purpose-specific key derived from the existing stable `SESSION_SECRET` and owner/job context. Signing/encryption secrets must remain stable for existing queued records and report capabilities.

The email copy editor defaults to a hosted message wording preview and also offers an explicitly marked local-test preview. Neither creates a request or capability. The verified sender is configured centrally; creators customize subject, introduction and sign-off. Fixed privacy/expiry notices remain in both modes. Synthetic preview defaults remain backward compatible for existing pure callers.

## Configuration and operations

Real mode requires all of:

- `HEYQUIZ_RESULT_EMAIL_MODE=resend`.
- Local mode disabled, existing cloud record adapter configured, stable `SESSION_SECRET` at least 32 characters.
- `RESEND_API_KEY` server-only.
- `RESULT_EMAIL_FROM` an approved single sender, optionally a plain display name. The release owner verified **auth.pippiapp.com**; use a sender on that domain, not an assumed apex sender.
- `APP_URL` the canonical HTTPS origin, without a path, credentials, port, query or fragment.
- On Vercel, `VERCEL_ENV=production`. A preview deployment cannot accidentally turn this real transport on.

Missing/unsafe configuration keeps real sending unavailable. Existing synthetic mode stays restricted to isolated local execution. No migration or additional database table is required: jobs and receipts use the existing generic record adapter and its owner/version protections.

`vercel.json` registers `GET /api/result-email/worker` every five minutes. The release owner verified the existing Vercel team has Pro, so no plan upgrade is required. The worker requires `Authorization: Bearer <CRON_SECRET>` with a secret of at least 32 characters; an explicit `RESULT_EMAIL_WORKER_SECRET` can override it for a separately authorized worker. If both are set, they must match for Vercel's automatic header to work. Missing/wrong credentials return **401** before processing; no credential is generated by this feature. Until production cron authentication is configured and exercised, only best-effort immediate processing and authenticated owner maintenance are available.

The immediate callback has a 25-second retry budget; the worker route has a 60-second platform budget. The worker selects at most five due sends, then at most five pending receipts ordered by oldest poll. A backlog therefore needs multiple scheduled runs. Listing jobs/receipts still scans the collection through the existing adapter; bounded mutations do not imply bounded reads or an unlimited-throughput queue. Platform interruption and storage outages can delay processing; durable claims recover within the safe retry window. This is not a transaction across provider and storage.

Status refresh and the worker can retrieve an already accepted email from Resend, throttled to one poll slot per job per 30 seconds. The lookup validates the exact provider ID and one stored recipient, then retains only minimal status. Polls stop after a terminal receipt and worker polls stop at report expiry. A later complaint after a delivered terminal state requires webhook events to be reflected; polling alone does not promise complete event history.

Optional `POST /api/result-email/webhook` uses `RESEND_WEBHOOK_SECRET`. It validates the raw, bounded UTF-8 body against Svix HMAC headers, constant-time signature comparison and a five-minute clock window before parsing. Matching requires the immutable job tag, provider ID, one stored recipient and a plausible event timestamp. Duplicate/out-of-order events cannot downgrade a stronger state. Only minimal receipts are retained. It is safe to deploy without the secret: unsigned/unconfigured callbacks are rejected and provider GET polling remains available. No webhook registration is claimed by this implementation.

## Local acceptance

Evidence: `../pippi-live-completion-2026-10-12/result-email-service/`.

- `tests/result-email-live.cjs`: 13 mocked groups covering mode/recipient gates, explicit request, concurrent claims, frozen encrypted payloads, transient retries, acceptance/receipt-write crash recovery, exhausted idempotency window, revocation timing, signed callback monotonicity/privacy, API-after persistence, worker 401, real transport request shape, provider GET, inert hosted preview, and explicit unavailable-versus-storage-failure handling.
- `tests/result-email.cjs`: existing 20 synthetic groups preserved.
- `tests/result-email-copy.cjs`: existing 10 pure copy groups preserved.
- `tests/result-email-copy-api.cjs`: 10 existing copy API/service groups passed.
- Independent `tests/result-delivery-independent.cjs`: 19 groups passed in the QA lane, including a receipt-write outage after provider acceptance; every network call is guarded with mocks.
- Updated `tests/browser-result-email-copy.cjs` checks hosted/local preview switching while preserving draft recovery, publish snapshot, validation and no-queue assertions. Compiled Chromium acceptance passed on the release owner's isolated server at `127.0.0.1:3165`: draft validation/recovery/apply/reset/retry, hosted/local preview switching, two synthetic public starts, published and retained-attempt copy. No request was queued and no email was sent. Three accessibility scans at 320/390/1440 pixels had zero violations; mobile preview and desktop editor screenshots were inspected. The initial sandbox Chrome launch failed before any fixture call and is retained separately from the passing `browser-final.log`.
- Final source TypeScript (`--noEmit --incremental false`) and scoped ESLint checks passed.

## Primary references

Resend: [send API](https://resend.com/docs/api-reference/emails/send-email), [24-hour idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [retrieve email](https://resend.com/docs/api-reference/emails/retrieve-email), [event meanings](https://resend.com/docs/webhooks/event-types), [webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests). Raw signature algorithm: [Svix manual verification](https://docs.svix.com/receiving/verifying-payloads/how-manual). Scheduler limits: [Vercel cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing). Runtime scheduling was checked against the installed Next `after` API documentation rather than assuming background work survives indefinitely.
