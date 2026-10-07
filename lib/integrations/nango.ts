import { createHash, randomUUID } from "node:crypto";
import { HttpError } from "../auth";
import { listRecords, readRecord, writeRecord } from "../records";
import { seal } from "./secrets";
import { sendHttps, type Sender, type HttpResult } from "./http";
import type { IntegrationConfig, LeadEvent } from "./schema";

// Only server code imports this module. Never expose the environment API key.
export const nangoConfigured = () =>
  Boolean(
    process.env.NANGO_SECRET_KEY && process.env.NANGO_HUBSPOT_INTEGRATION_ID,
  );
export function nangoKey() {
  if (!nangoConfigured())
    throw new HttpError(
      503,
      "HubSpot setup is pending. Configure the Nango environment key and HubSpot integration ID on the server.",
    );
  return process.env.NANGO_SECRET_KEY!;
}
const ownerTag = (owner: string) =>
  createHash("sha256").update(`heyquiz:${owner}`).digest("hex");
interface ConnectAttempt {
  formId: string;
  providerKey: string;
  expiresAt: number;
}
interface RemoteConnection {
  connection_id: string;
  provider_config_key: string;
  provider: string;
  tags?: Record<string, string>;
  errors?: unknown[];
}
async function control(
  path: string,
  method: "GET" | "POST",
  body: unknown,
  sender: Sender,
) {
  const r = await sender(
    `https://api.nango.dev${path}`,
    method === "GET" ? "" : JSON.stringify(body),
    { Authorization: `Bearer ${nangoKey()}` },
    method,
  );
  if (r.status < 200 || r.status >= 300)
    throw new HttpError(
      502,
      `Nango returned HTTP ${r.status}. Check the environment key, integration, permissions, and free-plan limits.`,
    );
  try {
    return JSON.parse(r.body);
  } catch {
    throw new HttpError(502, "Nango returned an invalid response.");
  }
}
export async function startHubspot(
  formId: string,
  owner: string,
  sender: Sender = sendHttps,
) {
  nangoKey();
  const id = randomUUID(),
    providerKey = process.env.NANGO_HUBSPOT_INTEGRATION_ID!;
  const data = await control(
    "/connect/sessions",
    "POST",
    {
      allowed_integrations: [providerKey],
      integrations_config_defaults: {
        [providerKey]: {
          connection_config: {
            oauth_scopes_override:
              "oauth crm.objects.contacts.read crm.objects.contacts.write",
          },
        },
      },
      tags: {
        heyquiz_owner: ownerTag(owner),
        heyquiz_form: formId,
        heyquiz_attempt: id,
      },
    },
    sender,
  );
  let link: URL;
  try {
    link = new URL(data.data.connect_link);
  } catch {
    throw new HttpError(502, "Nango did not return a connection link.");
  }
  if (
    link.protocol !== "https:" ||
    link.hostname !== "connect.nango.dev" ||
    link.username ||
    link.password ||
    link.port
  )
    throw new HttpError(502, "Nango returned an unexpected connection link.");
  const expiresAt = Math.min(
    Date.parse(data.data.expires_at),
    Date.now() + 30 * 60 * 1000,
  );
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
    throw new HttpError(502, "Nango returned an expired session.");
  await writeRecord<ConnectAttempt>(
    "meta",
    `nango-${id}`,
    owner,
    { formId, providerKey, expiresAt },
    0,
  );
  return { attemptId: id, connectLink: link.href, expiresAt };
}
// The client never chooses the Nango connection ID. Discover it using the
// server-issued nonce and verify every ownership tag again before binding it.
export async function finishHubspot(
  formId: string,
  owner: string,
  attemptId: string,
  sender: Sender = sendHttps,
) {
  const attempt = await readRecord<ConnectAttempt>(
    "meta",
    `nango-${attemptId}`,
  );
  if (
    !attempt ||
    attempt.owner_id !== owner ||
    attempt.payload.formId !== formId
  )
    throw new HttpError(404, "Connection request not found.");
  const existing = await readRecord<IntegrationConfig>(
    "integrations",
    attemptId,
  );
  if (existing?.owner_id === owner && existing.payload.formId === formId)
    return existing;
  if (attempt.payload.expiresAt <= Date.now())
    throw new HttpError(410, "Connection request expired. Start again.");
  if (
    (await listRecords<IntegrationConfig>("integrations", owner)).filter(
      (c) => c.payload.formId === formId,
    ).length >= 10
  )
    throw new HttpError(422, "A quiz can have up to 10 connections.");
  const tags = {
    heyquiz_owner: ownerTag(owner),
    heyquiz_form: formId,
    heyquiz_attempt: attemptId,
  };
  const query = new URLSearchParams({ limit: "10" });
  for (const [k, v] of Object.entries(tags)) query.set(`tags[${k}]`, v);
  const body = await control(`/connections?${query}`, "GET", undefined, sender);
  if (!Array.isArray(body.connections))
    throw new HttpError(502, "Nango returned an invalid connection list.");
  const matches = (body.connections as RemoteConnection[]).filter(
    (c) =>
      c.provider === "hubspot" &&
      c.provider_config_key === attempt.payload.providerKey &&
      Object.entries(tags).every(([k, v]) => c.tags?.[k] === v),
  );
  if (!matches.length) return null;
  if (matches.length !== 1)
    throw new HttpError(
      409,
      "Multiple accounts were authorized. Start a new connection request.",
    );
  const remote = matches[0];
  if (remote.errors?.length)
    throw new HttpError(
      422,
      "HubSpot authorization needs attention. Reconnect your account.",
    );
  if (!/^[a-zA-Z0-9_-]{1,256}$/.test(remote.connection_id))
    throw new HttpError(502, "Nango returned an invalid connection ID.");
  const now = new Date().toISOString();
  const config: IntegrationConfig = {
    id: attemptId,
    formId,
    provider: "hubspot",
    name: "HubSpot",
    enabled: false,
    consentOnly: true,
    locationId: "",
    tags: [],
    resultTag: false,
    mappings: [],
    destination: "HubSpot via Nango",
    createdAt: now,
    updatedAt: now,
    activeFrom: now,
    secretBox: seal(
      {
        connectionId: remote.connection_id,
        providerKey: remote.provider_config_key,
      },
      `${owner}:${formId}:${attemptId}`,
    ),
  };
  try {
    return await writeRecord("integrations", attemptId, owner, config, 0);
  } catch (error) {
    const raced = await readRecord<IntegrationConfig>(
      "integrations",
      attemptId,
    );
    if (raced?.owner_id === owner && raced.payload.formId === formId)
      return raced;
    throw error;
  }
}
export function hubspotProperties(event: LeadEvent) {
  const properties: Record<string, string> = {
    email: event.contact.email.trim().toLowerCase(),
  };
  const name = event.contact.name?.trim().split(/\s+/);
  if (name?.length) {
    properties.firstname = name[0];
    if (name.length > 1) properties.lastname = name.slice(1).join(" ");
  }
  if (event.contact.phone) properties.phone = event.contact.phone;
  for (const [key, value] of Object.entries(event.fields)) {
    // Custom namespace prevents changing unsubscribe, identity, lifecycle or billing properties.
    if (!/^heyquiz_[a-z0-9_]+$/.test(key))
      throw new HttpError(
        422,
        "Use heyquiz_ custom properties for HubSpot quiz data.",
      );
    if (value !== undefined && value !== null)
      properties[key] =
        typeof value === "object" ? JSON.stringify(value) : String(value);
  }
  return properties;
}
export async function sendHubspot(
  event: LeadEvent,
  secret: Record<string, string>,
  sender: Sender = sendHttps,
): Promise<HttpResult> {
  const properties = hubspotProperties(event),
    body = JSON.stringify({ properties });
  if (Buffer.byteLength(body) > 262144)
    throw new HttpError(422, "HubSpot payload exceeds 256 KB.");
  const headers = {
    Authorization: `Bearer ${nangoKey()}`,
    "Provider-Config-Key": secret.providerKey,
    "Connection-Id": secret.connectionId,
  };
  const root = "https://api.nango.dev/proxy/crm/v3/objects/contacts";
  const url = `${root}/${encodeURIComponent(properties.email)}?idProperty=email`;
  // Partial update preserves other CRM properties. If absent, create; if another
  // worker won the create race (409), update by email instead of duplicating.
  let response = await sender(url, body, headers, "PATCH");
  if (response.status === 404) {
    response = await sender(root, body, headers, "POST");
    if (response.status === 409)
      response = await sender(url, body, headers, "PATCH");
  }
  return response;
}
