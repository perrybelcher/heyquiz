import { HttpError } from "../errors";
import { signToken, verifyToken } from "../auth";
import { readRecord, writeRecord, removeRecord, type StoredRecord } from "../records";
import { seal, unseal } from "../integrations/secrets";
import type { Attempt } from "../attempts";
import type { FormSchemaType, QuizSubmissionResult } from "../schema";
import { submissionDeleted } from "../submission-lifecycle";
import { browserContext, buildMetaEvent, hashMeta, requestIdentity } from "./payload";
import { getMetaConnection, connectionToken, tenantMetaId } from "./connection";
import { graph, MetaApiError, metaDeliveryAllowed } from "./graph";
import { qualify } from "./qualification";
import { getMetaSetup } from "./setup";
import { dueMetaRecords } from "./store";
import type { MetaBrowserContext, MetaDecision, MetaEvent } from "./schema";
const doneAt = 9999999999999;
const expiry = 7 * 86400000;
interface ConsentContext { formId: string; connectionId: string; datasetId: string; allowed: boolean; consentVersion: 1; createdAt: number; nextAt: number; secret: string }
interface Source { formId: string; attemptId: string; contextId?: string; expiresAt: number; nextAt: number; identityBox?: string }
export interface MetaJob { formId: string; connectionId: string; datasetId: string; contextId: string; submissionId?: string; sourceHash?: string; eventName: MetaEvent["event_name"]; eventId: string; eventTime: number; secret: string; nextAt: number; attempts: number; status: "pending" | "sending" | "accepted" | "retry" | "failed" | "expired" | "cancelled"; code?: number; acceptedAt?: number }
const scopedId = (owner: string, key: string) => hashMeta(`${owner}:${key}`);
async function owned<T>(kind: string, id: string, owner: string) { const row = await readRecord<T>(kind, id); if (row && row.owner_id !== owner) throw new HttpError(404, "Meta tracking context not found."); return row; }
async function createOnce<T>(kind: string, id: string, owner: string, payload: T) {
  const old = await owned<T>(kind, id, owner); if (old) return old;
  try { return await writeRecord(kind, id, owner, payload, 0); } catch (error) { const concurrent = await owned<T>(kind, id, owner); if (concurrent) return concurrent; throw error; }
}
async function queue(owner: string, event: MetaEvent, context: StoredRecord<ConsentContext>, result?: QuizSubmissionResult) {
  const id = scopedId(owner, event.event_id);
  return createOnce<MetaJob>("meta_jobs", id, owner, { formId: context.payload.formId, connectionId: context.payload.connectionId, datasetId: context.payload.datasetId, contextId: context.id, submissionId: result?.id, sourceHash: result ? hashMeta(JSON.stringify(result)) : undefined, eventName: event.event_name, eventId: event.event_id, eventTime: event.event_time, secret: seal({ event: JSON.stringify(event) }, `meta-job:${owner}:${id}`), nextAt: Date.now(), attempts: 0, status: "pending" });
}
export async function usableMeta(owner: string, form: FormSchemaType) {
  if (!metaDeliveryAllowed() || !form.meta?.enabled) return false;
  const [connection, setup, published] = await Promise.all([getMetaConnection(owner), getMetaSetup(owner, form.id), owned<FormSchemaType>("published", form.id, owner)]);
  return Boolean(published?.payload.meta?.enabled && connection?.payload.status === "connected" && setup?.payload.testedAt && connection.payload.id === form.meta.connectionId && setup.payload.connectionId === form.meta.connectionId && connection.payload.datasetId === form.meta.datasetId && setup.payload.datasetId === form.meta.datasetId);
}
export async function createMetaVisit(owner: string, form: FormSchemaType, req: Request, key: string, rawContext: unknown) {
  if (!await usableMeta(owner, form)) throw new HttpError(409, "Meta tracking is not enabled for this published quiz.");
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new HttpError(400, "A valid tracking visit key is required.");
  const context = browserContext(rawContext), identity = requestIdentity(req);
  if (!context || !identity.client_user_agent) throw new HttpError(400, "Website tracking requires the actual page URL and browser user agent.");
  const id = scopedId(owner, `${form.id}:${form.meta!.connectionId}:${key}`), existing = await owned<ConsentContext>("meta_contexts", id, owner);
  if (existing && (!existing.payload.allowed || existing.payload.createdAt + 86400000 <= Date.now())) throw new HttpError(409, "Start a new tracking visit after changing consent.");
  const row = await createOnce<ConsentContext>("meta_contexts", id, owner, { formId: form.id, connectionId: form.meta!.connectionId, datasetId: form.meta!.datasetId, allowed: true, consentVersion: 1, createdAt: Date.now(), nextAt: Date.now() + 8 * 86400000, secret: seal({ context: JSON.stringify(context), identity: JSON.stringify(identity) }, `meta-context:${owner}:${id}`) });
  const saved = unseal(row.payload.secret, `meta-context:${owner}:${id}`);
  const event = buildMetaEvent({ owner, form, name: "PageView", id: `pv-${id}`, time: row.payload.createdAt, context: JSON.parse(saved.context), identity: JSON.parse(saved.identity) });
  await queue(owner, event, row);
  const token = signToken({ purpose: "meta-consent", id, owner, formId: form.id, exp: row.payload.createdAt + 8 * 86400000 });
  return { token, event: { name: event.event_name, id: event.event_id, data: event.custom_data }, datasetId: row.payload.datasetId };
}
export async function getMetaContext(token: unknown, owner: string, formId: string, revoking = false) {
  if (typeof token !== "string" || token.length > 2048) throw new HttpError(400, "Invalid Meta tracking token.");
  const claims = verifyToken(token);
  if (claims?.purpose !== "meta-consent" || claims.owner !== owner || claims.formId !== formId || typeof claims.id !== "string") throw new HttpError(403, "Meta tracking token does not belong to this quiz.");
  const row = await owned<ConsentContext>("meta_contexts", claims.id, owner);
  if (!row || row.payload.formId !== formId) throw new HttpError(404, "Meta tracking context not found.");
  if (!revoking && row.payload.createdAt + 86400000 <= Date.now()) throw new HttpError(409, "This tracking visit expired. Start a new consented visit.");
  return row;
}
export async function revokeMeta(token: unknown, owner: string, formId: string) {
  const row = await getMetaContext(token, owner, formId, true);
  if (row.payload.allowed) await writeRecord("meta_contexts", row.id, owner, { ...row.payload, allowed: false, secret: "" }, row.version);
}
export async function registerMetaAttempt(attempt: StoredRecord<Attempt>, token?: unknown, req?: Request, rawContext?: unknown) {
  if (attempt.payload.preview || !attempt.payload.form.meta?.enabled) return;
  const { form } = attempt.payload, owner = attempt.owner_id;
  let contextId: string | undefined;
  if (token) {
    const context = await getMetaContext(token, owner, form.id);
    if (context.payload.allowed && context.payload.connectionId === form.meta!.connectionId && context.payload.datasetId === form.meta!.datasetId) {
      contextId = context.id;
      const fresh = browserContext(rawContext);
      if (fresh) {
        const box = unseal(context.payload.secret, `meta-context:${owner}:${context.id}`), original: MetaBrowserContext = JSON.parse(box.context);
        const updated = { ...original, ...fresh, url: original.url };
        await writeRecord("meta_contexts", context.id, owner, { ...context.payload, secret: seal({ ...box, context: JSON.stringify(updated) }, `meta-context:${owner}:${context.id}`) }, context.version);
      }
    }
  }
  const id = scopedId(owner, `source:${attempt.id}`), old = await owned<Source>("meta_sources", id, owner);
  const identityBox = req ? seal({ identity: JSON.stringify(requestIdentity(req)) }, `meta-source:${owner}:${id}`) : old?.payload.identityBox;
  if (old) {
    if (contextId || identityBox) await writeRecord("meta_sources", id, owner, { ...old.payload, ...(contextId ? { contextId } : {}), identityBox, nextAt: Date.now() }, old.version);
  } else await createOnce<Source>("meta_sources", id, owner, { formId: form.id, attemptId: attempt.id, contextId, identityBox, expiresAt: attempt.payload.expiresAt, nextAt: Date.now() });
}
export function metaDecision(form: FormSchemaType, result: QuizSubmissionResult): MetaDecision | undefined {
  return form.meta?.enabled && result.contact ? qualify(form.meta, result) : undefined;
}
export async function captureMetaSource(source: StoredRecord<Source>) {
  const { payload: input, owner_id: owner } = source;
  const [attempt, submission] = await Promise.all([owned<Attempt>("attempts", input.attemptId, owner), owned<QuizSubmissionResult>("submissions", input.attemptId, owner)]);
  if (!attempt || attempt.payload.preview || input.expiresAt <= Date.now() || await submissionDeleted(input.formId, owner, input.attemptId)) return { finished: true };
  const form = attempt.payload.form;
  if (!form.meta?.enabled || !submission?.payload.contact) return { finished: false };
  const result = submission.payload;
  const decision = await createOnce<MetaDecision>("meta_decisions", scopedId(owner, `decision:${input.attemptId}`), owner, result.metaDecision || qualify(form.meta, result));
  if (decision.payload.status === "unclassified") return { finished: true, decision: decision.payload };
  if (!input.contextId) return { finished: true, decision: decision.payload };
  const context = await owned<ConsentContext>("meta_contexts", input.contextId, owner);
  if (!context?.payload.allowed || context.payload.connectionId !== form.meta.connectionId || !await usableMeta(owner, form)) return { finished: true, decision: decision.payload };
  const stored = unseal(context.payload.secret, `meta-context:${owner}:${context.id}`), browser: MetaBrowserContext = JSON.parse(stored.context);
  const identity = JSON.parse(input.identityBox ? unseal(input.identityBox, `meta-source:${owner}:${source.id}`).identity : stored.identity);
  const event = buildMetaEvent({ owner, form, name: decision.payload.status === "qualified" ? "Qualified" : "Disqualified", id: `outcome-${scopedId(owner, input.attemptId)}`, time: decision.payload.decidedAt, context: browser, identity, result, ruleVersion: decision.payload.ruleVersion });
  await queue(owner, event, context, result);
  return { finished: true, decision: decision.payload, event: { name: event.event_name, id: event.event_id, data: event.custom_data }, datasetId: context.payload.datasetId };
}
export async function captureMetaAttempt(owner: string, attemptId: string) {
  const source = await owned<Source>("meta_sources", scopedId(owner, `source:${attemptId}`), owner);
  if (!source) return;
  const result = await captureMetaSource(source);
  return result;
}
export async function dispatchMeta(owner?: string) {
  if (!metaDeliveryAllowed()) return { processed: 0 };
  const deadline = Date.now() + 40000;
  for (const context of await dueMetaRecords<ConsentContext>("meta_contexts", 30, owner)) await removeRecord("meta_contexts", context.id, context.owner_id);
  for (const source of await dueMetaRecords<Source>("meta_sources", 20, owner)) {
    if (Date.now() >= deadline) break;
    try { const result = await captureMetaSource(source); await writeRecord("meta_sources", source.id, source.owner_id, { ...source.payload, ...(result.finished ? { identityBox: undefined } : {}), nextAt: result.finished ? doneAt : Date.now() + 60000 }, source.version); } catch { /* Another visitor request or storage outage: retry durable source. */ }
  }
  let processed = 0;
  for (const row of await dueMetaRecords<MetaJob>("meta_jobs", 30, owner)) {
    if (Date.now() >= deadline) break;
    const job = row.payload;
    if (!["pending", "retry", "sending"].includes(job.status)) continue;
    let held: StoredRecord<MetaJob>;
    try { held = await writeRecord("meta_jobs", row.id, row.owner_id, { ...job, status: "sending", nextAt: Date.now() + 120000, attempts: job.attempts + 1 }, row.version); } catch { continue; }
    const save = (patch: Partial<MetaJob>) => writeRecord("meta_jobs", row.id, row.owner_id, { ...held.payload, ...patch }, held.version);
    let credentialBox: string | undefined;
    try {
      if (job.eventTime * 1000 < Date.now() - expiry) { await save({ status: "expired", nextAt: doneAt, secret: "" }); continue; }
      const [connection, consent, published, submission] = await Promise.all([getMetaConnection(row.owner_id), owned<ConsentContext>("meta_contexts", job.contextId, row.owner_id), owned<FormSchemaType>("published", job.formId, row.owner_id), job.submissionId ? owned<QuizSubmissionResult>("submissions", job.submissionId, row.owner_id) : null]);
      if (!consent?.payload.allowed || !published?.payload.meta?.enabled || !connection || connection.payload.status === "disconnected" || connection.payload.id !== job.connectionId || connection.payload.datasetId !== job.datasetId || job.submissionId && (!submission?.payload.contact || hashMeta(JSON.stringify(submission.payload)) !== job.sourceHash || await submissionDeleted(job.formId, row.owner_id, job.submissionId))) { await save({ status: "cancelled", nextAt: doneAt, secret: "" }); continue; }
      if (job.attempts >= 20) { await save({ status: "failed", nextAt: doneAt, secret: "" }); continue; }
      credentialBox = connection.payload.secret;
      const event = JSON.parse(unseal(job.secret, `meta-job:${row.owner_id}:${row.id}`).event);
      const response = await graph<{ events_received?: number }>(`${job.datasetId}/events`, connectionToken(row.owner_id, connection.payload), { data: JSON.stringify([event]) }, "POST");
      if (response.events_received !== 1) throw new MetaApiError(0, true);
      await save({ status: "accepted", acceptedAt: Date.now(), nextAt: doneAt, secret: "" }); processed++;
    } catch (error) {
      const code = error instanceof MetaApiError ? error.code : 0;
      const retry = !(error instanceof MetaApiError) || error.retryable || [190, 10, 200].includes(code);
      if ([190, 10, 200].includes(code)) {
        const connection = await getMetaConnection(row.owner_id);
        if (connection?.payload.id === job.connectionId && connection.payload.secret === credentialBox) await writeRecord("meta_connections", tenantMetaId(row.owner_id), row.owner_id, { ...connection.payload, status: code === 190 ? "reconnect_required" : "permission_issue" }, connection.version);
      }
      await save({ status: retry ? "retry" : "failed", code, nextAt: retry ? Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7)) : doneAt, ...(!retry ? { secret: "" } : {}) });
    }
  }
  return { processed };
}
export async function metaHistory(owner: string, formId: string) {
  // Bounded history uses a database predicate rather than returning other tenants' payloads.
  const { cloudEnabled, supabaseFetch, listRecords } = await import("../records");
  let rows: StoredRecord<MetaJob>[];
  if (cloudEnabled()) rows = await (await supabaseFetch(`/rest/v1/hq_records?kind=eq.meta_jobs&owner_id=eq.${encodeURIComponent(owner)}&payload->>formId=eq.${encodeURIComponent(formId)}&order=payload->>eventTime.desc,id.desc&limit=20&select=*`)).json();
  else rows = (await listRecords<MetaJob>("meta_jobs", owner)).filter(r => r.payload.formId === formId).sort((a, b) => b.payload.eventTime - a.payload.eventTime).slice(0, 20);
  return rows.map(({ id, payload: p }) => ({ id, eventName: p.eventName, status: p.status, attempts: p.attempts, code: p.code, eventTime: p.eventTime }));
}
