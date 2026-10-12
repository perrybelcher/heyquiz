import { FormSchema, type FormSchemaType } from "./schema";

type DraftStorage = Pick<Storage, "getItem">;

const recoveredRoutes = new Set<string>();
/** A document reload may restore its builder once; later client navigation starts fresh. */
export function recoverBuilderReload(pathname: string): boolean {
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (navigation?.type !== "reload" || recoveredRoutes.has(pathname)) return false;
  try {
    if (new URL(navigation.name).pathname !== pathname) return false;
  } catch { return false; }
  recoveredRoutes.add(pathname);
  return true;
}

/** Read a recoverable draft without changing pointers or overwriting another quiz. */
export function readGuestDraft(local: DraftStorage, session?: DraftStorage, id?: string | null): FormSchemaType | null {
  try {
    const draftId = id ?? local.getItem("pippi-guest-draft");
    if (!draftId) return null;
    const key = `heyquiz-draft:${draftId}`;
    // Match autosave's recovery precedence: this tab's copy is the most relevant.
    let tabCopy: string | null = null;
    try { tabCopy = session?.getItem(key) ?? null; } catch {}
    let deviceCopy: string | null = null;
    try { deviceCopy = local.getItem(key); } catch {}
    for (const raw of [tabCopy, deviceCopy]) {
      if (!raw) continue;
      try {
        const parsed = FormSchema.safeParse(JSON.parse(raw));
        if (parsed.success && parsed.data.id === draftId) return parsed.data;
      } catch {}
    }
  } catch {}
  return null;
}
