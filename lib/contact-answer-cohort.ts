/** Browser-safe contract. No frozen forms or raw answer values cross this boundary. */
export type ContactAnswerPair = { version: string; option: string };
export type ContactAnswerStatus = "answered" | "unanswered" | "skipped" | "otherVersion" | "unavailable" | "invalid";
export type ContactAnswerCounts = Record<ContactAnswerStatus, number>;
export interface ContactAnswerVersion {
  id: string; title: string; type: string; multiple: boolean; contacts: number;
  options: { id: string; label: string }[]; omittedOptions: number;
}
export interface ContactAnswerCohort {
  versions: ContactAnswerVersion[]; omittedVersions: number; unavailableSnapshots: number;
  selection: ContactAnswerPair | null; counts: ContactAnswerCounts | null; matchingIds: string[];
}
export const answerVersionLimit = 60, answerOptionLimit = 100;
export const contactAnswerTypes = ["multiple_choice", "picture_choice", "dropdown", "segmented", "switch", "like_dislike", "thumbs", "multiselect", "checkboxes", "image_multiselect"];
export const answerVersionId = (value: unknown): value is string => typeof value === "string" && /^answer-version-[a-f0-9]{20}$/.test(value);
export const answerOptionId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
export class ContactAnswerQueryError extends Error {}
export const sameAnswerPair = (a: ContactAnswerPair | null | undefined, b: ContactAnswerPair | null | undefined) => a?.version === b?.version && a?.option === b?.option;
export function parseContactAnswerQuery(params: URLSearchParams): ContactAnswerPair | null {
  for (const key of params.keys()) if (!["answerVersion", "answerOption"].includes(key) || params.getAll(key).length !== 1) throw new ContactAnswerQueryError("Choose one saved question and answer.");
  const version = params.get("answerVersion"), option = params.get("answerOption");
  if (version === null && option === null) return null;
  if (!answerVersionId(version) || !answerOptionId(option)) throw new ContactAnswerQueryError("Choose a valid saved question and answer together.");
  return { version, option };
}
export function contactAnswerQuery(pair: ContactAnswerPair | null) {
  return pair ? "?" + new URLSearchParams({ answerVersion: pair.version, answerOption: pair.option }).toString() : "";
}
export function contactAnswerVersionLabel(version: ContactAnswerVersion) {
  return `${version.title} · Saved version ${version.id.slice(-6)}`;
}
export function contactAnswerOptionLabel(version: ContactAnswerVersion, option: { id: string; label: string }) {
  const same = version.options.filter(other => other.label === option.label);
  return same.length > 1 ? `${option.label} · Option ${option.id}` : option.label;
}
const statuses: ContactAnswerStatus[] = ["answered", "unanswered", "skipped", "otherVersion", "unavailable", "invalid"];
/** A malformed or old response must not turn a selected answer into a broad export. */
export function parseContactAnswerCohort(value: unknown, responseIds: string[], expected: ContactAnswerPair | null): ContactAnswerCohort {
  const fail = (): never => { throw Error("The saved answer filter could not be read. Please refresh."); };
  const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
  if (value === undefined && !responseIds.length && expected === null) return { versions: [], omittedVersions: 0, unavailableSnapshots: 0, selection: null, counts: null, matchingIds: [] };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const raw = value as ContactAnswerCohort;
  if (!Array.isArray(raw.versions) || raw.versions.length > answerVersionLimit || !integer(raw.omittedVersions) || !integer(raw.unavailableSnapshots) || raw.unavailableSnapshots > responseIds.length || !Array.isArray(raw.matchingIds)) return fail();
  if (!sameAnswerPair(raw.selection, expected) || (expected === null && raw.selection !== null)) return fail();
  const seen = new Set<string>(), versions: ContactAnswerVersion[] = [];
  for (const version of raw.versions) {
    if (!version || !answerVersionId(version.id) || seen.has(version.id) || typeof version.title !== "string" || version.title.length > 2000 || !contactAnswerTypes.includes(version.type) || typeof version.multiple !== "boolean" || !integer(version.contacts) || version.contacts > responseIds.length || !integer(version.omittedOptions) || !Array.isArray(version.options) || !version.options.length || version.options.length > answerOptionLimit) return fail();
    const ids = new Set<string>(), options: ContactAnswerVersion["options"] = [];
    for (const option of version.options) {
      if (!option || !answerOptionId(option.id) || ids.has(option.id) || typeof option.label !== "string" || option.label.length > 2000) return fail();
      ids.add(option.id); options.push({ id: option.id, label: option.label });
    }
    seen.add(version.id); versions.push({ id: version.id, title: version.title, type: version.type, multiple: version.multiple, contacts: version.contacts, options, omittedOptions: version.omittedOptions });
  }
  const knownIds = new Set(responseIds), matched = new Set<string>();
  for (const id of raw.matchingIds) { if (typeof id !== "string" || !knownIds.has(id) || matched.has(id)) return fail(); matched.add(id); }
  let counts: ContactAnswerCounts | null = null;
  if (expected) {
    const version = versions.find(v => v.id === expected.version);
    if (!version?.options.some(option => option.id === expected.option) || !raw.counts || statuses.some(key => !integer(raw.counts![key]))) return fail();
    counts = Object.fromEntries(statuses.map(key => [key, raw.counts![key]])) as ContactAnswerCounts;
    if (statuses.reduce((total, key) => total + counts![key], 0) !== responseIds.length || matched.size > counts.answered) return fail();
  } else if (raw.counts !== null || matched.size) return fail();
  return { versions, omittedVersions: raw.omittedVersions, unavailableSnapshots: raw.unavailableSnapshots, selection: expected ? { ...expected } : null, counts, matchingIds: [...matched] };
}
