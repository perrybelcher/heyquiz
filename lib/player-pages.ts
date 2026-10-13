import type { FormSchemaType, Question } from "./schema";
// Group the resolved path, not the raw form: hidden and branched-away fields stay absent.
// Contiguous groups also preserve forward navigation if a path revisits a page.
export function playerPages(form: FormSchemaType, visible: Question[]): Question[][] {
  if (form.settings.presentation !== "page") return visible.map(q => [q]);
  const groups: Question[][] = [];
  const page = (q: Question) => q.pageId || form.pages?.[0]?.id || "default";
  for (const q of visible) {
    const last = groups.at(-1);
    if (last && page(last[0]) === page(q)) last.push(q);
    else groups.push([q]);
  }
  return groups;
}
