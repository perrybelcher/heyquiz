export const editorSections = ["edit", "contacts", "marketing", "integrate", "share", "results"] as const;
export type EditorSection = typeof editorSections[number];
export function editorSection(value: unknown): EditorSection {
  return typeof value === "string" && (editorSections as readonly string[]).includes(value) ? value as EditorSection : "edit";
}
