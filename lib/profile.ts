import { createHash } from "node:crypto";
import { z } from "zod";
import { requireUser, currentUser, localMode, HttpError } from "./auth";
import { beginEmailFlow, callbackUrl, emailAddress, newPassword } from "./account-auth";
import { getAccountUser, updateAccountUser, verifyAccountSessionUser, resolveAccountSession, type AccountUser } from "./account-session";
import { readRecord, writeRecord, type StoredRecord } from "./records";
import { ServiceUnavailableError } from "./errors";
import { PROFILE_COMPANY_MAX, PROFILE_NAME_MAX, type ProfileView, type ProfilePasswordResult } from "./profile-contract";

type ProfileRecord = { name: string; company: string };
const recordId = (owner: string) => createHash("sha256").update(owner).digest("hex");
const ProfileInput = z.object({ name: z.string().trim().max(PROFILE_NAME_MAX), company: z.string().trim().max(PROFILE_COMPANY_MAX), revision: z.number().int().min(0).safe() }).strict();
const CurrentPassword = z.string().min(1).max(128);
const EmailInput = z.object({ email: z.string().max(254), currentPassword: CurrentPassword }).strict();
const PasswordInput = z.object({ currentPassword: CurrentPassword, password: z.string().max(128) }).strict();
function isLocal(owner: string) { return owner === "local" && localMode(); }
async function profileRecord(owner: string): Promise<StoredRecord<ProfileRecord> | null> {
  const row = await readRecord<ProfileRecord>("account_profiles", recordId(owner));
  if (!row) return null;
  if (row.owner_id !== owner || typeof row.payload?.name !== "string" || row.payload.name.length > PROFILE_NAME_MAX
    || typeof row.payload.company !== "string" || row.payload.company.length > PROFILE_COMPANY_MAX)
    throw new ServiceUnavailableError("Your profile could not be loaded. Please retry.");
  return row;
}
async function view(owner: string, account?: AccountUser): Promise<ProfileView> {
  const row = await profileRecord(owner);
  return { name: row?.payload.name || "", company: row?.payload.company || "", email: account?.email || "", revision: row?.version || 0,
    ...(account?.pendingEmail ? { pendingEmail: account.pendingEmail } : {}), ...(isLocal(owner) ? { local: true } : {}) };
}
function requireHosted(owner: string) {
  if (isLocal(owner)) throw new HttpError(403, "Email and password changes are unavailable in the local workspace. Sign in to a hosted account to manage them.");
}
async function requireProfileAccount(expectedAccount?: string) {
  const user = await requireUser();
  if (!expectedAccount || expectedAccount !== user.accountKey)
    throw new HttpError(403, "Your signed-in account changed. Sign back into the original account before saving these profile details.");
  return user;
}
export async function getProfile(): Promise<ProfileView> {
  const user = await requireUser();
  return view(user.id, isLocal(user.id) ? undefined : await getAccountUser(user.id));
}
export async function saveProfile(input: unknown, expectedAccount?: string): Promise<ProfileView> {
  const parsed = ProfileInput.parse(input), user = await requireProfileAccount(expectedAccount);
  const account = isLocal(user.id) ? undefined : await getAccountUser(user.id);
  await writeRecord("account_profiles", recordId(user.id), user.id, { name: parsed.name, company: parsed.company }, parsed.revision);
  return view(user.id, account);
}
export async function changeProfileEmail(input: unknown, requestUrl: string, expectedAccount?: string): Promise<ProfileView> {
  const parsed = EmailInput.parse(input), user = await requireProfileAccount(expectedAccount); requireHosted(user.id);
  const requestedEmail = emailAddress(parsed.email), current = await getAccountUser(user.id);
  if (requestedEmail === current.email) throw new HttpError(422, "Enter a different email address.");
  const flow = await beginEmailFlow("email_change", { ownerId: user.id, requestedEmail });
  const updated = await updateAccountUser(user.id, parsed.currentPassword, { email: requestedEmail, ...flow.challenge, redirectTo: callbackUrl(requestUrl) });
  if (updated.email === requestedEmail && updated.emailConfirmed) return view(user.id, updated);
  if (updated.pendingEmail !== requestedEmail) throw new ServiceUnavailableError("The email change could not be verified. Refresh your profile before retrying.");
  await flow.persist();
  return view(user.id, updated);
}
export async function changeProfilePassword(input: unknown, expectedAccount?: string): Promise<ProfilePasswordResult> {
  const parsed = PasswordInput.parse(input), user = await requireProfileAccount(expectedAccount); requireHosted(user.id);
  await updateAccountUser(user.id, parsed.currentPassword, { password: newPassword(parsed.password) });
  // Provider acceptance proves the password update, even if a subsequent
  // availability check fails. Only a definitive invalid session requests login.
  try { if (!(await resolveAccountSession())) return { ok: true, reauthRequired: true }; }
  catch { /* The password update was confirmed; ordinary session checks report availability separately. */ }
  return { ok: true };
}
/** Called only after emailFlow() verifies the browser-bound signed PKCE flow. */
export async function verifyProfileEmailExchange(data: unknown, flow: Record<string, unknown>): Promise<void> {
  if (flow.role !== "email-flow" || flow.kind !== "email_change" || typeof flow.ownerId !== "string" || !flow.ownerId
    || typeof flow.requestedEmail !== "string" || emailAddress(flow.requestedEmail) !== flow.requestedEmail)
    throw new HttpError(400, "Restart the email change from your signed-in profile.");
  const signedIn = await currentUser();
  if (signedIn && signedIn.id !== flow.ownerId) throw new HttpError(409, "A different account is signed in. Sign back into the original account before confirming this email change.");
  const user = await verifyAccountSessionUser(data, flow.ownerId);
  if (user.email !== flow.requestedEmail || !user.emailConfirmed)
    throw new HttpError(409, "Email confirmation is not complete. Follow the confirmation instructions for both addresses, then refresh your profile.");
}
