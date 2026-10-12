import { FormSchema, type FormSchemaType, type Question } from "./schema";

export interface DraftCheckpoint {
  id: string;
  createdAt: string;
  reason: string;
  form: FormSchemaType;
}

type DraftStorage = Pick<Storage, "getItem" | "setItem">;
const historyKey = (formId: string) => `pippi-draft-history:${formId}`;
const historyLimit = 5;

/** Checkpoints contain quiz definitions only, never respondent answers. */
export function readDraftHistory(storage: DraftStorage, formId: string): DraftCheckpoint[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(historyKey(formId)) || "[]");
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || typeof entry.createdAt !== "string" || typeof entry.reason !== "string") return [];
      const parsed = FormSchema.safeParse(entry.form);
      return parsed.success && parsed.data.id === formId
        ? [{ id: entry.id, createdAt: entry.createdAt, reason: entry.reason, form: parsed.data }]
        : [];
    }).slice(0, historyLimit);
  } catch { return []; }
}

/** A destructive action may proceed only after the browser confirms its checkpoint. */
export function createDraftCheckpoint(storage: DraftStorage, form: FormSchemaType, reason: string, id: string, now = new Date()): DraftCheckpoint[] {
  const snapshot = FormSchema.parse(JSON.parse(JSON.stringify(form)));
  const checkpoint: DraftCheckpoint = { id, reason, createdAt: now.toISOString(), form: snapshot };
  const history = [checkpoint, ...readDraftHistory(storage, form.id)].slice(0, historyLimit);
  const serialized = JSON.stringify(history);
  storage.setItem(historyKey(form.id), serialized);
  if (storage.getItem(historyKey(form.id)) !== serialized) throw new Error("Your browser could not confirm the safety checkpoint.");
  return history;
}

/** AI suggests additional questions. It cannot replace a creator's campaign settings. */
export function appendProposedQuestions(current: FormSchemaType, proposed: Question[], makeId: () => string): FormSchemaType {
  if (!proposed.length) throw new Error("Choose at least one question to add.");
  if (current.questions.length + proposed.length > 200) throw new Error("A quiz can contain up to 200 questions. Choose fewer suggestions.");
  const usedIds = new Set([...current.questions.map(q => q.id), ...(current.pages || []).map(p => p.id)]);
  const uniqueId = () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const id = makeId();
      if (!usedIds.has(id)) { usedIds.add(id); return id; }
    }
    throw new Error("Could not create unique question IDs. Please try again.");
  };
  // A dedicated page keeps existing page membership and branching untouched.
  const pageId = current.pages?.length ? uniqueId() : undefined;
  const questions = proposed.map(q => ({ ...q, id: uniqueId(), pageId, options: q.options?.map(option => ({ ...option })) }));
  const next: FormSchemaType = {
    ...current,
    questions: [...current.questions, ...questions],
    ...(pageId ? { pages: [...current.pages!, { id: pageId, title: "New questions", questionIds: questions.map(q => q.id) }] } : {}),
  };
  // Validate additions without normalizing unrelated settings or dropping newly added schema fields.
  FormSchema.parse(next);
  return next;
}

/** Server revision belongs to the current editor session, not the historical snapshot. */
export function restoreDraftCheckpoint(current: FormSchemaType, checkpoint: DraftCheckpoint): FormSchemaType {
  if (checkpoint.form.id !== current.id) throw new Error("This checkpoint belongs to another quiz.");
  return { ...FormSchema.parse(JSON.parse(JSON.stringify(checkpoint.form))), id: current.id, revision: current.revision, createdAt: current.createdAt, publishedAt: current.publishedAt };
}
