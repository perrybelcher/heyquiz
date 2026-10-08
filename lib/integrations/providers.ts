// Browser-safe catalog. Credentials and integration IDs stay on the server.
export const nangoProviders = ["hubspot", "activecampaign", "klaviyo", "mailchimp", "keap", "brevo", "zoho", "freshsales", "salesforce", "twenty"] as const;
export type NangoProvider = typeof nangoProviders[number];
export const isNangoProvider = (value: string): value is NangoProvider =>
  (nangoProviders as readonly string[]).includes(value);
export interface ProviderDefinition {
  name: string;
  nangoProvider: string;
  mappingPattern: RegExp;
  mappingHelp: string;
  scopes?: string;
}
export const providers: Record<NangoProvider, ProviderDefinition> = {
  hubspot: { name: "HubSpot", nangoProvider: "hubspot", mappingPattern: /^heyquiz_[a-z0-9_]+$/, mappingHelp: "Existing heyquiz_ custom properties, e.g. heyquiz_score.", scopes: "oauth crm.objects.contacts.read crm.objects.contacts.write" },
  activecampaign: { name: "ActiveCampaign", nangoProvider: "active-campaign", mappingPattern: /^[1-9][0-9]*$/, mappingHelp: "Numeric contact custom-field IDs. Lists and subscription preferences are unchanged." },
  klaviyo: { name: "Klaviyo", nangoProvider: "klaviyo", mappingPattern: /^heyquiz_[a-z0-9_]+$/, mappingHelp: "Profile properties, e.g. heyquiz_score. Does not subscribe profiles to email or SMS." },
  mailchimp: { name: "Mailchimp", nangoProvider: "mailchimp", mappingPattern: /^HQ[A-Z0-9_]{1,8}$/, mappingHelp: "Existing audience merge tags beginning HQ (10 characters maximum), e.g. HQSCORE. New contacts are non-subscribed; existing subscription status is preserved." },
  keap: { name: "Keap / Infusionsoft", nangoProvider: "keap", mappingPattern: /^[1-9][0-9]*$/, mappingHelp: "Numeric contact custom-field IDs. Does not change email permission or add campaign tags." },
  brevo: { name: "Brevo", nangoProvider: "brevo-api-key", mappingPattern: /^HEYQUIZ_[A-Z0-9_]+$/, mappingHelp: "Existing contact attributes, e.g. HEYQUIZ_SCORE. Blocklist preferences are preserved." },
  zoho: { scopes: "ZohoCRM.modules.contacts.WRITE,ZohoCRM.modules.contacts.CREATE", name: "Zoho CRM", nangoProvider: "zoho-crm", mappingPattern: /^HeyQuiz_[A-Za-z0-9_]+$/, mappingHelp: "Existing Contacts custom-field API names, e.g. HeyQuiz_Score. Uses Email to match contacts." },
  freshsales: { name: "Freshworks / Freshsales", nangoProvider: "freshsales", mappingPattern: /^cf_heyquiz_[a-z0-9_]+$/, mappingHelp: "Existing contact custom fields, e.g. cf_heyquiz_score. Your bundle alias must match your Freshsales edition." },
  salesforce: { scopes: "api refresh_token", name: "Salesforce", nangoProvider: "salesforce", mappingPattern: /^HeyQuiz_[A-Za-z0-9_]+__c$/, mappingHelp: "Contact custom fields, e.g. HeyQuiz_Score__c. Requires a unique External ID text field HeyQuiz_Email__c, populated with lowercase emails for existing contacts." },
  twenty: { name: "Twenty CRM", nangoProvider: "twenty-crm", mappingPattern: /^heyquiz[A-Z][A-Za-z0-9]*$/, mappingHelp: "People custom-field names, e.g. heyquizScore. Twenty Cloud is supported; self-hosted setup requires a separate adapter configuration." },
};
export function validMapping(provider: NangoProvider, target: string) {
  return providers[provider].mappingPattern.test(target) && target !== "HeyQuiz_Email__c" &&
    (!["activecampaign", "keap"].includes(provider) || Number.isSafeInteger(Number(target)));
}
