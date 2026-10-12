import { FormSchema, type FormSchemaType } from "./schema";
/** Stable comparison excludes storage metadata and object-key ordering. */
export function publicationFingerprint(form: FormSchemaType): string {
  const normalize = (value: unknown): unknown => Array.isArray(value) ? value.map(normalize) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([key,v]) => v !== undefined && !["revision","updatedAt","createdAt","publishedAt"].includes(key)).sort(([a],[b]) => a.localeCompare(b)).map(([key,v]) => [key,normalize(v)])) : value;
  return JSON.stringify(normalize(form));
}

/** Owner-only normalized form content, not a cryptographic digest or public identifier. */
export interface PublicationReceipt { version: 1; formId: string; fingerprint: string }
export const PUBLICATION_CONFIRMATION_ERROR = "Publication may have completed, but its confirmation could not be verified. Keep your draft and refresh this editor to check the published version before publishing again.";

/** Never infer live identity from whichever local draft happens to render last. */
export function parsePublicationReceipt(value: unknown, expectedFormId: string): PublicationReceipt {
  const fail = () => { throw new Error(PUBLICATION_CONFIRMATION_ERROR); };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const receipt = value as Record<string, unknown>;
  if (Object.keys(receipt).sort().join(",") !== "fingerprint,formId,version" || receipt.version !== 1 || receipt.formId !== expectedFormId || !/^[a-zA-Z0-9_-]{1,128}$/.test(expectedFormId) || typeof receipt.fingerprint !== "string") return fail();
  // Existing saved forms and owner reads have no byte cap. Do not introduce a
  // new publication limit here; this owner-only content inherits that limit.
  if (!receipt.fingerprint) return fail();
  try {
    const original: unknown = JSON.parse(receipt.fingerprint), parsed = FormSchema.safeParse(original);
    // Validate without substituting parser defaults into older stored content.
    // The receipt describes exactly what was written, including legacy fields.
    if (!parsed.success || parsed.data.id !== expectedFormId || publicationFingerprint(original as FormSchemaType) !== receipt.fingerprint) return fail();
    return { version: 1, formId: expectedFormId, fingerprint: receipt.fingerprint };
  } catch { return fail(); }
}
