import { createHash, randomUUID } from "node:crypto";
import { HttpError } from "../errors";
import { readRecord, writeRecord } from "../records";
import { seal, unseal } from "../integrations/secrets";
import { graph, graphList, metaEnvironment, metaDeliveryAllowed } from "./graph";
export interface MetaConnection { id: string; secret: string; businessId: string; businessName: string; adAccountId?: string; datasetId?: string; updatedAt: number; status: "connected" | "reconnect_required" | "permission_issue" | "disconnected" }
export const tenantMetaId = (owner: string) => createHash("sha256").update(`meta:${owner}`).digest("hex");
export async function getMetaConnection(owner: string) { const row = await readRecord<MetaConnection>("meta_connections", tenantMetaId(owner)); if (row && row.owner_id !== owner) throw new HttpError(404, "Meta connection not found."); return row; }
export const connectionToken = (owner: string, connection: MetaConnection) => unseal(connection.secret, `meta:${owner}:${connection.id}`).token;
export function connectionView(connection?: MetaConnection) { return connection ? { id: connection.id, businessId: connection.businessId, businessName: connection.businessName, adAccountId: connection.adAccountId, datasetId: connection.datasetId, status: connection.status } : null; }
export async function beginMetaConnect(owner: string, formId: string) {
  if (!metaDeliveryAllowed()) throw new HttpError(409, "Meta connection is available on production or locally after app setup.");
  const env = metaEnvironment(), state = randomUUID();
  await writeRecord("meta_oauth", state, owner, { expiresAt: Date.now() + 10 * 60000, formId, used: false }, 0);
  const params = new URLSearchParams({ client_id: env.appId, redirect_uri: env.redirect, config_id: env.configId, response_type: "code", override_default_response_type: "true", state });
  return `https://www.facebook.com/${env.version}/dialog/oauth?${params}`;
}
export async function finishMetaConnect(owner: string, state: string, code: string) {
  if (!/^[a-f0-9-]{36}$/.test(state) || !code || code.length > 4096) throw new HttpError(400, "Invalid Meta login response.");
  const row = await readRecord<{ expiresAt: number; formId: string; used: boolean }>("meta_oauth", state);
  if (!row || row.owner_id !== owner || row.payload.used || row.payload.expiresAt < Date.now()) throw new HttpError(400, "Meta login expired. Start Connect Meta again.");
  await writeRecord("meta_oauth", state, owner, { ...row.payload, used: true }, row.version);
  const env = metaEnvironment();
  const exchange = await graph<{ access_token: string }>("oauth/access_token", `${env.appId}|${env.secret}`, { client_id: env.appId, client_secret: env.secret, redirect_uri: env.redirect, code }, "POST", false);
  if (!exchange.access_token) throw new HttpError(400, "Meta did not return an access token.");
  const debug = await graph<{ data: { app_id: string; is_valid: boolean } }>("debug_token", `${env.appId}|${env.secret}`, { input_token: exchange.access_token }, "GET", false);
  if (!debug.data?.is_valid || debug.data.app_id !== env.appId) throw new HttpError(400, "Meta returned a token for another app.");
  const identity = await graph<{ client_business_id?: string }>("me", exchange.access_token, { fields: "client_business_id" });
  if (!identity.client_business_id || !/^\d+$/.test(identity.client_business_id)) throw new HttpError(422, "Use the Meta Conversions API business login configuration and select a business.");
  const business = await graph<{ id: string; name: string }>(identity.client_business_id, exchange.access_token, { fields: "id,name" });
  // Reauthorizing the same business retains the destination and generation, so valid queued events survive reconnect.
  const old = await getMetaConnection(owner), same = old?.payload.businessId === business.id && old.payload.status !== "disconnected";
  const id = same ? old!.payload.id : randomUUID();
  const connection: MetaConnection = { id, secret: seal({ token: exchange.access_token }, `meta:${owner}:${id}`), businessId: business.id, businessName: business.name, updatedAt: Date.now(), status: "connected", ...(same ? { adAccountId: old!.payload.adAccountId, datasetId: old!.payload.datasetId } : {}) };
  await writeRecord("meta_connections", tenantMetaId(owner), owner, connection, old?.version || 0);
  return row.payload.formId;
}
export interface MetaAsset { id: string; name: string }
export async function metaAssets(owner: string) {
  const row = await getMetaConnection(owner);
  if (!row || row.payload.status === "disconnected") throw new HttpError(409, "Connect Meta first.");
  const token = connectionToken(owner, row.payload), business = row.payload.businessId;
  const sets = await Promise.all([graphList<MetaAsset>(`${business}/owned_ad_accounts`, token, "id,name"), graphList<MetaAsset>(`${business}/client_ad_accounts`, token, "id,name"), graphList<MetaAsset>(`${business}/owned_pixels`, token, "id,name"), graphList<MetaAsset>(`${business}/client_pixels`, token, "id,name")]);
  const unique = (assets: MetaAsset[]) => [...new Map(assets.map(a => [a.id, a])).values()];
  return { adAccounts: unique([...sets[0], ...sets[1]]), datasets: unique([...sets[2], ...sets[3]]) };
}
export async function selectMetaAssets(owner: string, accountId: string, datasetId: string) {
  if (!/^act_\d+$/.test(accountId) || !/^\d{5,30}$/.test(datasetId)) throw new HttpError(400, "Choose valid Meta assets.");
  const row = await getMetaConnection(owner); if (!row) throw new HttpError(409, "Connect Meta first.");
  const assets = await metaAssets(owner), token = connectionToken(owner, row.payload);
  if (!assets.adAccounts.some(a => a.id === accountId) || !assets.datasets.some(a => a.id === datasetId)) throw new HttpError(403, "Choose assets assigned to this Meta business.");
  const assigned = await graphList<MetaAsset>(`${accountId}/adspixels`, token, "id,name");
  if (!assigned.some(a => a.id === datasetId)) throw new HttpError(422, "Assign this dataset to the selected ad account in Meta, then retry.");
  const changed = row.payload.adAccountId && (row.payload.adAccountId !== accountId || row.payload.datasetId !== datasetId);
  const id = changed ? randomUUID() : row.payload.id;
  const connection = { ...row.payload, id, secret: seal({ token }, `meta:${owner}:${id}`), adAccountId: accountId, datasetId, status: "connected" as const, updatedAt: Date.now() };
  await writeRecord("meta_connections", row.id, owner, connection, row.version);
  return connectionView(connection);
}
export async function disconnectMeta(owner: string) { const row = await getMetaConnection(owner); if (row) await writeRecord("meta_connections", row.id, owner, { ...row.payload, secret: "", status: "disconnected" }, row.version); }
