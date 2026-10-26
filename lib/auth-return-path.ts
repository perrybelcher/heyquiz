// Shared by server route protection and browser sign-in links. No React hooks
// or request state belong in this allowlist.
const destinations = new Set(["/create/ai", "/create/marketing", "/create/draft", "/reports", "/profile", "/experiments"]);
export function safeAuthReturn(value: unknown): string | null {
  return typeof value === "string" && (destinations.has(value) || (!/\s/.test(value) && /^\/editor\/[a-zA-Z0-9_-]{1,128}(?:\?section=(?:edit|contacts|marketing|integrate|share|results))?$/.test(value))) ? value : null;
}
