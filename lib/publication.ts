import type { FormSchemaType } from "./schema";
/** Stable comparison excludes storage metadata and object-key ordering. */
export function publicationFingerprint(form: FormSchemaType): string {
  const normalize = (value: unknown): unknown => Array.isArray(value) ? value.map(normalize) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([key,v]) => v !== undefined && !["revision","updatedAt","createdAt","publishedAt"].includes(key)).sort(([a],[b]) => a.localeCompare(b)).map(([key,v]) => [key,normalize(v)])) : value;
  return JSON.stringify(normalize(form));
}
