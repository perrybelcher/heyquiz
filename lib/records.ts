import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
export const cloudEnabled = () =>
  Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
export const dataDirectory = () =>
  path.resolve(process.env.HEYQUIZ_DATA_DIR || ".heyquiz-data");
const safe = (v: string) => {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(v)) throw new Error("Invalid identifier.");
  return v;
};
export interface StoredRecord<T> {
  id: string;
  kind: string;
  owner_id: string;
  version: number;
  payload: T;
}
export async function supabaseFetch(endpoint: string, init: RequestInit = {}) {
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!process.env.SUPABASE_URL || !key)
    throw new Error("Cloud storage is not configured.");
  const res = await fetch(`${process.env.SUPABASE_URL}${endpoint}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key,
      ...(key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${key}` }),
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok)
    throw new Error(
      `Cloud storage request failed (${res.status}). Check the database migration and configuration.`,
    );
  return res;
}
export async function readRecord<T>(
  kind: string,
  id: string,
): Promise<StoredRecord<T> | null> {
  safe(kind);
  safe(id);
  if (cloudEnabled()) {
    const rows: StoredRecord<T>[] = await (
      await supabaseFetch(
        `/rest/v1/hq_records?kind=eq.${kind}&id=eq.${id}&select=*`,
      )
    ).json();
    return rows[0] || null;
  }
  try {
    return JSON.parse(
      await fs.readFile(path.join(dataDirectory(), kind, `${id}.json`), "utf8"),
    ) as StoredRecord<T>;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error(
      "Stored data could not be read. No data has been overwritten.",
    );
  }
}
export async function listRecords<T>(
  kind: string,
  owner?: string,
): Promise<StoredRecord<T>[]> {
  safe(kind);
  if (cloudEnabled())
    return (
      await supabaseFetch(
        `/rest/v1/hq_records?kind=eq.${kind}${owner ? `&owner_id=eq.${encodeURIComponent(owner)}` : ""}&select=*`,
      )
    ).json();
  let names: string[];
  try {
    names = await fs.readdir(path.join(dataDirectory(), kind));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const rows = await Promise.all(
    names
      .filter((n) => n.endsWith(".json"))
      .map((n) => readRecord<T>(kind, n.slice(0, -5))),
  );
  return rows.filter(
    (r): r is StoredRecord<T> => r !== null && (!owner || r.owner_id === owner),
  );
}
export class ConflictError extends Error {
  constructor() {
    super(
      "This quiz changed in another tab. Reload before saving to avoid overwriting those changes.",
    );
  }
}
export async function writeRecord<T>(
  kind: string,
  id: string,
  owner: string,
  payload: T,
  expected?: number,
): Promise<StoredRecord<T>> {
  safe(kind);
  safe(id);
  if (cloudEnabled()) {
    const old = await readRecord<T>(kind, id);
    if (old && old.owner_id !== owner)
      throw new Error("Record owner mismatch.");
    if (expected !== undefined && (old?.version || 0) !== expected)
      throw new ConflictError();
    const row = {
      kind,
      id,
      owner_id: owner,
      payload,
      version: (old?.version || 0) + 1,
    };
    const res = await supabaseFetch(
      `/rest/v1/hq_records${old ? `?kind=eq.${kind}&id=eq.${id}&version=eq.${old.version}` : ""}`,
      {
        method: old ? "PATCH" : "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(row),
      },
    );
    const result: StoredRecord<T>[] = await res.json();
    if (!result.length) throw new ConflictError();
    return result[0];
  }
  const dir = path.join(dataDirectory(), kind);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const lock = path.join(dir, `${id}.lock`);
  let acquired = false;
  for (let n = 0; n < 50; n++) {
    try {
      await fs.mkdir(lock);
      acquired = true;
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      await new Promise((r) => setTimeout(r, 40));
    }
  }
  if (!acquired) throw new Error("This record is busy. Please try again.");
  try {
    const old = await readRecord<T>(kind, id);
    if (old && old.owner_id !== owner)
      throw new Error("Record owner mismatch.");
    if (expected !== undefined && (old?.version || 0) !== expected)
      throw new ConflictError();
    const row = {
      kind,
      id,
      owner_id: owner,
      payload,
      version: (old?.version || 0) + 1,
    };
    const tmp = path.join(dir, `${id}.${randomUUID()}.tmp`);
    const file = await fs.open(tmp, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(row));
      await file.sync();
    } finally {
      await file.close();
    }
    await fs.rename(tmp, path.join(dir, `${id}.json`));
    return row;
  } finally {
    await fs.rmdir(lock);
  }
}
export async function removeRecord(kind: string, id: string, owner: string) {
  const r = await readRecord(kind, id);
  if (!r || r.owner_id !== owner) return false;
  if (cloudEnabled())
    await supabaseFetch(
      `/rest/v1/hq_records?kind=eq.${safe(kind)}&id=eq.${safe(id)}&owner_id=eq.${encodeURIComponent(owner)}`,
      { method: "DELETE" },
    );
  else await fs.unlink(path.join(dataDirectory(), kind, `${safe(id)}.json`));
  return true;
}
