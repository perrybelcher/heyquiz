# Nango provider setup

The ten-provider pilot includes HubSpot, ActiveCampaign, Klaviyo, Mailchimp, Keap, Brevo, Zoho CRM, Freshsales, Salesforce and Twenty CRM. GoHighLevel and webhooks retain their existing direct adapters. This release implements authorization and contact delivery; it does not claim live verification, marketplace approval, two-way synchronization or email subscription management.

## Server configuration

Use the restricted environment key and permissions documented in [the HubSpot setup](nango-hubspot.md). Set `NANGO_SECRET_KEY` only on the server. Configure each integration in the same Nango environment, then set its ID in the matching environment variable. Missing configuration disables that provider's Connect button. Do not reuse a provider definition for a different service.

| HeyQuiz environment variable | Nango provider | Extra setup |
| --- | --- | --- |
| NANGO_HUBSPOT_INTEGRATION_ID | hubspot | Own OAuth app for production; contacts read/write scopes |
| NANGO_ACTIVECAMPAIGN_INTEGRATION_ID | active-campaign | Account hostname and API key |
| NANGO_KLAVIYO_INTEGRATION_ID | klaviyo | API key with profiles write and account read for Nango verification |
| NANGO_MAILCHIMP_INTEGRATION_ID | mailchimp | OAuth app; audience ID entered in HeyQuiz |
| NANGO_KEAP_INTEGRATION_ID | keap | OAuth app |
| NANGO_BREVO_INTEGRATION_ID | brevo-api-key | API key |
| NANGO_ZOHO_INTEGRATION_ID | zoho-crm | OAuth app; correct region; Contacts create/update permissions |
| NANGO_FRESHSALES_INTEGRATION_ID | freshsales | API key and bundle alias, including /crm/sales for Suite accounts |
| NANGO_SALESFORCE_INTEGRATION_ID | salesforce | OAuth app with API and refresh permissions; Contact setup below |
| NANGO_TWENTY_INTEGRATION_ID | twenty-crm | Twenty Cloud API key; People read/write and company read for Nango verification |

Configuring a provider is separate from authorizing a customer's account. Nango's free connection allowance counts authorized accounts. Creating multiple per-quiz connections can consume multiple slots. No paid plan is required for local development, but live use remains subject to the account's limits.

## Connection and field mapping

Start Connect, authorize in the hosted Nango flow, return and Check connection. The server verifies the provider, owner, quiz and nonce before saving encrypted connection references. Connections start paused. Add custom fields in the destination first, map them in HeyQuiz, save and send a synthetic test before enabling delivery. Changing settings invalidates older queued jobs until manual retry.

| Provider | Quiz mapping targets | Contact behavior |
| --- | --- | --- |
| HubSpot | heyquiz_score style custom properties | Partial update by email, create if absent |
| ActiveCampaign | Numeric custom-field IDs | Email contact sync; no list/tag changes |
| Klaviyo | heyquiz_score style profile properties | Profile import; no subscription changes |
| Mailchimp | Existing HQ-prefixed merge tags, max 10 characters | Audience member upsert; new contacts non-subscribed, existing status unchanged |
| Keap | Numeric custom-field IDs | Email duplicate check; no opt-in override |
| Brevo | HEYQUIZ_SCORE style attributes | Contact create/update; no blocklist or list changes |
| Zoho CRM | HeyQuiz_Score style Contacts API field names | Contacts upsert by Email; validates record-level success |
| Freshsales | cf_heyquiz_score style custom fields | Upsert using emails unique identifier |
| Salesforce | HeyQuiz_Score__c style Contact fields | Upsert by unique HeyQuiz_Email__c external ID |
| Twenty CRM | heyquizScore style People fields | Exact primary-email lookup, update or stable-ID create |

Not every provider accepts the same field types. Object/array quiz values are serialized as JSON text. Use destination fields compatible with the mapped value; unsupported values fail visibly. Email is always mapped. Name and phone support varies by provider; Mailchimp, Brevo and Keap have intentionally limited standard-field mapping in this pilot. These adapters deliver profile/contact data, not marketing subscriptions. Configure downstream campaigns to respect consent and existing suppression preferences.

Salesforce requires a **unique External ID text field** named `HeyQuiz_Email__c` on Contact. Populate it with lowercase email addresses for existing contacts before enabling delivery, otherwise an existing contact without that key can be duplicated. Resolve duplicate emails before backfilling. Additional organization-required fields or validation rules can reject delivery. Contact is the supported object; Lead is not supported in this pilot.

Zoho requires Last_Name; when no name is supplied, email is used as a fallback. Salesforce similarly requires LastName. Twenty supports Cloud and standard People composite fields; self-hosted schemas need separate validation. Twenty fails closed on multiple or unexpected email matches, and uses a stable UUID to prevent duplicate creates on retries. Mailchimp synthetic and real new contacts use transactional (non-subscribed) status, preventing test confirmation emails. Destination automations can still run on contact changes.

## Verification and limitations

`node tests/providers.cjs` exercises all provider authorization flows and simulated delivery responses. `npm run test:nango` and the existing integration suite cover the shared queue, ownership and consent behavior. Browser tests cover the connection UI. These tests do not replace live verification in each provider's test account. Live OAuth/API-key authorizations, provider app registration where required, server secrets and end-to-end contact verification remain prerequisites for activation.

Sources checked October 8, 2026:
- [Nango provider definitions](https://github.com/NangoHQ/nango/blob/master/packages/providers/providers.yaml)
- [ActiveCampaign sync](https://developers.activecampaign.com/reference/sync-a-contacts-data)
- [Klaviyo profile import](https://developers.klaviyo.com/en/reference/create_or_update_profile)
- [Mailchimp member upsert](https://mailchimp.com/developer/marketing/api/lists/members/upsert-member)
- [Keap REST API](https://developer.keap.com/docs/rest/)
- [Brevo contact creation](https://developers.brevo.com/reference/create-contact)
- [Zoho upsert](https://www.zoho.com/crm/developer/docs/api/v8/upsert-records.html)
- [Freshsales contacts](https://developers.freshworks.com/crm/api/)
- [Salesforce external-ID upsert](https://developer.salesforce.com/docs/platform/api-rest/guide/dome-upsert.html)
- [Twenty APIs](https://docs.twenty.com/developers/extend/api)

## Setup status on October 8, 2026

Nine definitions now exist in the Nango dev environment: hubspot, active-campaign, klaviyo, mailchimp, brevo-api-key, zoho-crm, freshsales, salesforce and twenty-crm. Keap requires a customer-owned developer app's client ID and secret; no Nango test app is available. No real CRM account is authorized.

HubSpot, Mailchimp, Zoho and Salesforce use Nango's developer apps for testing only. HeyQuiz overrides HubSpot, Zoho and Salesforce session scopes to contact access / API plus refresh access, avoiding the broader default test-app scopes. Verify the actual consent screen before granting access. Own OAuth apps remain required for production rollout.

The restricted HeyQuiz integrations key (connection metadata list, Connect Sessions write, proxy) is saved as a production secret in Vercel. Nine provider IDs are configured and deployment B1j1dZprZvdHctoxp79ZufDKUsEk completed successfully. Keap remains disabled. Real account authorization and live delivery verification are still pending.
