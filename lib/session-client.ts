/** Browser coordination only. Authentication credentials remain HttpOnly. */
export type EditorSession =
  | { state: "authenticated"; accountKey: string; expiresAt: number }
  | { state: "reauth_required"; error?: string }
  | { state: "unavailable"; error?: string };
let checking: Promise<EditorSession> | null = null;
export function checkEditorSession(): Promise<EditorSession> {
  if (checking) return checking;
  checking = (async (): Promise<EditorSession> => {
    try {
      const response = await fetch("/api/auth/session", { method: "POST", cache: "no-store", signal: AbortSignal.timeout(20000) });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.state === "authenticated" && typeof data.accountKey === "string" && Number.isFinite(data.expiresAt)) return data;
      if (response.status === 401) return { state: "reauth_required", error: data?.error };
      return { state: "unavailable", error: "Account service is temporarily unavailable. Your draft has been kept." };
    } catch { return { state: "unavailable", error: "We could not check your session. Your draft has been kept." }; }
  })().finally(() => { checking = null; });
  return checking;
}
export type DraftSaveReport = { saved: boolean; persistent: boolean; dirty: boolean };
type SaveHandler = () => Promise<DraftSaveReport>;
const handlers = new Set<SaveHandler>();
let channel: BroadcastChannel | null | undefined;
const pending = new Map<string, DraftSaveReport[]>();
function coordination() {
  if (typeof window === "undefined" || channel !== undefined) return;
  try {
    channel = new BroadcastChannel("pippi-session-events-v1");
    channel.onmessage = event => {
      const message = event.data;
      if (message?.type === "auth") window.dispatchEvent(new Event("pippi-auth-change"));
      if (message?.type === "prepare" && typeof message.id === "string") void prepareLocal().then(reports => channel?.postMessage({ type: "prepared", id: message.id, reports }));
      if (message?.type === "prepared" && typeof message.id === "string" && Array.isArray(message.reports)) {
        const reports = pending.get(message.id);
        if (reports) for (const report of message.reports) if (typeof report?.saved === "boolean" && typeof report?.persistent === "boolean" && typeof report?.dirty === "boolean") reports.push(report);
      }
    };
  } catch { channel = null; }
}
export function publishAuthChange() {
  coordination();
  channel?.postMessage({ type: "auth" });
  window.dispatchEvent(new Event("pippi-auth-change"));
  try { localStorage.setItem("pippi-auth-notice", String(Date.now())); } catch { /* BroadcastChannel/focus still reconcile. */ }
}
export function registerDraftSave(handler: SaveHandler) { coordination(); handlers.add(handler); return () => { handlers.delete(handler); }; }
async function prepareLocal() { return Promise.all([...handlers].map(async handler => { try { return await handler(); } catch { return { saved: false, persistent: false, dirty: true }; } })); }
export async function prepareLogout(): Promise<DraftSaveReport[]> {
  coordination();
  const id = crypto.randomUUID(), reports: DraftSaveReport[] = [];
  pending.set(id, reports); channel?.postMessage({ type: "prepare", id });
  reports.push(...await prepareLocal());
  // Sleeping tabs cannot be forced to execute; their per-edit persistent copies
  // are checked below and logout never clears them.
  if (channel) await new Promise(resolve => setTimeout(resolve, 2000));
  pending.delete(id);
  return reports;
}
function pendingDeviceDrafts() {
  try { for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key?.startsWith("pippi-draft:v2:") || key?.startsWith("pippi-panel:v2:") || key?.startsWith("heyquiz-draft:")) return true; } return false; }
  catch { return true; }
}
function logoutChoice(warning: string): Promise<"retry" | "retain" | "cancel"> {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "pippi-account-dialog";
    dialog.setAttribute("aria-label", "Unsynced changes before sign-out");
    const body = document.createElement("div"); body.style.padding = "24px";
    const title = document.createElement("h2"); title.textContent = "Some edits have not synced"; title.style.fontWeight = "600";
    const text = document.createElement("p"); text.textContent = warning; text.style.margin = "16px 0";
    body.append(title, text);
    const finish = (choice: "retry" | "retain" | "cancel") => { dialog.close(); dialog.remove(); resolve(choice); };
    for (const [label, choice] of [["Retry", "retry"], ["Cancel logout", "cancel"], ["Sign out and retain the device draft", "retain"]] as const) {
      const button = document.createElement("button"); button.textContent = label; button.type = "button"; button.className = "hq-secondary"; button.style.margin = "6px";
      button.onclick = () => finish(choice); body.append(button);
    }
    dialog.oncancel = event => { event.preventDefault(); finish("cancel"); };
    dialog.append(body); document.body.append(dialog); dialog.showModal();
  });
}
/** Returns true only after server logout. Does not delete any draft or navigate. */
export async function requestSafeLogout(): Promise<boolean> {
  for (;;) {
    const reports = await prepareLogout();
    if (reports.some(report => report.dirty && !report.saved) || pendingDeviceDrafts()) {
      const missingBackup = reports.some(report => report.dirty && !report.persistent);
      const choice = await logoutChoice(missingBackup
        ? "A persistent browser backup has not been confirmed. Cancel logout and keep the editing tab open, or export your draft. Signing out cannot guarantee recovery after that tab closes."
        : "Pending edits will remain on this device for their original account. Sign back into that account to recover them; clearing browser data removes that copy.");
      if (choice === "retry") continue;
      if (choice === "cancel") return false;
    }
    const response = await fetch("/api/auth", { method: "DELETE", cache: "no-store" });
    if (!response.ok) throw new Error("Sign-out could not be confirmed. Your drafts have been kept. Please try again.");
    publishAuthChange(); return true;
  }
}
