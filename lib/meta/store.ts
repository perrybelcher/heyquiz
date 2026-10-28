import fs from "node:fs/promises";
import path from "node:path";
import { cloudEnabled, dataDirectory, readRecord, supabaseFetch, type StoredRecord } from "../records";
/** Production polling is bounded by a database due-time predicate and limit. */
export async function dueMetaRecords<T extends { nextAt: number }>(kind: "meta_jobs" | "meta_sources" | "meta_contexts", limit = 40, owner?: string): Promise<StoredRecord<T>[]> {
  if (cloudEnabled()) {
    const response = await supabaseFetch(`/rest/v1/hq_records?kind=eq.${kind}${owner ? `&owner_id=eq.${encodeURIComponent(owner)}` : ""}&payload->>nextAt=lte.${Date.now()}&order=payload->>nextAt.asc,id.asc&limit=${limit}&select=*`);
    return response.json();
  }
  let names: string[]; try { names = await fs.readdir(path.join(dataDirectory(), kind)); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const due: StoredRecord<T>[] = [];
  // Filenames sort by last eligible time only in cloud; local scans are for development datasets.
  for (const name of names.filter(n => n.endsWith(".json"))) {
    const row = await readRecord<T>(kind, name.slice(0, -5));
    if (row && (!owner || row.owner_id === owner) && row.payload.nextAt <= Date.now()) due.push(row);
    if (due.length >= limit) break;
  }
  return due;
}
