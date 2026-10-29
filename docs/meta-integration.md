# Meta Pixel and Conversions API

Pippi supports one Meta business connection per authenticated owner (the app's current tenant boundary), reused by multiple quizzes. Other CRM integrations continue to use their existing providers.

## Platform setup

1. Create a Meta business app and a Facebook Login for Business configuration using the **Conversions API integration template**. Configure the exact OAuth callback URL `/api/meta/callback`. Assign the needed business assets and request `ads_management` and `business_management` through the login configuration for conversion management and business asset discovery. Complete the app's required business verification and permission review before onboarding unrelated businesses.
2. Configure the server-only `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID`, `META_GRAPH_VERSION`, and `META_REDIRECT_URI`. The Graph version must be a supported version selected in your Meta dashboard; Pippi deliberately has no implicit version default.
3. Configure a stable `INTEGRATION_SECRET` (or existing `SESSION_SECRET` fallback), and `CRON_SECRET` for worker authentication. All credentials and queued event payloads are encrypted with owner-bound AES-GCM scopes.
4. Apply the Meta indexes in `database/supabase.sql` to existing cloud installations. Enable `META_ENABLED=1` when ready. Outbound Meta traffic is disabled on Vercel preview deployments.
5. The included cron invokes `/api/meta/worker` every minute. Use a deployment plan supporting that cadence, or an external scheduler sending `Authorization: Bearer <CRON_SECRET>` to the same endpoint. No shared API keys belong in the browser.
6. Behind Vercel, visitor IP uses `x-vercel-forwarded-for`. Other hosts only use `x-forwarded-for` if `META_TRUST_PROXY=1` and the host overwrites that header. Otherwise IP is omitted.

## Creator flow

In **Integrate → Meta Pixel + Conversions API**, connect the business, choose the ad account and dataset, add qualification conditions, prepare conversions, enter the dataset's Meta Test Events code and send a test. After Meta acknowledges the request, enable tracking and **save and publish**. Confirm the event in Events Manager as well.

The connection is reused on other quizzes through “Use the connected dataset for this quiz.” Changing shared assets changes the connection generation: older quiz configurations and queued events cannot silently send to a new business, account or dataset. Reconnecting the same business refreshes credentials without abandoning valid queued events. Disconnect pauses all new delivery for that connection.

Each quiz receives two custom conversions, filtered by both event name and `quiz_id`. Pippi checks for exact existing rules/dataset before creating and checks the 100-per-account capacity. Conversion names are labels; stored IDs and rules determine identity. An unknown create response can be recovered by repeating setup.

Select **Qualified — Quiz name** in the website ad set, using the connected dataset. Pippi does not edit campaigns. `Disqualified` is a custom reporting event, not a documented negative-training instruction or a Leads Center status update.

## Visitor and data behavior

- No Pixel script, contact matching or CAPI event is sent before advertising tracking consent. Email marketing consent is separate.
- `PageView` happens after consent, before Start. An abandoned quiz adds no other Meta event.
- Qualification uses the frozen server-side attempt, actual answer IDs, outcome IDs and valid knowledge/scorecard scores. All conditions must match. Missing answers, missing scores and fallback results without a known outcome remain unclassified. A known result that differs from the selected result can be Disqualified. Empty rules cannot be published as enabled.
- Scorecards support named overall result bands and percentage thresholds for either the overall score or a specific category. Category thresholds can be used even when the overall score is unavailable. Removed categories or bands must be reviewed before publishing.
- A completed submission with saved contact details produces exactly one `Qualified` or `Disqualified` event. After-results capture waits for contact details. No standard `Lead` event is emitted.
- Browser and server events share `event_name` and `event_id`. Jobs and their original timestamps survive retries. There is no historical backfill.
- `user_data` includes available normalized, SHA-256-hashed email, valid international phone and an owner-scoped lead identifier. Optional mappings use existing explicit contact/location answers. Pippi does not guess names, phone countries or demographics.
- Actual visitor IP/user agent, `_fbp` and `_fbc` are unhashed. A missing `fbc` may be constructed only from a genuine captured `fbclid`. Missing or invalid identifiers are omitted.
- `custom_data` is an allowlist: opaque quiz ID, rule version, measured screen/viewport dimensions, pixel ratio and language. These dimensions are advertiser-defined website metadata, not native matching fields. App-only `extinfo`, native Meta `lead_id`, raw quiz answers, question text and invented money values are excluded.
- CAPI source URLs remove query strings and fragments. Pixel is a vendor script and can observe its actual page URL; do not place sensitive information in public page URLs.
- The updated embed loader shares parent URL/cookies/dimensions only after an explicit consented request from an eligible quiz frame. Source, origin, channel and request nonce are checked. Without the loader, inaccessible parent identifiers are omitted.
- Revocation stops browser events and cancels pending server delivery. Already accepted events cannot be recalled through this integration.

## Durability and observability

A durable source row links a new attempt to its consent context. Submit/contact save the qualification decision with the response; a bounded reconciler recovers missed callbacks. Workers claim jobs with compare-and-swap leases, retry temporary failures with the same event ID/time, and stop events outside Meta's seven-day acceptance window. Permission/token errors appear in connection status. Changed assets, deletion or revoked consent cancel pending delivery.

Accepted API requests are labeled **Accepted by Meta**, never attributed or matched. Use Events Manager for matching and attribution. Encrypted outbound payloads are cleared on terminal delivery status. Advertising browser context is removed after eight days; source identity boxes are cleared after reconciliation. Minimal IDs/decisions/delivery status remain with the account's records.

## Verification

- `npm run test:meta`: all 18 authored templates across six quiz types, missing qualification requirements, overall bands, category score boundaries and unavailable scores, plus qualification, missing scores, strict payloads, hashing, tenant isolation, durable delivery, retries, expiry, withdrawal, conversion recovery and capacity.
- `npm run test:browser-meta`: isolated local server, mocked Meta Graph transport and intercepted Pixel script; exercises creator setup and consented visitor flow. Never sends live Meta traffic.
- To run browser checks alongside an existing dev server, build locally first, then use `META_TEST_SERVER_MODE=production npm run test:browser-meta`; it starts a separate loopback server with mocked Meta traffic.
- Existing `test:tracking` and `test:integrations` cover compatibility with GA4/legacy tracking and CRM delivery.

Live launch still requires a real authorized tenant to verify Facebook Login, assigned assets, custom-conversion rules, received events and deduplication in Meta Events Manager. Automated mocked checks do not establish live Meta acceptance or attribution.

Official references: [Business Login CAPI template](https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business/conversions-api-integration-template), [customer information](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters), [server event parameters](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/server-event), [custom conversions](https://developers.facebook.com/docs/marketing-api/reference/custom-conversion/).
