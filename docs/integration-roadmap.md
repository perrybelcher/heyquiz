# HeyQuiz integration roadmap

Updated October 8, 2026. This tracks implementation status, not live connections. See [provider setup](nango-providers.md).

## CRM scope

| Provider | Current status |
| --- | --- |
| GoHighLevel | Direct adapter implemented; live account verification pending |
| HubSpot | Nango pilot implemented; server configuration and live verification pending |
| Zoho CRM | Pilot implemented locally; server setup and live verification pending |
| Freshworks — Freshsales CRM | Pilot implemented locally; server setup and live verification pending |
| Salesforce | Pilot implemented locally; server setup and live verification pending |
| Keap / Infusionsoft | Pilot implemented locally; server setup and live verification pending |
| Twenty CRM | Pilot implemented locally; server setup and live verification pending |

## Email and marketing platforms

ActiveCampaign, Klaviyo, Mailchimp and Brevo have local pilot adapters; server setup and live verification remain pending.

Nango is the preferred authorization layer where the required provider and authentication method are supported. Validate support, API access requirements and account editions for each platform before choosing Nango or a direct adapter. No new live account connection is created by adding a roadmap entry.

Freshworks means its Freshsales CRM product for this roadmap. Select the Nango provider and authorization method that match the customer's Freshsales edition before implementation.

## Shared acceptance criteria

Each new adapter must support consent-gated contact or lead creation/update, quiz result/score/segment field mapping, duplicate handling, visible delivery failures, retry handling, and a synthetic end-to-end test in a dedicated CRM test account. Connections must remain bound to the correct HeyQuiz owner and quiz. Existing unsubscribe preferences must be preserved.

For Zoho, validate the account's region, authorization scopes, target module, required fields and duplicate rules. For Freshsales, validate the account domain, edition, authorization method and custom-field schema. For Salesforce, decide Lead versus Contact, validate required fields and duplicate rules, and test in a sandbox before production use. Availability in Nango's catalog does not itself implement these behaviors.

## Rollout

Finish the existing HubSpot pilot first, then implement and verify each additional adapter separately. Keep providers labeled planned until their authorization and delivery flows are implemented and tested.

The roadmap contains seven CRM platforms plus four email/marketing platforms. GoHighLevel uses its existing direct adapter; the remaining transport choices must be validated individually. Nango's free allowance of ten connected accounts is not a ten-provider limit; multiple customers authorizing the same provider each consume connections. Recheck billing before live rollout.

References: [Nango provider catalog](https://nango.dev/api-integrations), [Zoho CRM authorization](https://www.zoho.com/crm/developer/docs/api/v8/auth-request.html), [HubSpot pilot setup](nango-hubspot.md).
