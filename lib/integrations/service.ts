import { createHash, createHmac, randomUUID } from "node:crypto";
import {
  IntegrationInput,
  type IntegrationConfig,
  type IntegrationView,
  type LeadEvent,
  type DeliveryJob,
} from "./schema";
import { seal, unseal } from "./secrets";
import { webhookUrl, sendHttps, type Sender, type HttpResult } from "./http";
import {
  readRecord,
  writeRecord,
  listRecords,
  type StoredRecord,
} from "../records";
import type { QuizSubmissionResult, FormSchemaType } from "../schema";
import { HttpError } from "../auth";
import { sendHubspot } from "./nango";
const scope = (owner: string, c: Pick<IntegrationConfig, "formId" | "id">) =>
  `${owner}:${c.formId}:${c.id}`;
export const deliveryAllowed = () =>
  !process.env.VERCEL || process.env.VERCEL_ENV === "production";
export async function requireForm(formId: string, owner: string) {
  const f = await readRecord<FormSchemaType>("forms", formId);
  if (f?.owner_id !== owner) throw new HttpError(404, "Quiz not found.");
  return f.payload;
}
export function integrationView(
  row: StoredRecord<IntegrationConfig>,
): IntegrationView {
  const { secretBox: _secret, ...config } = row.payload;
  return {
    ...config,
    revision: row.version,
    credentialsSaved: Boolean(_secret),
  };
}
export async function connections(formId: string, owner: string) {
  return (await listRecords<IntegrationConfig>("integrations", owner)).filter(
    (r) => r.payload.formId === formId,
  );
}
export async function ownedConnection(
  id: string,
  formId: string,
  owner: string,
) {
  const row = await readRecord<IntegrationConfig>("integrations", id);
  if (!row || row.owner_id !== owner || row.payload.formId !== formId)
    throw new HttpError(404, "Connection not found.");
  return row;
}
export async function saveConnection(
  formId: string,
  owner: string,
  input: unknown,
) {
  await requireForm(formId, owner);
  const parsed = IntegrationInput.safeParse(input);
  if (!parsed.success)
    throw new HttpError(
      422,
      parsed.error.issues[0]?.message || "Check the connection settings.",
    );
  const data = parsed.data;
  const old = data.id ? await ownedConnection(data.id, formId, owner) : null;
  if (old && old.payload.provider !== data.provider)
    throw new HttpError(
      422,
      "Create a separate connection to change provider.",
    );
  if (!old && (await connections(formId, owner)).length >= 10)
    throw new HttpError(422, "A quiz can have up to 10 connections.");
  const id = old?.id || randomUUID(),
    now = new Date().toISOString();
  const secrets = old
    ? unseal(old.payload.secretBox, scope(owner, old.payload))
    : {};
  if (data.provider === "webhook") {
    if (data.url) secrets.url = webhookUrl(data.url).href;
    if (!secrets.url)
      throw new HttpError(422, "Enter the webhook destination URL.");
    if (data.signingSecret) secrets.signingSecret = data.signingSecret;
  } else if (data.provider === "gohighlevel") {
    if (data.token) secrets.token = data.token;
    if (!secrets.token)
      throw new HttpError(
        422,
        "Enter the HighLevel private integration token.",
      );
  } else if (!old || !secrets.connectionId || !secrets.providerKey) {
    throw new HttpError(422, "Authorize HubSpot using Connect HubSpot first.");
  }
  const config: IntegrationConfig = {
    id,
    formId,
    name: data.name,
    provider: data.provider,
    enabled: data.enabled,
    consentOnly: data.consentOnly,
    locationId: data.locationId,
    tags: data.tags,
    resultTag: data.resultTag,
    mappings: data.mappings,
    destination:
      data.provider === "webhook"
        ? new URL(secrets.url).hostname
        : data.provider === "hubspot"
          ? "HubSpot via Nango"
          : `HighLevel · ${data.locationId}`,
    secretBox: seal(secrets, scope(owner, { id, formId })),
    createdAt: old?.payload.createdAt || now,
    updatedAt: now,
    activeFrom: now,
  };
  return integrationView(
    await writeRecord("integrations", id, owner, config, data.revision),
  );
}
function sourceValue(event: LeadEvent, source: string): unknown {
  const [group, key] = source.split(".");
  if (!key)
    return Object.hasOwn(event, group)
      ? event[group as keyof LeadEvent]
      : undefined;
  const obj = event[group as keyof LeadEvent];
  return obj && typeof obj === "object" && Object.hasOwn(obj, key)
    ? (obj as Record<string, unknown>)[key]
    : undefined;
}
export function makeEvent(
  result: QuizSubmissionResult,
  eventId: string,
  config: IntegrationConfig,
): LeadEvent {
  if (!result.contact || !result.id)
    throw Error("Delivery requires a saved contact.");
  const e: LeadEvent = {
    schemaVersion: 1,
    event: "lead.captured",
    eventId,
    responseId: result.id,
    formId: result.formId,
    submittedAt: result.submittedAt,
    score: result.percentageScore,
    contact: {
      email: result.contact.email,
      name: result.contact.name,
      phone: result.contact.phone,
      marketingConsent: result.contact.marketingConsent,
      recordedAt: result.contact.recordedAt,
      consentText: result.contact.consentText,
      privacyUrl: result.contact.privacyUrl,
      purposeText: result.contact.purposeText,
      formRevision: result.contact.formRevision,
      placement: result.contact.placement,
    },
    result: {
      kind: result.marketing?.kind,
      status: result.marketing?.status,
      title: result.marketing?.title || result.matchedTier?.title,
      outcomeId: result.marketing?.outcomeId,
      categories: result.marketing?.categories,
    },
    answers: result.answers || {},
    fields: {},
  };
  for (const m of config.mappings) {
    const value = sourceValue(e, m.source);
    if (value !== undefined)
      Object.defineProperty(e.fields, m.target, {
        value,
        enumerable: true,
        configurable: true,
      });
  }
  return e;
}
async function enqueue(
  row: StoredRecord<IntegrationConfig>,
  result: QuizSubmissionResult,
) {
  const c = row.payload;
  if (
    !result.contact ||
    !result.id ||
    !c.enabled ||
    result.formId !== c.formId ||
    result.contact.recordedAt < c.activeFrom
  )
    return;
  const id = createHash("sha256")
    .update(`${row.id}:${result.id}`)
    .digest("hex");
  if (await readRecord("deliveries", id)) return;
  const skipped = c.consentOnly && !result.contact.marketingConsent;
  const job: DeliveryJob = {
    id,
    formId: c.formId,
    connectionId: c.id,
    connectionName: c.name,
    connectionRevision: row.version,
    event: makeEvent(result, id, c),
    state: skipped ? "skipped" : "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
    nextAttemptAt: Date.now(),
    test: false,
    lastMessage: skipped
      ? "Not sent: marketing consent was not given."
      : "Queued for delivery.",
  };
  try {
    await writeRecord("deliveries", id, row.owner_id, job, 0);
  } catch (error) {
    if (!(await readRecord("deliveries", id))) throw error;
  }
}
export async function enqueueSubmission(
  owner: string,
  result: QuizSubmissionResult,
) {
  for (const c of await connections(result.formId, owner))
    await enqueue(c, result);
}
export async function createTest(
  formId: string,
  owner: string,
  connectionId: string,
) {
  await requireForm(formId, owner);
  const row = await ownedConnection(connectionId, formId, owner),
    id = randomUUID(),
    now = new Date().toISOString();
  const event: LeadEvent = {
    schemaVersion: 1,
    event: "connection.test",
    eventId: id,
    responseId: `test-${id}`,
    formId,
    submittedAt: now,
    score: 75,
    contact: {
      email: "heyquiz-test@example.com",
      name: "HeyQuiz Test",
      marketingConsent: true,
      recordedAt: now,
      consentText: "Synthetic integration test; not a real subscriber.",
    },
    result: {
      kind: "segmentation",
      status: "matched",
      title: "Example segment",
      outcomeId: "example",
    },
    answers: { sample: "Example answer" },
    fields: {},
  };
  for (const m of row.payload.mappings) {
    const v = sourceValue(event, m.source);
    if (v !== undefined)
      Object.defineProperty(event.fields, m.target, {
        value: v,
        enumerable: true,
      });
  }
  const job: DeliveryJob = {
    id,
    formId,
    connectionId,
    connectionName: row.payload.name,
    connectionRevision: row.version,
    event,
    state: "pending",
    attempts: 0,
    createdAt: now,
    nextAttemptAt: Date.now(),
    test: true,
    lastMessage: "Synthetic test queued.",
  };
  await writeRecord("deliveries", id, owner, job, 0);
  return id;
}
class DeliveryFailure extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public status?: number,
    public retryAfter?: string,
  ) {
    super(message);
  }
}
function checkResponse(r: HttpResult) {
  if (r.status >= 200 && r.status < 300) return;
  const retryable =
    r.status === 408 || r.status === 425 || r.status === 429 || r.status >= 500;
  throw new DeliveryFailure(
    `Destination returned HTTP ${r.status}.${r.status === 401 || r.status === 403 ? " Check credentials and permissions." : r.status >= 300 && r.status < 400 ? " Redirects are not followed; use the final HTTPS URL." : ""}`,
    retryable,
    r.status,
    r.retryAfter,
  );
}
export function retryTime(
  attempts: number,
  retryAfter?: string,
  now = Date.now(),
) {
  const seconds = Number(retryAfter);
  const server = retryAfter
    ? Number.isFinite(seconds)
      ? now + seconds * 1000
      : Date.parse(retryAfter)
    : 0;
  return Math.min(
    now + 86400000,
    Math.max(
      now + Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1)) * 1000,
      Number.isFinite(server) ? server : 0,
    ),
  );
}
export async function deliver(
  id: string,
  owner: string,
  sender: Sender = sendHttps,
) {
  if (!deliveryAllowed()) return;
  const row = await readRecord<DeliveryJob>("deliveries", id);
  if (!row || row.owner_id !== owner) return;
  const j = row.payload,
    now = Date.now();
  if (
    (j.state !== "pending" &&
      !(j.state === "sending" && (j.leaseUntil || 0) < now)) ||
    j.nextAttemptAt > now
  )
    return;
  const connection = await readRecord<IntegrationConfig>(
    "integrations",
    j.connectionId,
  );
  const form = await readRecord("forms", j.formId);
  const blocked =
    !connection ||
    connection.owner_id !== owner ||
    form?.owner_id !== owner ||
    connection.payload.formId !== j.formId ||
    (!connection.payload.enabled && !j.test) ||
    connection.version !== j.connectionRevision;
  if (blocked) {
    await writeRecord(
      "deliveries",
      id,
      owner,
      {
        ...j,
        state: "failed",
        lastMessage:
          "Connection changed, paused, or removed. Review it before retrying.",
      },
      row.version,
    );
    return;
  }
  let claimed: StoredRecord<DeliveryJob>;
  try {
    claimed = await writeRecord(
      "deliveries",
      id,
      owner,
      {
        ...j,
        state: "sending",
        attempts: j.attempts + 1,
        leaseUntil: now + 90000,
      },
      row.version,
    );
  } catch {
    return;
  } // Another worker claimed the same version.
  const c = connection.payload;
  try {
    if (!j.test && c.consentOnly && !j.event.contact.marketingConsent)
      throw new DeliveryFailure("Marketing consent is required.", false);
    const secret = unseal(c.secretBox, scope(owner, c));
    let status = 200;
    if (c.provider === "webhook") {
      const body = JSON.stringify(j.event),
        timestamp = String(Math.floor(Date.now() / 1000));
      if (Buffer.byteLength(body) > 262144)
        throw new DeliveryFailure(
          "Payload exceeds the 256 KB delivery limit.",
          false,
        );
      const response = await sender(secret.url, body, {
        "X-HeyQuiz-Event": j.event.event,
        "X-HeyQuiz-Delivery": id,
        "Idempotency-Key": id,
        "X-HeyQuiz-Timestamp": timestamp,
        ...(secret.signingSecret
          ? {
              "X-HeyQuiz-Signature": `sha256=${createHmac("sha256", secret.signingSecret).update(`${timestamp}.${body}`).digest("hex")}`,
            }
          : {}),
      });
      checkResponse(response);
      status = response.status;
    } else if (c.provider === "hubspot") {
      const response = await sendHubspot(j.event, secret, sender);
      checkResponse(response);
      let contactId: string | undefined;
      try {
        contactId = JSON.parse(response.body).id;
      } catch {
        /* validated below */
      }
      if (!contactId || !/^[0-9]+$/.test(contactId))
        throw new DeliveryFailure(
          "HubSpot did not confirm a contact ID.",
          false,
          response.status,
        );
      claimed.payload.remoteContactId = contactId;
      status = response.status;
    } else {
      const headers = {
        Authorization: `Bearer ${secret.token}`,
        Version: "2021-04-15",
        "Idempotency-Key": id,
      };
      let contactId = claimed.payload.remoteContactId;
      if (!contactId) {
        const payload = {
          locationId: c.locationId,
          email: j.event.contact.email,
          name: j.event.contact.name,
          ...(j.event.contact.phone ? { phone: j.event.contact.phone } : {}),
          source: `HeyQuiz: ${j.formId}`,
          createNewIfDuplicateAllowed: false,
          customFields: Object.entries(j.event.fields).map(([id, value]) => ({
            id,
            fieldValue:
              typeof value === "object" ? JSON.stringify(value) : String(value),
          })),
        };
        const response = await sender(
          "https://services.leadconnectorhq.com/contacts/upsert",
          JSON.stringify(payload),
          headers,
        );
        checkResponse(response);
        status = response.status;
        try {
          contactId = JSON.parse(response.body).contact?.id;
        } catch {
          /* safe error below */
        }
        if (!contactId || !/^[a-zA-Z0-9_-]{1,128}$/.test(contactId))
          throw new DeliveryFailure(
            "HighLevel did not return a valid contact ID.",
            false,
            status,
          );
        claimed = await writeRecord(
          "deliveries",
          id,
          owner,
          { ...claimed.payload, remoteContactId: contactId },
          claimed.version,
        );
      }
      const tags = [...c.tags];
      if (c.resultTag && j.event.result.outcomeId)
        tags.push(`heyquiz-${j.event.result.outcomeId}`.slice(0, 80));
      // Test leads never receive automation-triggering tags.
      if (!j.test && j.event.contact.marketingConsent && tags.length) {
        const response = await sender(
          `https://services.leadconnectorhq.com/contacts/${contactId}/tags`,
          JSON.stringify({ tags: [...new Set(tags)] }),
          headers,
        );
        checkResponse(response);
        status = response.status;
      }
    }
    await writeRecord(
      "deliveries",
      id,
      owner,
      {
        ...claimed.payload,
        state: "delivered",
        deliveredAt: new Date().toISOString(),
        leaseUntil: undefined,
        lastStatus: status,
        lastMessage: j.test
          ? "Synthetic test accepted by destination."
          : "Accepted by destination.",
      },
      claimed.version,
    );
  } catch (error) {
    const failure =
      error instanceof DeliveryFailure
        ? error
        : error instanceof HttpError
          ? new DeliveryFailure(error.message, false, error.status)
          : new DeliveryFailure(
              "Connection failed or timed out. Check the destination and saved credentials.",
              true,
            );
    const retry = failure.retryable && claimed.payload.attempts < 6;
    await writeRecord(
      "deliveries",
      id,
      owner,
      {
        ...claimed.payload,
        state: retry ? "pending" : "failed",
        leaseUntil: undefined,
        nextAttemptAt: retryTime(claimed.payload.attempts, failure.retryAfter),
        lastStatus: failure.status,
        lastMessage:
          failure.message +
          (retry ? " Retry scheduled." : " Review and retry manually."),
      },
      claimed.version,
    );
  }
}
export async function retryDelivery(formId: string, owner: string, id: string) {
  const r = await readRecord<DeliveryJob>("deliveries", id);
  if (!r || r.owner_id !== owner || r.payload.formId !== formId)
    throw new HttpError(404, "Delivery not found.");
  if (r.payload.state !== "failed" && r.payload.state !== "pending")
    throw new HttpError(
      409,
      "Only pending or failed deliveries can be retried.",
    );
  const c = await ownedConnection(r.payload.connectionId, formId, owner);
  if (!c.payload.enabled && !r.payload.test)
    throw new HttpError(422, "Enable the connection before retrying.");
  const event = { ...r.payload.event, fields: {} as Record<string, unknown> };
  for (const m of c.payload.mappings) {
    const value = sourceValue(event, m.source);
    if (value !== undefined)
      Object.defineProperty(event.fields, m.target, {
        value,
        enumerable: true,
      });
  }
  await writeRecord(
    "deliveries",
    id,
    owner,
    {
      ...r.payload,
      event,
      connectionRevision: c.version,
      remoteContactId:
        c.version === r.payload.connectionRevision
          ? r.payload.remoteContactId
          : undefined,
      state: "pending",
      attempts: 0,
      nextAttemptAt: Date.now(),
      lastMessage: "Manual retry queued using the current connection.",
    },
    r.version,
  );
}
export async function deliveryHistory(formId: string, owner: string) {
  return (await listRecords<DeliveryJob>("deliveries", owner))
    .filter((r) => r.payload.formId === formId)
    .sort((a, b) => b.payload.createdAt.localeCompare(a.payload.createdAt))
    .slice(0, 100)
    .map(({ payload: { event, ...job } }) => ({
      ...job,
      responseId: event.responseId,
    }));
}
export async function dispatch(
  owner?: string,
  formId?: string,
  sender: Sender = sendHttps,
) {
  if (!deliveryAllowed()) return { processed: 0, disabled: true };
  const configs = (
    await listRecords<IntegrationConfig>("integrations", owner)
  ).filter(
    (c) => c.payload.enabled && (!formId || c.payload.formId === formId),
  );
  // Recover a submission saved just before its post-response callback was interrupted.
  for (const ownerId of new Set(configs.map((c) => c.owner_id))) {
    const submissions = await listRecords<QuizSubmissionResult>(
      "submissions",
      ownerId,
    );
    for (const c of configs.filter((c) => c.owner_id === ownerId))
      for (const s of submissions) await enqueue(c, s.payload);
  }
  const now = Date.now();
  const due = (await listRecords<DeliveryJob>("deliveries", owner))
    .filter(
      (r) =>
        (!formId || r.payload.formId === formId) &&
        r.payload.nextAttemptAt <= now &&
        (r.payload.state === "pending" ||
          (r.payload.state === "sending" && (r.payload.leaseUntil || 0) < now)),
    )
    .sort((a, b) => a.payload.nextAttemptAt - b.payload.nextAttemptAt)
    .slice(0, 10);
  // Two bounded batches; each network operation has a ten-second deadline.
  for (let i = 0; i < due.length; i += 5)
    await Promise.allSettled(
      due.slice(i, i + 5).map((r) => deliver(r.id, r.owner_id, sender)),
    );
  return { processed: due.length, disabled: false };
}
