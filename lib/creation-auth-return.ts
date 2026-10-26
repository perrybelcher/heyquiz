import { useSyncExternalStore } from "react";

const destinations = new Set(["/create/ai", "/create/marketing"]);
export const CREATION_RETURN_KEY = "pippi_creation_auth_return_v1";
const lifetime = 24 * 60 * 60 * 1000;
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function safeCreationReturn(value: unknown): string | null {
  return typeof value === "string" && (destinations.has(value) || (!/\s/.test(value) && /^\/editor\/[a-zA-Z0-9_-]{1,128}$/.test(value))) ? value : null;
}
export function creationReturnFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  return params.getAll("next").length === 1 ? safeCreationReturn(params.get("next")) : null;
}
export function creationAuthHref(route: "/login" | "/signup" | "/resend-confirmation", next: string | null) {
  const safe = safeCreationReturn(next);
  return safe ? `${route}?next=${encodeURIComponent(safe)}` : route;
}
function browserStore(): Store | undefined {
  try { return window.sessionStorage; } catch { return undefined; }
}
export function clearCreationReturn(storage: Store | undefined = browserStore()) {
  try { storage?.removeItem(CREATION_RETURN_KEY); } catch { /* Navigation must work with storage blocked. */ }
}
export function rememberCreationReturn(next: string | null, storage: Store | undefined = browserStore(), now = Date.now()) {
  clearCreationReturn(storage);
  const safe = safeCreationReturn(next);
  if (!safe) return;
  try { storage?.setItem(CREATION_RETURN_KEY, JSON.stringify({ next: safe, expiresAt: now + lifetime })); } catch { /* The explicit sign-in link still works. */ }
}
function takeCreationReturn(storage: Store | undefined, now: number): string | null {
  let raw: string | null = null;
  try { raw = storage?.getItem(CREATION_RETURN_KEY) ?? null; } catch { return null; }
  clearCreationReturn(storage);
  try {
    const value = JSON.parse(raw || "null");
    return value && Number.isSafeInteger(value.expiresAt) && value.expiresAt > now && value.expiresAt <= now + lifetime
      ? safeCreationReturn(value.next) : null;
  } catch { return null; }
}
// Only an ordinary successful sign-in/signup can use this navigation preference.
// Recovery/reset destinations remain authoritative; this contains no auth data.
export function creationAuthDestination(serverNext: string, search = "", storage: Store | undefined = browserStore(), now = Date.now()) {
  if (serverNext !== "/") return serverNext;
  const params = new URLSearchParams(search);
  if (params.has("reset")) { clearCreationReturn(storage); return "/"; }
  if (params.has("next")) {
    clearCreationReturn(storage);
    return creationReturnFromSearch(search) || "/";
  }
  return takeCreationReturn(storage, now) || "/";
}
const subscribe = (listener: () => void) => {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
};
const snapshot = () => window.location.search;
const serverSnapshot = () => "";
export function useCreationReturn() {
  return creationReturnFromSearch(useSyncExternalStore(subscribe, snapshot, serverSnapshot));
}
