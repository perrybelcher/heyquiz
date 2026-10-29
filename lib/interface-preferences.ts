import { createHash } from "node:crypto";
import { z } from "zod";
import { requireUser, HttpError } from "./auth";
import { readRecord, writeRecord } from "./records";
import type { InterfacePreference, InterfaceVersion, InterfaceView } from "./interface-contract";

type RolloutMode = "off" | "invite" | "opt-in" | "default-v2";
type PreferenceRecord = { preferredVersion: InterfacePreference };
const idFor = (owner: string) => createHash("sha256").update(owner).digest("hex");
const Input = z.object({ preferredVersion: z.enum(["v1", "v2"]).nullable(), revision: z.number().int().nonnegative().safe() }).strict();
export function interfaceRollout(owner: string): { mode: RolloutMode; eligible: boolean } {
  const configured = process.env.PIPPI_INTERFACE_ROLLOUT;
  const mode: RolloutMode = configured === "invite" || configured === "opt-in" || configured === "default-v2" ? configured : "off";
  const invited = (process.env.PIPPI_INTERFACE_ALLOWLIST || "").split(",").map(value => value.trim()).filter(Boolean).includes(owner);
  return { mode, eligible: mode === "opt-in" || mode === "default-v2" || (mode === "invite" && invited) };
}
export function effectiveInterface(preference: InterfacePreference, rollout: ReturnType<typeof interfaceRollout>): InterfaceVersion {
  if (!rollout.eligible || preference === "v1") return "v1";
  return preference === "v2" || rollout.mode === "default-v2" ? "v2" : "v1";
}
export async function getInterfaceForOwner(owner: string): Promise<InterfaceView> {
  const row = await readRecord<PreferenceRecord>("interface_preferences", idFor(owner));
  if (row && (row.owner_id !== owner || ![null, "v1", "v2"].includes(row.payload?.preferredVersion))) throw new HttpError(503, "Your interface preference could not be loaded.");
  const preference = row?.payload.preferredVersion ?? null, rollout = interfaceRollout(owner);
  return { preferredVersion: preference, effectiveVersion: effectiveInterface(preference, rollout), eligible: rollout.eligible, revision: row?.version || 0 };
}
export async function resolveInterface(owner: string): Promise<InterfaceVersion> {
  if (!interfaceRollout(owner).eligible) return "v1";
  try { return (await getInterfaceForOwner(owner)).effectiveVersion; }
  catch { console.warn("[interface] preference lookup failed; using Classic"); return "v1"; }
}
export async function getInterfacePreference(): Promise<InterfaceView> {
  return getInterfaceForOwner((await requireUser()).id);
}
export async function saveInterfacePreference(input: unknown, expectedAccount?: string): Promise<InterfaceView> {
  const parsed = Input.parse(input), user = await requireUser();
  if (!expectedAccount || expectedAccount !== user.accountKey) throw new HttpError(403, "Your signed-in account changed. Sign in to the original account before switching interfaces.");
  if (parsed.preferredVersion === "v2" && !interfaceRollout(user.id).eligible) throw new HttpError(403, "The new interface is not available for this account yet.");
  // Validate ownership before writing; the storage layer also checks ownership and revision.
  await getInterfaceForOwner(user.id);
  await writeRecord("interface_preferences", idFor(user.id), user.id, { preferredVersion: parsed.preferredVersion }, parsed.revision);
  return getInterfaceForOwner(user.id);
}
