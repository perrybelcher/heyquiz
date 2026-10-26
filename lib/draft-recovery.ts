import { FormSchema, type FormSchemaType } from "./schema";
import { orderedQuestions } from "./engine";
/** In-progress controls may temporarily violate bounds (for example an empty
 * numeric input represented as zero). Keep that typed draft recoverable; only
 * server acknowledgments use the strict save schema. */
export function readDraftForm(value: unknown): FormSchemaType | null {
  const parsed = FormSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as FormSchemaType;
  if (typeof raw.id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(raw.id) || typeof raw.title !== "string" || !Array.isArray(raw.questions) || !Array.isArray(raw.outcomeTiers) || !raw.theme || typeof raw.theme !== "object" || !raw.settings || typeof raw.settings !== "object") return null;
  if (raw.questions.some(question => typeof question?.id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(question.id))) return null;
  // Constraint errors preserve raw text/numbers; wrong types/unknown enum values
  // cannot become executable editor state. JSON size bounds only stored input.
  if (parsed.error.issues.some(issue => !["too_small", "too_big", "invalid_format", "custom"].includes(issue.code))) return null;
  try { if (JSON.stringify(raw).length > 8 * 1024 * 1024) return null; } catch { return null; }
  return raw;
}
export function draftFingerprint(input: FormSchemaType): string {
  // Never let unfinished user input crash the editor before its backup is made.
  const parsed = FormSchema.safeParse(input), form = parsed.success ? parsed.data : input;
  let questions = form.questions;
  try { questions = orderedQuestions(form); } catch { /* Retain the raw unfinished ordering. */ }
  const normalized = { ...form, questions, pages: form.pages?.map(page => ({ ...page, questionIds: questions.filter(question => (question.pageId || form.pages?.[0]?.id) === page.id).map(question => question.id) })), revision: undefined, updatedAt: undefined, createdAt: undefined, publishedAt: undefined };
  return JSON.stringify(normalized, (_key, value) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
}
export interface RecoveryDraft { version: 2; accountKey: string; formId: string; instance: string; baseRevision: number; updatedAt: number; form: FormSchemaType }
export type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
export const recoveryPrefix = (accountKey: string, formId: string) => `pippi-draft:v2:${encodeURIComponent(accountKey)}:${encodeURIComponent(formId)}:`;
export const recoveryKey = (draft: Pick<RecoveryDraft, "accountKey" | "formId" | "instance">) => recoveryPrefix(draft.accountKey, draft.formId) + draft.instance;
export function readRecovery(raw: string | null, accountKey: string, formId: string): RecoveryDraft | null {
  try {
    const value = JSON.parse(raw || "null");
    if (value?.version !== 2 || value.accountKey !== accountKey || value.formId !== formId || typeof value.instance !== "string" || !Number.isSafeInteger(value.baseRevision) || value.baseRevision < 0 || !Number.isFinite(value.updatedAt)) return null;
    const form = readDraftForm(value.form);
    return form?.id === formId ? { ...value, form } : null;
  } catch { return null; }
}
export function writeRecovery(storage: RecoveryStorage, draft: RecoveryDraft): boolean {
  try {
    if (!readDraftForm(draft.form)) return false;
    const key = recoveryKey(draft), raw = JSON.stringify(draft);
    // Validate serialized content before replacing the last recoverable copy.
    const decoded = readRecovery(raw, draft.accountKey, draft.formId);
    if (!decoded || draftFingerprint(decoded.form) !== draftFingerprint(draft.form)) return false;
    storage.setItem(key, raw); return storage.getItem(key) === raw;
  } catch { return false; }
}
export function listRecovery(storage: RecoveryStorage, accountKey: string, formId: string): RecoveryDraft[] {
  const result: RecoveryDraft[] = [];
  try { for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key?.startsWith(recoveryPrefix(accountKey, formId))) { const draft = readRecovery(storage.getItem(key), accountKey, formId); if (draft) result.push(draft); } } } catch { /* Remaining copies stay untouched. */ }
  return result;
}
export function recoveryCandidates(copies: RecoveryDraft[], server: FormSchemaType): RecoveryDraft[] {
  const unique = new Map<string, RecoveryDraft>(), serverFingerprint = draftFingerprint(server);
  for (const copy of copies) { const fingerprint = draftFingerprint(copy.form); if (fingerprint === serverFingerprint) continue; const key = `${copy.baseRevision}:${fingerprint}`; if (!unique.has(key)) unique.set(key, copy); }
  return [...unique.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}
export function clearAcknowledged(storage: RecoveryStorage, accountKey: string, snapshot: FormSchemaType) {
  for (const draft of listRecovery(storage, accountKey, snapshot.id)) if (draftFingerprint(draft.form) === draftFingerprint(snapshot)) {
    try { storage.removeItem(recoveryKey(draft)); } catch { /* Keeping a redundant copy is safer than losing a newer one. */ }
  }
}

/** Once applied panel text is included in an acknowledged quiz save, matching
 * redundant panel copies may be removed. Different/invalid input stays intact. */
export function clearAppliedPanels(storage: RecoveryStorage, accountKey: string, snapshot: FormSchemaType) {
  const canonical = (value: unknown) => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
  for (const [kind, field, applied] of [["pippi-report-design", "design", snapshot.reportDesign], ["pippi-result-email-copy", "copy", snapshot.resultEmailCopy]] as const) {
    if (!applied) continue;
    const legacyKey = `${kind}:${snapshot.id}`, prefix = `pippi-panel:v2:${encodeURIComponent(accountKey)}:${legacyKey}:`;
    try {
      const keys: string[] = [legacyKey];
      for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key?.startsWith(prefix)) keys.push(key); }
      for (const key of keys) { try { const value = JSON.parse(storage.getItem(key) || "null"); if (value?.quizId === snapshot.id && canonical(value?.draft?.[field]) === canonical(applied)) storage.removeItem(key); } catch {} }
    } catch {}
  }
}

export function saveStatusLabel({ status, guest, authRequired, persistent, tab }: { status: "saved" | "saving" | "unsaved" | "error"; guest: boolean; authRequired: boolean; persistent: boolean; tab: boolean }): string {
  if (authRequired) return persistent ? "Saved on this device · Sign in to sync" : tab ? "Saved only in this tab · Sign in to sync" : "Sign in to save";
  if (guest) return persistent ? "Saved on this device · Not synced" : tab ? "Saved only in this tab · Not synced" : "Browser draft · Not synced";
  if (status === "saved") return "Saved to your account";
  if (status === "saving") return "Saving…";
  return persistent ? "Saved on this device. Waiting to sync." : tab ? "Saved only in this tab" : "Unsynced changes";
}
