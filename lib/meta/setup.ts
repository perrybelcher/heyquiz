import { createHash } from "node:crypto";
import { HttpError } from "../errors";
import { readRecord, writeRecord } from "../records";
import type { FormSchemaType } from "../schema";
import { graph, graphList } from "./graph";
import { connectionToken, getMetaConnection } from "./connection";
import { validateMeta } from "./qualification";
import { buildMetaEvent, requestIdentity, safePageUrl } from "./payload";
export interface MetaSetup { formId: string; connectionId: string; datasetId: string; adAccountId: string; qualifiedId: string; disqualifiedId: string; testedAt?: number; preparedAt: number }
export const metaSetupId = (owner: string, formId: string) => createHash("sha256").update(JSON.stringify([owner, formId])).digest("hex");
export async function getMetaSetup(owner: string, formId: string) { const row = await readRecord<MetaSetup>("meta_setups", metaSetupId(owner, formId)); if (row && row.owner_id !== owner) throw new HttpError(404, "Meta setup not found."); return row; }
export const conversionRule = (name: string, formId: string) => ({ and: [{ event: { eq: name } }, { quiz_id: { eq: formId } }] });
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object" ? `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}` : JSON.stringify(value);
interface Conversion { id: string; name: string; rule: string; pixel?: { id: string }; data_sources?: { id: string }[]; is_archived?: boolean }
export async function prepareMeta(owner: string, form: FormSchemaType) {
  const connection = await getMetaConnection(owner), config = form.meta;
  validateMeta({ ...form, meta: config && { ...config, enabled: true } });
  if (!connection || connection.payload.status !== "connected" || !config || connection.payload.id !== config.connectionId || connection.payload.datasetId !== config.datasetId || !connection.payload.adAccountId) throw new HttpError(409, "Choose the connected Meta assets first.");
  const c = connection.payload, token = connectionToken(owner, c), existing = await getMetaSetup(owner, form.id);
  // Serialize creation across tabs. After an unknown response, enumerate exact rules before creating anything else.
  const lockId = metaSetupId(owner, form.id), lock = await readRecord<{ until: number }>("meta_setup_locks", lockId);
  if (lock && lock.owner_id !== owner) throw new HttpError(404, "Meta setup not found.");
  if (lock && lock.payload.until > Date.now()) throw new HttpError(409, "Meta setup is already running. Retry shortly.");
  const held = await writeRecord("meta_setup_locks", lockId, owner, { until: Date.now() + 120000 }, lock?.version || 0);
  try {
    const conversions = await graphList<Conversion>(`${c.adAccountId}/customconversions`, token, "id,name,rule,pixel,is_archived", 1000);
    const match = (name: string) => conversions.find(v => {
      try { return !v.is_archived && v.pixel?.id === c.datasetId && canonical(JSON.parse(v.rule)) === canonical(conversionRule(name, form.id)); } catch { return false; }
    });
    const required = ["Qualified", "Disqualified"].filter(name => !match(name));
    if (conversions.filter(v => !v.is_archived).length + required.length > 100) throw new HttpError(422, "This ad account has reached Meta’s custom conversion limit. Free space for two quiz conversions and retry.");
    const ids: string[] = [];
    for (const name of ["Qualified", "Disqualified"]) {
      const found = match(name);
      if (found) { ids.push(found.id); continue; }
      const created = await graph<{ id: string }>(`${c.adAccountId}/customconversions`, token, { name: `${name} — ${form.title}`.slice(0, 100), event_source_id: c.datasetId!, custom_event_type: name === "Qualified" ? "LEAD" : "OTHER", rule: JSON.stringify(conversionRule(name, form.id)) }, "POST");
      if (!/^\d+$/.test(created.id || "")) throw new HttpError(502, "Meta did not confirm the custom conversion. Retry to recover it.");
      ids.push(created.id);
    }
    const same = existing?.payload.connectionId === c.id && existing.payload.datasetId === c.datasetId && existing.payload.adAccountId === c.adAccountId;
    const setup: MetaSetup = { formId: form.id, connectionId: c.id, datasetId: c.datasetId!, adAccountId: c.adAccountId!, qualifiedId: ids[0], disqualifiedId: ids[1], preparedAt: Date.now(), ...(same && existing?.payload.testedAt ? { testedAt: existing.payload.testedAt } : {}) };
    await writeRecord("meta_setups", lockId, owner, setup, existing?.version || 0);
    return setup;
  } finally { await writeRecord("meta_setup_locks", lockId, owner, { until: 0 }, held.version); }
}
export async function testMeta(owner: string, form: FormSchemaType, req: Request, code: string) {
  if (!/^TEST[A-Z0-9]{3,40}$/.test(code)) throw new HttpError(400, "Enter the Test Events code from Meta Events Manager.");
  const setup = await getMetaSetup(owner, form.id), connection = await getMetaConnection(owner);
  if (!setup || !connection || setup.payload.connectionId !== connection.payload.id || connection.payload.status !== "connected") throw new HttpError(409, "Prepare the custom conversions first.");
  const url = safePageUrl(req.url)!.replace(/\/api\/forms\/[^/]+\/meta$/, `/play/${form.id}`);
  const event = buildMetaEvent({ owner, form, name: "PageView", id: `test-${crypto.randomUUID()}`, time: Date.now(), context: { url }, identity: requestIdentity(req) });
  const accepted = await graph<{ events_received?: number }>(`${setup.payload.datasetId}/events`, connectionToken(owner, connection.payload), { data: JSON.stringify([event]), test_event_code: code }, "POST");
  if (accepted.events_received !== 1) throw new HttpError(502, "Meta did not acknowledge the test event.");
  const payload = { ...setup.payload, testedAt: Date.now() };
  await writeRecord("meta_setups", setup.id, owner, payload, setup.version);
  return payload;
}
export async function assertMetaReady(owner: string, form: FormSchemaType) {
  if (!form.meta?.enabled) return;
  validateMeta(form);
  const [connection, setup] = await Promise.all([getMetaConnection(owner), getMetaSetup(owner, form.id)]);
  if (!connection || connection.payload.status !== "connected" || !setup?.payload.testedAt || setup.payload.connectionId !== form.meta.connectionId || connection.payload.id !== form.meta.connectionId || setup.payload.datasetId !== form.meta.datasetId || connection.payload.datasetId !== form.meta.datasetId) throw new HttpError(422, "Finish Meta setup and send a successful Test Events request before publishing.");
}
