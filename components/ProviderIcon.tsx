import Image from "next/image";
import { Webhook, Plug } from "lucide-react";
const marks: Record<string,string> = {
  hubspot:"hubspot",activecampaign:"active-campaign",klaviyo:"klaviyo",mailchimp:"mailchimp",keap:"keap",brevo:"brevo-api-key",zoho:"zoho-crm",freshsales:"freshsales",salesforce:"salesforce",twenty:"twenty-crm",gohighlevel:"highlevel",ga4:"google-analytics",meta:"meta-marketing-api",ai:"google-gemini",cloud:"supabase",captcha:"cloudflare",
};
/** Decorative: the adjacent provider name supplies the accessible label. */
export default function ProviderIcon({provider,small=false}:{provider:string;small?:boolean}) {
  const mark=marks[provider],Icon=provider==="webhook"?Webhook:Plug;
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white shadow-sm ${small?'h-8 w-8 p-1.5':'h-12 w-12 p-1.5'}`}>
    {mark ? <Image unoptimized src={`/integrations/${mark}.svg`} alt="" width={small?20:28} height={small?20:28} className={`h-full w-full object-contain ${provider === "salesforce" ? "scale-125" : ""}`}/> : <Icon size={small?18:25} className="text-indigo-600"/>}
  </span>;
}
