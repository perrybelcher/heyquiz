import { createHash } from "node:crypto";
import { HttpError } from "../auth";
import { nangoKey, sendHubspot } from "./nango";
import { providers, validMapping, type NangoProvider } from "./providers";
import type { IntegrationConfig, LeadEvent } from "./schema";
import { sendHttps, type Sender, type HttpResult } from "./http";

const ok = (r: HttpResult) => r.status >= 200 && r.status < 300;
function json(r: HttpResult): unknown { // Provider responses are checked below before use.
  try { return JSON.parse(r.body); } catch { throw new HttpError(422, "Destination returned an invalid response. Review before retrying."); }
}
function confirmed(r: HttpResult, id: unknown): HttpResult {
  if (!ok(r)) return r;
  if ((typeof id !== "string" && typeof id !== "number") || !/^[a-zA-Z0-9_-]{1,128}$/.test(String(id)))
    throw new HttpError(422, "Destination did not confirm a contact ID. Review before retrying.");
  return { ...r, body: JSON.stringify({ id: String(id) }) };
}
function at(value: unknown, ...keys: (string | number)[]): unknown {
  for (const key of keys) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, key)) return undefined;
    value = (value as Record<string | number, unknown>)[key];
  }
  return value;
}
const scalar = (v: unknown) => typeof v === "object" ? JSON.stringify(v) : v;
export async function sendProvider(
  provider: NangoProvider, event: LeadEvent, secret: Record<string, string>,
  config: Pick<IntegrationConfig, "audienceId">, sender: Sender = sendHttps,
): Promise<HttpResult> {
  if (provider === "hubspot") return sendHubspot(event, secret, sender);
  const email = event.contact.email.trim().toLowerCase();
  const parts = event.contact.name?.trim().split(/\s+/).filter(Boolean) || [];
  const first = parts[0], last = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event.fields)) {
    if (!validMapping(provider, key)) throw new HttpError(422, providers[provider].mappingHelp);
    if (value !== null && value !== undefined) fields[key] = scalar(value);
  }
  const call = async (path: string, method: "GET" | "POST" | "PATCH" | "PUT", payload?: unknown, extra: Record<string, string> = {}) => {
    const body = payload === undefined ? "" : JSON.stringify(payload);
    if (Buffer.byteLength(body) > 100000) throw new HttpError(422, "CRM payload exceeds 100 KB.");
    return sender(`https://api.nango.dev/proxy${path}`, body, {
      Authorization: `Bearer ${nangoKey()}`, "Provider-Config-Key": secret.providerKey,
      "Connection-Id": secret.connectionId, ...extra,
    }, method);
  };
  if (provider === "activecampaign") {
    const r = await call("/3/contact/sync", "POST", { contact: {
      email, ...(first ? { firstName: first } : {}), ...(last ? { lastName: last } : {}),
      ...(event.contact.phone ? { phone: event.contact.phone } : {}),
      fieldValues: Object.entries(fields).map(([field, value]) => ({ field, value: String(value) })),
    } });
    return ok(r) ? confirmed(r, at(json(r), "contact", "id")) : r;
  }
  if (provider === "klaviyo") {
    const r = await call("/api/profile-import", "POST", { data: { type: "profile", attributes: {
      email, ...(first ? { first_name: first } : {}), ...(last ? { last_name: last } : {}),
      ...(event.contact.phone ? { phone_number: event.contact.phone } : {}), properties: fields,
    } } }, { "Nango-Proxy-revision": "2026-07-15", "Nango-Proxy-Content-Type": "application/vnd.api+json" });
    return ok(r) ? confirmed(r, at(json(r), "data", "id")) : r;
  }
  if (provider === "mailchimp") {
    if (!config.audienceId || !/^[a-zA-Z0-9_-]{1,128}$/.test(config.audienceId)) throw new HttpError(422, "Enter the Mailchimp audience ID.");
    const hash = createHash("md5").update(email).digest("hex");
    const r = await call(`/3.0/lists/${config.audienceId}/members/${hash}`, "PUT", {
      email_address: email, status_if_new: "transactional", merge_fields: fields,
    });
    // Do not set status, marketing_permissions or tags: never resubscribe an existing member.
    return ok(r) ? confirmed(r, at(json(r), "id")) : r;
  }
  if (provider === "keap") {
    const r = await call("/crm/rest/v1/contacts", "PUT", {
      duplicate_option: "Email", email_addresses: [{ email, field: "EMAIL1" }],
      ...(first ? { given_name: first } : {}), ...(last ? { family_name: last } : {}),
      custom_fields: Object.entries(fields).map(([id, content]) => ({ id: Number(id), content })),
    });
    return ok(r) ? confirmed(r, at(json(r), "id")) : r;
  }
  if (provider === "brevo") {
    const r = await call("/contacts", "POST", { email, attributes: fields, updateEnabled: true });
    if (!ok(r)) return r;
    if (r.body.trim() && at(json(r), "id") !== undefined) return confirmed(r, at(json(r), "id"));
    const lookup = await call(`/contacts/${encodeURIComponent(email)}`, "GET");
    return ok(lookup) ? confirmed(lookup, at(json(lookup), "id")) : lookup;
  }
  if (provider === "zoho") {
    const r = await call("/crm/v8/Contacts/upsert", "POST", {
      data: [{ Email: email, Last_Name: last || first || email, ...(first && last ? { First_Name: first } : {}),
        ...(event.contact.phone ? { Phone: event.contact.phone } : {}), ...fields }],
      duplicate_check_fields: ["Email"], trigger: [],
    });
    if (!ok(r)) return r;
    const item = at(json(r), "data", 0);
    if (at(item, "status") !== "success" || at(item, "code") !== "SUCCESS")
      throw new HttpError(422, "Zoho rejected the contact. Check required fields, field types and duplicate rules.");
    return confirmed(r, at(item, "details", "id"));
  }
  if (provider === "freshsales") {
    const r = await call("/api/contacts/upsert", "POST", {
      unique_identifier: { emails: email }, contact: {
        ...(first ? { first_name: first } : {}), ...(last ? { last_name: last } : {}),
        ...(event.contact.phone ? { mobile_number: event.contact.phone } : {}), custom_field: fields,
      },
    });
    return ok(r) ? confirmed(r, at(json(r), "contact", "id")) : r;
  }
  if (provider === "salesforce") {
    // A unique External ID provides retry-safe upsert without lookup/create races.
    const path = `/services/data/v61.0/sobjects/Contact/HeyQuiz_Email__c/${encodeURIComponent(email)}`;
    const r = await call(path, "PATCH", {
      Email: email, LastName: last || first || email, ...(first && last ? { FirstName: first } : {}),
      ...(event.contact.phone ? { Phone: event.contact.phone } : {}), ...fields,
    });
    if (!ok(r)) return r;
    if (r.status !== 204) return confirmed(r, at(json(r), "id"));
    const lookup = await call(`${path}?fields=Id`, "GET");
    return ok(lookup) ? confirmed(lookup, at(json(lookup), "Id")) : lookup;
  }
  // Twenty REST filters have their own grammar. Reject grammar delimiters rather than
  // allowing an email to change the filter, and verify every returned match explicitly.
  if (!/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+$/.test(email))
    throw new HttpError(422, "This email format is not supported by the Twenty connector.");
  const query = new URLSearchParams({ filter: `emails.primaryEmail[eq]:${email}`, limit: "2", depth: "0", fields: "id,emails" });
  const found = await call(`/people?${query}`, "GET");
  if (!ok(found)) return found;
  const people = at(json(found), "data", "people");
  if (!Array.isArray(people) || people.some(p => String(at(p, "emails", "primaryEmail") || "").toLowerCase() !== email))
    throw new HttpError(422, "Twenty returned an unexpected contact match.");
  if (people.length > 1) throw new HttpError(422, "Multiple Twenty contacts match this email. Resolve duplicates before retrying.");
  // Stable UUID makes repeated creates converge even after a timed-out successful request.
  const h = createHash("sha256").update(`heyquiz:twenty:${email}`).digest("hex");
  const stableId = `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
  const existingId = at(people[0], "id");
  if (people.length && (typeof existingId !== "string" || !/^[0-9a-f-]{36}$/i.test(existingId))) throw new HttpError(422, "Twenty returned an invalid contact ID.");
  const payload = { ...fields, ...(parts.length ? { name: { firstName: first, lastName: last || "" } } : {}) };
  const r = existingId
    ? await call(`/people/${existingId}`, "PATCH", payload)
    : await call("/people", "POST", { ...payload, id: stableId, emails: { primaryEmail: email } });
  // A concurrent create is retried via lookup by the queue; never update an unverified ID.
  if (r.status === 409) return { ...r, status: 429, retryAfter: "30" };
  return ok(r) ? confirmed(r, at(json(r), "data", existingId ? "updatePerson" : "createPerson", "id")) : r;
}
