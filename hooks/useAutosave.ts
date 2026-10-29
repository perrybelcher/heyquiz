"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { FormSchema, type FormSchemaType } from "@/lib/schema";
import { clarityEvent } from "@/lib/clarity";
import { checkEditorSession, registerDraftSave } from "@/lib/session-client";
import { readDraftForm, clearAppliedPanels, clearAcknowledged, draftFingerprint, listRecovery, recoveryCandidates, writeRecovery, type RecoveryDraft } from "@/lib/draft-recovery";
const delays = [2000, 5000, 15000];
const uncertain = "We could not verify the save confirmation. Your browser draft has been kept. Retry to check the account copy before saving again.";
type Options = { accountKey?: string; onRestore?: (form: FormSchemaType) => void };
export function useAutosave(form: FormSchemaType, guest = false, options: Options = {}) {
  const [status, setStatus] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const [error, setError] = useState(""), [authRequired, setAuthRequired] = useState(false), [accountMismatch, setAccountMismatch] = useState(false);
  const [claimed, setClaimed] = useState(false), [storageWarning, setStorageWarning] = useState(false);
  const [backupFingerprint, setBackupFingerprint] = useState(""), [tabBackupFingerprint, setTabBackupFingerprint] = useState("");
  const [savedFingerprint, setSavedFingerprint] = useState(() => draftFingerprint(form));
  const [recoveryCopies, setRecoveryCopies] = useState<RecoveryDraft[]>([]), [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const [scope, setScope] = useState(options.accountKey), [failureCount, setFailureCount] = useState(0);
  const latest = useRef(form), revision = useRef(form.revision || 0), saved = useRef(draftFingerprint(form));
  const pending = useRef<Promise<boolean> | null>(null), retryable = useRef(true), retries = useRef(0), retryAfter = useRef(0);
  const instance = useRef<string | null>(null), recovered = useRef(false), mounted = useRef(true), paused = useRef(false), scopeRef = useRef(scope);
  const backup = useRef({ persistent: false, tab: false, fingerprint: "" });
  const claimAccount = useRef<string | undefined>(undefined);
  const restore = useRef(options.onRestore), claimAcknowledged = useRef(false), claimedId = useRef<string | null>(null), claimedCreatedAt = useRef<string | undefined>(undefined);
  const uncertainSnapshot = useRef<FormSchemaType | null>(null);
  const leavingClaimedDraft = useRef(false);
  const key = `heyquiz-draft:${form.id}`;
  useEffect(() => { restore.current = options.onRestore; }, [options.onRestore]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const markAuth = useCallback((required: boolean, mismatch = false) => { paused.current = required; if (mounted.current) { setAuthRequired(required); setAccountMismatch(mismatch); } }, []);
  const backupNow = useCallback((snapshot: FormSchemaType) => {
    let persistent = false, tab = false;
    const fingerprint = draftFingerprint(snapshot), accountKey = scopeRef.current;
    if (!instance.current) instance.current = crypto.randomUUID();
    if (accountKey) {
      const draft: RecoveryDraft = { version: 2, accountKey, formId: snapshot.id, instance: instance.current, baseRevision: revision.current, updatedAt: Date.now(), form: snapshot };
      try { tab = writeRecovery(sessionStorage, draft); } catch {}
      try { persistent = writeRecovery(localStorage, draft); } catch {}
    } else {
      // Guests retain the established browser-only recovery format. Owned editors
      // never write this unscoped format after receiving verified account context.
      const raw = JSON.stringify(snapshot);
      try { sessionStorage.setItem(key, raw); tab = sessionStorage.getItem(key) === raw; } catch {}
      try { localStorage.setItem(key, raw); persistent = localStorage.getItem(key) === raw; } catch {}
    }
    backup.current = { persistent, tab, fingerprint };
    if (mounted.current) { setStorageWarning(!persistent); setBackupFingerprint(persistent ? fingerprint : ""); setTabBackupFingerprint(tab ? fingerprint : ""); }
    return { persistent, tab };
  }, [key]);
  useEffect(() => {
    scopeRef.current = scope;
    if (recovered.current) return;
    recovered.current = true;
    const copies: RecoveryDraft[] = [];
    if (scope) {
      try { copies.push(...listRecovery(sessionStorage, scope, form.id)); } catch {}
      try { copies.push(...listRecovery(localStorage, scope, form.id)); } catch {}
    }
    // The initial accountKey comes only from an ownership-checked server page.
    // Read legacy copies without deleting them; migration is complete only once
    // a scoped persistent copy or a verified server save exists.
    for (const getStore of [() => sessionStorage, () => localStorage]) {
      try {
        const legacy = readDraftForm(JSON.parse(getStore().getItem(key) || "null"));
        if (legacy?.id === form.id && (guest || scope)) copies.push({ version: 2, accountKey: scope || "guest", formId: form.id, instance: "legacy", baseRevision: legacy.revision || 0, updatedAt: 0, form: legacy });
      } catch {}
    }
    const candidates = recoveryCandidates(copies, form);
    if (candidates.length === 1 && scope && candidates[0].baseRevision === revision.current && restore.current) {
      const restored = { ...candidates[0].form, revision: revision.current };
      latest.current = restored; backupNow(restored); restore.current(restored);
    } else if (candidates.length) {
      // External browser storage is read only after hydration; this initializes
      // the explicit recovery review without changing the draft during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecoveryCopies(candidates);
    }
  }, [scope, form, key, guest, backupNow]);
  useEffect(() => {
    latest.current = form;
    if (guest || draftFingerprint(form) !== saved.current) backupNow(form);
  }, [form, guest, backupNow]);
  const checkSession = useCallback(async () => {
    const session = await checkEditorSession();
    if (session.state === "reauth_required") { markAuth(true); return false; }
    if (session.state === "unavailable") { if (mounted.current) setError(session.error || "Account service is temporarily unavailable."); return false; }
    if ((scopeRef.current || claimAccount.current) && session.accountKey !== (scopeRef.current || claimAccount.current)) { markAuth(true, true); return false; }
    if (guest && !claimedId.current) claimAccount.current = session.accountKey;
    if (paused.current) { retryable.current = true; retries.current = 0; }
    markAuth(false); return true;
  }, [markAuth, guest]);
  const clearSnapshot = useCallback((snapshot: FormSchemaType) => {
    for (const getStore of [() => sessionStorage, () => localStorage]) {
      try {
        const store = getStore();
        if (scopeRef.current) { clearAcknowledged(store, scopeRef.current, snapshot); clearAppliedPanels(store, scopeRef.current, snapshot); }
        const legacy = FormSchema.safeParse(JSON.parse(store.getItem(key) || "null"));
        if (legacy.success && draftFingerprint(legacy.data) === draftFingerprint(snapshot)) store.removeItem(key);
        if (!store.getItem(key) && store.getItem("pippi-guest-draft") === snapshot.id) store.removeItem("pippi-guest-draft");
      } catch {}
    }
  }, [key]);
  const acknowledged = useCallback((data: unknown, snapshot: FormSchemaType, minimumRevision: number) => {
    const parsed = FormSchema.safeParse(data);
    if (!parsed.success || parsed.data.id !== snapshot.id || !Number.isSafeInteger(parsed.data.revision) || parsed.data.revision! < minimumRevision || draftFingerprint(parsed.data) !== draftFingerprint(snapshot)) return false;
    revision.current = parsed.data.revision!;
    saved.current = draftFingerprint(snapshot);
    setSavedFingerprint(saved.current); uncertainSnapshot.current = null;
    clearSnapshot(snapshot); return true;
  }, [clearSnapshot]);
  const reconcile = useCallback(async (snapshot: FormSchemaType): Promise<"matched" | "absent" | "unchanged" | "conflict" | "unavailable"> => {
    try {
      const response = await fetch(`/api/forms/${snapshot.id}`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
      if (response.status === 401) markAuth(true);
      if (response.status === 404) return "absent";
      if (!response.ok) return "unavailable";
      const data = await response.json();
      if (acknowledged(data, snapshot, revision.current + 1)) return "matched";
      const parsed = FormSchema.safeParse(data);
      if (!parsed.success || parsed.data.id !== snapshot.id) return "unavailable";
      return parsed.data.revision === revision.current ? "unchanged" : "conflict";
    } catch { return "unavailable"; }
  }, [acknowledged, markAuth]);
  const saveNow = useCallback(async (snapshot?: FormSchemaType, automatic = false): Promise<boolean> => {
    if (automatic && (document.visibilityState !== "visible" || !navigator.onLine)) return false;
    if (snapshot) { latest.current = snapshot; if (draftFingerprint(snapshot) !== saved.current || guest) backupNow(snapshot); }
    if (!automatic) retries.current = 0;
    while (pending.current) if (!(await pending.current)) return false;
    const task = (async () => {
      if (paused.current && !(await checkSession())) return false;
      setError("");
      const isCreation = guest && !claimedId.current;
      if ((isCreation || scopeRef.current) && !(await checkSession())) { setStatus("error"); if (!paused.current) { retryable.current = true; setFailureCount(value => value + 1); } return false; }
      // An uncertain write is checked first. A retry never invents a fresh ID or
      // silently upgrades an old expected revision over someone else's changes.
      if (uncertainSnapshot.current) {
        const old = uncertainSnapshot.current, outcome = await reconcile(old);
        if (outcome === "matched" && isCreation) {
          leavingClaimedDraft.current = true;
          claimedId.current = old.id; claimedCreatedAt.current = old.createdAt; setClaimed(true);
          if (draftFingerprint(latest.current) !== saved.current) backupNow(latest.current);
          window.history.replaceState(null, "", `/editor/${old.id}`); window.location.assign(`/editor/${old.id}`); return false;
        }
        if (outcome !== "matched") {
          const canRepeat = isCreation ? outcome === "absent" && !claimAcknowledged.current : outcome === "unchanged";
          if (canRepeat) uncertainSnapshot.current = null;
          else {
            retryable.current = outcome === "unavailable";
            setError(outcome === "conflict" ? "This quiz changed elsewhere. Review the account version before saving; your draft has been kept." : uncertain);
            setStatus("error"); if (retryable.current) setFailureCount(value => value + 1); return false;
          }
        }
      }
      while ((guest && !claimedId.current) || draftFingerprint(latest.current) !== saved.current) {
        const current = latest.current, creating = guest && !claimedId.current;
        if (creating && claimAcknowledged.current) { setError(uncertain); setStatus("error"); return false; }
        setStatus("saving"); retryable.current = true; let sent = false;
        try {
          const body = { ...current, ...(claimedId.current && !current.createdAt ? { createdAt: claimedCreatedAt.current } : {}), revision: creating ? 0 : revision.current };
          sent = true; uncertainSnapshot.current = current;
          const response = await fetch(creating ? "/api/forms" : `/api/forms/${current.id}`, { method: creating ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
          retryable.current = response.status >= 500 || response.status === 429;
          const header = response.headers.get("retry-after"), seconds = header ? Number(header) : NaN;
          const retryDelay = header ? (Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, Date.parse(header) - Date.now())) : 0;
          retryAfter.current = Number.isFinite(retryDelay) ? retryDelay : 0;
          if (response.status === 401) markAuth(true);
          if (response.ok && creating) claimAcknowledged.current = true;
          const data = await response.json().catch(() => null);
          if (!response.ok) { uncertainSnapshot.current = null; throw new Error(data?.error || "Your changes could not be saved. Your draft has been kept."); }
          if (!acknowledged(data, current, creating ? 1 : revision.current + 1)) {
            if (await reconcile(current) !== "matched") throw new Error(uncertain);
          }
          if (creating) {
            claimedId.current = current.id;
            claimedCreatedAt.current = typeof data?.createdAt === "string" ? data.createdAt : undefined;
            const session = await checkEditorSession();
            if (session.state === "authenticated") { scopeRef.current = session.accountKey; setScope(session.accountKey); }
            leavingClaimedDraft.current = true;
            setClaimed(true); setRecoveryDismissed(true);
            // Retain any edits that arrived during creation before navigation.
            if (draftFingerprint(latest.current) !== saved.current) backupNow(latest.current);
            clarityEvent("draft_saved"); setStatus("saved");
            window.history.replaceState(null, "", `/editor/${current.id}`);
            window.location.assign(`/editor/${current.id}`); return false;
          }
          markAuth(false); retries.current = 0; clarityEvent("draft_saved");
        } catch (cause) {
          leavingClaimedDraft.current = false;
          // A network loss can occur after commit. Reconcile before reporting
          // failure, but never clear a backup based on HTTP success alone.
          if (sent && uncertainSnapshot.current && await reconcile(current) === "matched") {
            if (creating) {
              leavingClaimedDraft.current = true;
              claimedId.current = current.id; setClaimed(true);
              if (draftFingerprint(latest.current) !== saved.current) backupNow(latest.current);
              window.history.replaceState(null, "", `/editor/${current.id}`); window.location.assign(`/editor/${current.id}`); return false;
            }
            continue;
          }
          clarityEvent(paused.current ? "save_auth_required" : "save_failed");
          setError(cause instanceof Error && !["AbortError", "TimeoutError"].includes(cause.name) ? cause.message : "Saving was interrupted. Your draft has been kept.");
          setStatus("error"); setFailureCount(value => value + 1); return false;
        }
      }
      setStatus("saved"); setError(""); return true;
    })();
    pending.current = task;
    try { return await task; } finally { if (pending.current === task) pending.current = null; }
  }, [guest, backupNow, checkSession, reconcile, acknowledged, markAuth]);
  const afterSignIn = useCallback(async () => { if (!(await checkSession())) return false; return saveNow(latest.current); }, [checkSession, saveNow]);
  useEffect(() => {
    if (guest && !claimed || paused.current || recoveryCopies.length && !recoveryDismissed || draftFingerprint(form) === saved.current) return;
    const timer = setTimeout(() => { retries.current = 0; void saveNow(undefined, true); }, 600);
    return () => clearTimeout(timer);
  }, [form, saveNow, guest, claimed, recoveryCopies.length, recoveryDismissed]);
  useEffect(() => {
    if (!failureCount || !retryable.current || paused.current || retries.current >= delays.length || document.visibilityState !== "visible" || !navigator.onLine) return;
    const timer = setTimeout(() => { retries.current++; void saveNow(undefined, true); }, Math.max(delays[retries.current], retryAfter.current));
    return () => clearTimeout(timer);
  }, [failureCount, saveNow]);
  useEffect(() => {
    if (guest && !claimed) return;
    let lastActivityCheck = Date.now(), cancelled = false;
    const resume = async (event?: Event) => {
      // Skip only the immediate refresh while the claim loads a new document.
      // Keep save/listener protection if beforeunload cancels that departure.
      if (event) leavingClaimedDraft.current = false;
      if (leavingClaimedDraft.current) return;
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      if (!(await checkSession()) || cancelled) return;
      if (retryable.current && !pending.current && !(recoveryCopies.length && !recoveryDismissed) && draftFingerprint(latest.current) !== saved.current) void saveNow(undefined, true);
    };
    const activity = () => { if (leavingClaimedDraft.current || Date.now() - lastActivityCheck >= 300000) { leavingClaimedDraft.current = false; lastActivityCheck = Date.now(); void resume(); } };
    const notice = (event: StorageEvent) => { if (event.key === "pippi-auth-notice") void resume(event); };
    void resume();
    for (const name of ["online", "focus", "pippi-auth-change"]) window.addEventListener(name, resume);
    document.addEventListener("visibilitychange", resume);
    for (const name of ["pointerdown", "keydown", "input"]) document.addEventListener(name, activity, { passive: true });
    window.addEventListener("storage", notice);
    const unregister = registerDraftSave(async () => {
      const dirty = draftFingerprint(latest.current) !== saved.current;
      if (!dirty) return { dirty: false, saved: true, persistent: true };
      const copy = backupNow(latest.current), savedOk = await saveNow();
      return { dirty, saved: savedOk, persistent: copy.persistent };
    });
    return () => { cancelled = true; unregister(); for (const name of ["online", "focus", "pippi-auth-change"]) window.removeEventListener(name, resume); document.removeEventListener("visibilitychange", resume); for (const name of ["pointerdown", "keydown", "input"]) document.removeEventListener(name, activity); window.removeEventListener("storage", notice); };
  }, [guest, claimed, checkSession, saveNow, backupNow, recoveryCopies.length, recoveryDismissed]);
  useEffect(() => {
    const checkpoint = () => { if (draftFingerprint(latest.current) !== saved.current) backupNow(latest.current); };
    const warn = (event: BeforeUnloadEvent) => { if (draftFingerprint(latest.current) !== saved.current) { checkpoint(); event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("pagehide", checkpoint); window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("pagehide", checkpoint); window.removeEventListener("beforeunload", warn); };
  }, [backupNow]);
  return {
    status: status === "saved" && draftFingerprint(form) !== savedFingerprint ? "unsaved" as const : status,
    error, authRequired, accountMismatch, claimed, storageWarning,
    backedUp: backupFingerprint === draftFingerprint(form), tabBackedUp: tabBackupFingerprint === draftFingerprint(form),
    saveNow, afterSignIn, canEdit: useCallback(() => (guest && !claimedId.current) || !paused.current, [guest]),
    recovery: recoveryDismissed ? null : recoveryCopies[0]?.form ?? null,
    recoveries: recoveryDismissed ? [] : recoveryCopies,
    dismissRecovery: () => setRecoveryDismissed(true),
  };
}
