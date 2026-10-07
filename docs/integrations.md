# Lead integrations

The quiz editor’s **Integrate** tab supports GoHighLevel private integrations and outgoing HTTPS webhooks. Connections belong to one owner and quiz. They are independent of the published quiz schema and excluded from public forms and exports.

## Connect a destination

1. Enable contact capture in Contacts and publish those capture settings.
2. Add a connection in Integrate. New connections start paused.
3. For HighLevel, enter a sub-account location ID and private integration token with Contacts read/write permissions. Email, name and phone map automatically. Map quiz results, scores, category-score JSON, consent or individual answers to existing HighLevel custom field IDs. Add optional static tags and/or a segment/product-ID tag. Marketplace OAuth onboarding is not implemented.
4. For a webhook, enter the final public HTTPS URL. All contact, consent, answers and result data is included in a versioned JSON event. Optional field mappings add values under `fields`. Hidden-question campaign values are included under `answers`. An optional signing secret adds an HMAC signature.
5. Send a synthetic test. This can create/update `heyquiz-test@example.com` in the destination. Test HighLevel calls omit tags, but existing destination automations may still run. A 2xx response means the destination accepted the request, not that its downstream email workflow finished.
6. Enable delivery and save. New captured leads are eligible from this point; historical contacts are not backfilled. Changes apply immediately without republishing.

HighLevel delivery requires explicit marketing opt-in in this release. Webhooks default to the same rule but may be configured to receive all captured leads; the receiver must respect `contact.marketingConsent`. Connections do not change existing HighLevel DND/unsubscribe settings. Tags use the separate additive endpoint instead of overwriting existing tags. No direct workflow-enrollment or email-send API is called.

## Reliability

Saved submissions are the durable source of truth. After a submission/contact response, a worker creates deterministic per-connection/per-response jobs and processes up to ten due jobs, five at a time. Scheduled reconciliation recovers a saved lead if the original callback never ran. Preview responses do not enter storage or the delivery queue. Vercel preview environments cannot configure or dispatch integrations, because the current preview database is shared with production.

Each job has an optimistic-lock claim and a 90-second lease. Expired leases are reclaimable. Transient network errors, HTTP 408/425/429 and 5xx retry up to six attempts with backoff and bounded Retry-After support. Other 4xx and redirects require review. Delivery history exposes state, attempts and safe diagnostics, never destination response bodies or credentials. Pausing/editing a connection stops pending jobs from the older configuration. Explicit manual retry uses the current destination and mappings.

Webhook delivery is **at least once**, not exactly once. Receivers must deduplicate `eventId` / `Idempotency-Key`, including when a remote success is followed by a local persistence failure. HighLevel upsert requests disable duplicate creation; completed upsert IDs are persisted so a tag retry can skip the upsert. A crash between remote success and local persistence can still repeat an upsert. Multiple legitimate quiz attempts remain separate events.

The MVP reconciler scans owner submissions and delivery records. This is appropriate for initial volumes; use indexed queue queries and cursor-based reconciliation before high-volume multi-tenant rollout. Worker batches are bounded, but scan volume is not yet bounded.

## Webhook verification

Headers: `X-HeyQuiz-Event`, `X-HeyQuiz-Delivery`, `Idempotency-Key`, `X-HeyQuiz-Timestamp` (Unix seconds). When a signing secret is configured, `X-HeyQuiz-Signature` is `sha256=` plus the hex HMAC-SHA256 of `timestamp + "." + rawRequestBody`. Verify with a constant-time comparison, reject stale timestamps, and deduplicate event IDs. The payload carries `schemaVersion: 1` and event `lead.captured` or `connection.test`.

Only HTTPS port 443 is allowed. URL credentials, fragments and private/reserved networks are blocked. Every resolved address is checked; the validated address is pinned to the HTTPS connection to prevent DNS rebinding. Redirects are never followed. Network calls have a ten-second deadline and a 64 KB response limit.

## Credentials and scheduling

Credentials, webhook URL paths and signing secrets are encrypted with AES-256-GCM using an owner/quiz/connection binding. `INTEGRATION_SECRET` is the preferred stable server key (32+ characters); otherwise an HKDF-derived key from `SESSION_SECRET` is used. Changing the active encryption key requires reconnecting destinations. Raw credentials never return from configuration APIs.

The hosted deployment uses Supabase `pg_cron` and `pg_net` to invoke `/api/integrations/dispatch` every minute. The worker token is generated inside Postgres and encrypted in Vault; only its SHA-256 verifier is stored in the server-only `hq_records` metadata. Ordinary users cannot read Vault, queue metadata or scheduler schemas. No public RPC function is added. The scheduler is named `heyquiz-delivery-retries`; its token entry is `heyquiz_delivery_worker`. These resources are project-local.

Alternative installations can set `CRON_SECRET` (32+ random characters) and call the same route with `Authorization: Bearer <secret>`. Vercel Hobby cron is daily only; use a minute-level scheduler for prompt retries. No unauthenticated worker execution is permitted. The Integrate screen reports scheduler configuration.

To pause hosted unattended retries, set `cron.job.active=false` for `jobname='heyquiz-delivery-retries'` and set `payload.enabled=false` on the `hq_records` row with `kind='meta'` and `id='integration-worker-auth'`. New submission callbacks still run. Pausing each connection stops its delivery. Rotate the Vault token and stored SHA-256 verifier together; never paste the token into logs or the repository.

Cloud extension migrations recorded for this release: `enable_heyquiz_delivery_scheduler` and `restrict_delivery_scheduler_network_access`. Existing `hq_records` remains protected by RLS with no anon/authenticated grants.

## Verification

- `npm run test:integrations`: temporary isolated storage; mocked destinations; consent, encryption, ownership, mapping, claims, retries, tag preservation, recovery, scheduler authentication and DNS pinning.
- `npm run test:integrations-api`: local server at port 3130; auth, invalid config, optimistic concurrency, public capture hooks, preview isolation, and retry-worker protection. Lifecycle fixtures use an unresolvable example.com subdomain, so no contact is transmitted to a third party.
- `npm run test:browser-integrations`: local Chrome setup/edit/reload, mapping, hidden credentials, HighLevel consent guard and mobile overflow checks. Connections stay paused; synthetic fixture forms/connections are removed.

Live HighLevel account delivery still requires a customer's valid token/location and an authorized destination test. Passing mocked adapter tests is not proof of live account permissions or downstream automation behavior.

References: [HighLevel upsert](https://marketplace.gohighlevel.com/docs/2021-04-15/ghl/contacts/upsert-contact/index.html), [HighLevel additive tags](https://marketplace.gohighlevel.com/docs/2021-04-15/ghl/contacts/add-tags/index.html), [Supabase pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
