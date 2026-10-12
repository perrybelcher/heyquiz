import { createHash, randomUUID } from "node:crypto";
import { HttpError } from "./auth";
import { ConflictError, readRecord, writeRecord, type StoredRecord } from "./records";
import {
  CONTACT_SEGMENT_LIMIT, ContactSegmentValidationError, contactSegmentNameKey,
  parseContactSegmentCreate, parseContactSegmentPatch, parseContactSegmentDelete,
  parseContactSegmentResponse, parseStoredContactSegments,
  type ContactSegment, type ContactSegmentResponse, type StoredContactSegmentSet,
} from "./contact-segment-schema";

const kind = "contact_segments";
const unavailable = () => new HttpError(503, "Saved filters could not be read or saved. Reload them and try again.");
const conflict = () => new HttpError(409, "Saved filters changed in another tab. Reload the saved filters before trying again.");
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
/** Matches the owner/quiz key of the existing durable retirement receipt. */
export function contactSegmentRecordId(formId: string, owner: string) {
  return createHash("sha256").update(JSON.stringify([owner, formId])).digest("hex");
}
function validWrapper(row: StoredRecord<unknown>, recordKind: string, id: string, owner: string) {
  return row.kind === recordKind && row.id === id && row.owner_id === owner && Number.isSafeInteger(row.version) && row.version >= 1;
}
async function assertEligible(formId: string, owner: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(formId)) throw new HttpError(404, "Quiz not found.");
  const form = await readRecord<unknown>("forms", formId);
  if (!form || form.owner_id !== owner) throw new HttpError(404, "Quiz not found.");
  if (!validWrapper(form, "forms", formId, owner) || !object(form.payload) || form.payload.id !== formId) throw unavailable();
  const id = contactSegmentRecordId(formId, owner), receipt = await readRecord<unknown>("result_report_revocations", id);
  if (receipt) {
    // A timestamp is not a safe generation ID. Any valid retirement receipt
    // permanently excludes reused IDs; malformed evidence cannot authorize reuse.
    if (!validWrapper(receipt, "result_report_revocations", id, owner) || !object(receipt.payload) ||
      Object.keys(receipt.payload).length !== 1 || !Number.isSafeInteger(receipt.payload.retiredAt) || (receipt.payload.retiredAt as number) < 0) throw unavailable();
    throw new HttpError(410, "This quiz ID was previously deleted. Duplicate the quiz or create a new quiz to save filters.");
  }
}
async function readSet(formId: string, owner: string): Promise<ContactSegmentResponse> {
  const id = contactSegmentRecordId(formId, owner), row = await readRecord<unknown>(kind, id);
  if (!row) return { schemaVersion: 1, revision: 0, segments: [] };
  if (!validWrapper(row, kind, id, owner)) throw unavailable();
  try {
    const payload = parseStoredContactSegments(row.payload);
    if (payload.formId !== formId) throw unavailable();
    return parseContactSegmentResponse({ schemaVersion: 1, revision: row.version, segments: payload.segments });
  } catch { throw unavailable(); }
}
async function safely<T>(operation: () => Promise<T>) {
  try { return await operation(); }
  catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof ContactSegmentValidationError) throw new HttpError(400, error.message);
    if (error instanceof ConflictError) throw conflict();
    throw unavailable();
  }
}
export async function listContactSegments(formId: string, owner: string) {
  return safely(async () => {
    await assertEligible(formId, owner);
    const result = await readSet(formId, owner);
    await assertEligible(formId, owner);
    return result;
  });
}
async function commit(formId: string, owner: string, revision: number, change: (segments: ContactSegment[]) => ContactSegment[]) {
  await assertEligible(formId, owner);
  const previous = await readSet(formId, owner);
  if (previous.revision !== revision) throw conflict();
  if (revision >= Number.MAX_SAFE_INTEGER) throw unavailable();
  const segments = change(previous.segments);
  const payload: StoredContactSegmentSet = parseStoredContactSegments({ schemaVersion: 1, formId, segments });
  // Enforce the wire budget too; a committed set must remain readable by clients.
  parseContactSegmentResponse({ schemaVersion: 1, revision: revision + 1, segments });
  let row: StoredRecord<StoredContactSegmentSet>;
  try { row = await writeRecord(kind, contactSegmentRecordId(formId, owner), owner, payload, revision); }
  catch (error) {
    await assertEligible(formId, owner);
    if (error instanceof ConflictError) throw conflict();
    // A competing first cloud INSERT or an ambiguous post-commit failure can
    // arrive as an untyped adapter error. One reread reconciles it; never retry
    // a write or overwrite somebody else's committed revision automatically.
    const current = await readSet(formId, owner);
    if (current.revision !== revision) throw conflict();
    throw unavailable();
  }
  if (!validWrapper(row, kind, contactSegmentRecordId(formId, owner), owner) || row.version !== revision + 1) throw unavailable();
  let committed: StoredContactSegmentSet;
  try { committed = parseStoredContactSegments(row.payload); } catch { throw unavailable(); }
  if (committed.formId !== formId || JSON.stringify(committed) !== JSON.stringify(payload)) throw unavailable();
  await assertEligible(formId, owner);
  return parseContactSegmentResponse({ schemaVersion: 1, revision: row.version, segments: committed.segments });
}
function uniqueName(segments: ContactSegment[], name: string, except?: string) {
  if (segments.some(segment => segment.id !== except && contactSegmentNameKey(segment.name) === contactSegmentNameKey(name)))
    throw new HttpError(409, "A saved filter already uses that name. Choose another name.");
}
export async function createContactSegment(formId: string, owner: string, input: unknown) {
  return safely(async () => {
    const body = parseContactSegmentCreate(input);
    return commit(formId, owner, body.revision, segments => {
      if (segments.length >= CONTACT_SEGMENT_LIMIT) throw new HttpError(409, "This quiz already has 20 saved filters. Delete one before adding another.");
      uniqueName(segments, body.name);
      const at = new Date().toISOString();
      return [...segments, { id: randomUUID(), name: body.name, filters: body.filters, createdAt: at, updatedAt: at }];
    });
  });
}
export async function updateContactSegment(formId: string, owner: string, input: unknown) {
  return safely(async () => {
    const body = parseContactSegmentPatch(input);
    return commit(formId, owner, body.revision, segments => {
      const target = segments.find(segment => segment.id === body.id);
      if (!target) throw new HttpError(404, "Saved filter not found.");
      if (body.operation === "rename") uniqueName(segments, body.name, target.id);
      // Preserve timestamp ordering even if the host clock moves backwards.
      const at = new Date(Math.max(Date.now(), Date.parse(target.updatedAt))).toISOString();
      return segments.map(segment => segment.id !== target.id ? segment : {
        ...segment, updatedAt: at, ...(body.operation === "rename" ? { name: body.name } : { filters: body.filters }),
      });
    });
  });
}
export async function deleteContactSegment(formId: string, owner: string, input: unknown) {
  return safely(async () => {
    const body = parseContactSegmentDelete(input);
    return commit(formId, owner, body.revision, segments => {
      if (!segments.some(segment => segment.id === body.id)) throw new HttpError(404, "Saved filter not found.");
      // Keep even the final empty aggregate: removing it would reset CAS to zero.
      return segments.filter(segment => segment.id !== body.id);
    });
  });
}
