# Nango + HubSpot pilot

The Integrate screen now supports HubSpot authorization through Nango, contact create/update, custom property mapping, and the existing consent-gated delivery queue. This is a pilot, not a claim that all Nango providers are supported.

## Server setup

Set these server-only environment variables in Vercel Production (and a separate local environment for development):

- `NANGO_SECRET_KEY`: a Nango Environment API key, not an Account API key.
- `NANGO_HUBSPOT_INTEGRATION_ID`: the HubSpot integration ID in that same environment (`hubspot` for the pilot).

Use a restricted environment key with exactly:

- `environment:connect_sessions:write`
- `environment:connections:list` (metadata only; required to discover the completed hosted connection by server-issued tags)
- `environment:proxy`

No credential-read, account management, integration modification, or deletion scope is required. Keep the key out of Git, browser bundles, logs, and screenshots. Redeploy after setting environment variables. Missing configuration shows a disabled connection button and the API returns 503.

A HubSpot integration was created in the user's Nango `dev` environment using Nango's testing developer app. Nango says to use your own developer app for production. Before a customer rollout, configure a HeyQuiz-owned HubSpot OAuth app, register `https://api.nango.dev/oauth/callback`, and configure the corresponding Nango integration. The app requests only `oauth crm.objects.contacts.read crm.objects.contacts.write` through session scope overrides. Verify the actual provider consent screen during the first live authorization; do not accept unexpected permissions.

## User flow

1. Open a quiz → Integrate → Connect HubSpot.
2. Open the generated authorization link in a new tab and choose the intended HubSpot account.
3. Return to HeyQuiz and select Check connection. The server verifies the provider, integration ID, opaque owner tag, quiz ID, and a random request nonce. The browser cannot submit an arbitrary connection ID.
4. The connection is created paused. Configure custom property mappings, save, and send a synthetic test before enabling new lead delivery.

The Nango hosted session expires after 30 minutes. If dismissed or expired, start again. Completed connections left unclaimed in Nango can consume the free connection allowance; review these in Nango Connections. Pausing a HeyQuiz connection stops lead delivery but does not revoke the HubSpot authorization or free a Nango connection slot. Revocation is managed in the provider/Nango dashboard in this pilot. After revoking, create a new connection and pause the old one. There is no automatic historical backfill.

## Data and delivery

Email, first/last name and optional phone map automatically. Quiz mappings are restricted to existing HubSpot custom properties named `heyquiz_*`, preventing changes to identity, unsubscribe, marketing status or lifecycle fields. Examples: `heyquiz_score`, `heyquiz_segment`, `heyquiz_result`, `heyquiz_consent`, `heyquiz_consent_text`, `heyquiz_consent_recorded_at`. Create these properties in HubSpot first. Use number for scores, boolean for consent, and text for timestamps or JSON category scores. Invalid property names/types cause a visible terminal delivery failure for correction and manual retry.

Only contacts with marketing opt-in are eligible. HubSpot subscription preferences are never changed. Quiz consent recorded in custom fields is not a HubSpot subscription. Customer workflows must honor existing unsubscribe preferences.

The adapter uses PATCH by email for partial updates; on 404 it creates a contact, then handles a concurrent-create 409 by PATCHing again. This avoids an unconditional create on retries and preserves unmapped CRM properties. It deliberately avoids HubSpot email batch upsert because that endpoint does not support partial upserts. Transport/429/5xx failures use the existing durable retry queue, with six attempts, bounded timeouts, and manual retries for terminal failures. Concurrent quiz completions for the same email can update mapped fields in completion order; no cross-quiz event ordering guarantee is made.

Synthetic tests use heyquiz-test@example.com. Remote HubSpot workflows can still react to contact changes, so use a test portal or exclude that address from automation. No real CRM authorization or live HubSpot contact delivery has been verified yet.

## Validation

- `npm run test:nango`: 15 isolated authorization/adapter/queue checks with synthetic data and mocked Nango/HubSpot responses.
- `node tests/browser-nango.cjs`: 8 API/browser checks including missing configuration, unauthorized access, cross-origin rejection, hosted link flow, paused setup, mapping, and mobile layout. Browser OAuth responses are mocked; no CRM permission is granted by this test.
- Existing integration regression suite: 21 checks.
- Existing scoring/marketing regression suite: 25 checks.

References: [Nango sessions](https://nango.dev/docs/reference/backend/http-api/connect/sessions/create), [connection listing](https://nango.dev/docs/reference/backend/http-api/connections/list), [API key scopes](https://nango.dev/docs/reference/backend/http-api/api-keys), [proxy](https://nango.dev/docs/guides/platform/proxy-requests), [HubSpot contacts](https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/contacts/guide).
