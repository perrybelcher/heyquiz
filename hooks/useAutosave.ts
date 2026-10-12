"use client";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
  useMemo,
} from "react";
import { FormSchema, type FormSchemaType } from "@/lib/schema";
const fingerprint = (form: FormSchemaType) =>
  // Schema parsing can reorder object keys without changing a draft. Compare
  // canonical objects while preserving question/answer order and content.
  // Server-managed timestamps/revisions do not represent unsaved user edits.
  JSON.stringify({ ...form, revision: undefined, updatedAt: undefined, createdAt: undefined }, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]))
      : value,
  );
const claimConfirmationError = "We could not verify the save confirmation. Keep this tab open and check your account’s quizzes before trying again; your browser draft has been kept.";
export function useAutosave(form: FormSchemaType, guest = false) {
  const [status, setStatus] = useState<
      "saved" | "unsaved" | "saving" | "error"
    >("saved"),
    [storageWarning, setStorageWarning] = useState(false),
    [backupFingerprint, setBackupFingerprint] = useState(""),
    [error, setError] = useState(""),
    [authRequired, setAuthRequired] = useState(false),
    [claimed, setClaimed] = useState(false),
    [recoveryDismissed, setRecoveryDismissed] = useState(false),
    [savedFingerprint, setSavedFingerprint] = useState(fingerprint(form));
  const latest = useRef(form),
    revision = useRef(form.revision || 0),
    saved = useRef(fingerprint(form)),
    pending = useRef<Promise<boolean> | null>(null);
  const retryable = useRef(true);
  // A successful POST is never retried as another creation, even if its browser
  // navigation is cancelled. Only a verified revision permits subsequent PUTs.
  const claimAcknowledged = useRef(false);
  const claimedId = useRef<string | null>(null);
  const claimedCreatedAt = useRef<string | undefined>(undefined);
  const key = `heyquiz-draft:${form.id}`;
  const draftSnapshot = useRef<string | null | undefined>(undefined);
  const initialDraftSnapshot = useCallback(() => {
    if (draftSnapshot.current === undefined) {
      try { draftSnapshot.current = sessionStorage.getItem(key); } catch { draftSnapshot.current = null; }
      if (!draftSnapshot.current) try { draftSnapshot.current = localStorage.getItem(key); } catch {}
    }
    return draftSnapshot.current;
  }, [key]);
  const stored = useSyncExternalStore(
    () => () => {},
    initialDraftSnapshot,
    () => null,
  );
  const recovery = useMemo(() => {
    if (recoveryDismissed || !stored) return null;
    try {
      const draft = FormSchema.parse(JSON.parse(stored));
      return fingerprint(draft) !== savedFingerprint ? draft : null;
    } catch {
      return null;
    }
  }, [stored, recoveryDismissed, savedFingerprint]);
  useEffect(() => {
    latest.current = form;
    if (guest || fingerprint(form) !== saved.current) {
      try {
        // A tab-local copy prevents another editor tab from overwriting recovery.
        sessionStorage.setItem(key, JSON.stringify(form));
        localStorage.setItem(key, JSON.stringify(form));
        // This status reflects a successful external storage write; render alone
        // cannot determine whether quota or browser policy allowed the backup.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBackupFingerprint(fingerprint(form));
        setStorageWarning(false);
      } catch { setStorageWarning(true); }
    }
  }, [form, key, guest]);
  const saveNow = useCallback(async (snapshot?: FormSchemaType): Promise<boolean> => {
    // Explicit actions (preview/publish) provide the rendered draft so they never
    // depend on the backup effect having run before the click handler.
    if (snapshot) latest.current = snapshot;
    // Several actions may wait for one save (for example preview and navigation).
    // Share its failure instead of racing to retry the same server revision, and
    // recheck the lock after every await in case another waiter began a save.
    while (pending.current) {
      if (!(await pending.current)) return false;
    }
    const task = (async () => {
      setError("");
      // Guest drafts stay on this device until an authenticated account claims them.
      if (guest && !claimedId.current) {
        if (claimAcknowledged.current) {
          setError(claimConfirmationError);
          setStatus("error");
          return false;
        }
        setStatus("saving");
        try {
          // Only this snapshot is confirmed by the POST. Edits can arrive while
          // it is in flight and must remain backed up for recovery after claim.
          const snapshot = latest.current;
          const claimedFingerprint = fingerprint(snapshot);
          const res = await fetch("/api/forms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...snapshot, revision: 0 }),
          });
          // Even an unreadable successful response must not lead to another POST.
          if (res.ok) claimAcknowledged.current = true;
          const data = await res.json();
          if (!res.ok) {
            setAuthRequired(res.status === 401);
            throw new Error(data.error || "Could not save your quiz.");
          }
          if (data.id !== snapshot.id || !Number.isSafeInteger(data.revision) || data.revision < 1)
            throw new Error(claimConfirmationError);
          claimedId.current = snapshot.id;
          claimedCreatedAt.current = typeof data.createdAt === "string" ? data.createdAt : undefined;
          revision.current = data.revision;
          saved.current = claimedFingerprint;
          setSavedFingerprint(claimedFingerprint);
          setAuthRequired(false);
          // The mounted guest editor already contains the live draft. Its initial
          // recovery snapshot must not reappear merely because the save changed.
          setRecoveryDismissed(true);
          setClaimed(true);
          setStatus("saved");
          // Each storage area can fail independently. Remove only copies that
          // match the confirmed snapshot, never newer edits from this/another tab.
          try {
            const backup = sessionStorage.getItem(key);
            if (backup && fingerprint(FormSchema.parse(JSON.parse(backup))) === claimedFingerprint)
              sessionStorage.removeItem(key);
          } catch {}
          try {
            const backup = localStorage.getItem(key);
            if (backup && fingerprint(FormSchema.parse(JSON.parse(backup))) === claimedFingerprint)
              localStorage.removeItem(key);
            // A retained same-ID draft still needs its resume pointer; a new
            // guest draft in another tab also keeps its own different pointer.
            if (!localStorage.getItem(key) && localStorage.getItem("pippi-guest-draft") === snapshot.id)
              localStorage.removeItem("pippi-guest-draft");
          } catch {}
          // The account copy exists now. A reload after choosing Stay must open
          // that copy and recover newer edits, never re-enter guest creation.
          window.history.replaceState(null, "", `/editor/${snapshot.id}`);
          window.location.assign(`/editor/${snapshot.id}`);
          // Keep the beforeunload guard: newer edits may not be safely backed up.
          // Choosing Stay leaves a confirmed account draft with normal PUT saves.
          return false;
        } catch (e) {
          setError(claimAcknowledged.current && !claimedId.current ? claimConfirmationError : e instanceof Error ? e.message : "Could not save your quiz.");
          setStatus("error");
          return false;
        }
      }
      retryable.current = true;
      while (fingerprint(latest.current) !== saved.current) {
        const snapshot = latest.current;
        setStatus("saving");
        try {
          const res = await fetch(`/api/forms/${snapshot.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...snapshot, ...(claimedId.current && !snapshot.createdAt ? { createdAt: claimedCreatedAt.current } : {}), revision: revision.current }),
          });
          const data = await res.json();
          retryable.current = res.ok || res.status === 401 || res.status >= 500;
          if (!res.ok) {
            setAuthRequired(res.status === 401);
            throw new Error(data.error || "Save failed.");
          }
          setAuthRequired(false);
          revision.current = data.revision;
          saved.current = fingerprint(snapshot);
          setSavedFingerprint(saved.current);
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "Save failed. Keep this tab open and retry to protect your changes.",
          );
          setStatus("error");
          return false;
        }
      }
      setStatus("saved");
      try {
        sessionStorage.removeItem(key);
        // Do not erase a different tab's newer unsaved draft.
        const backup = localStorage.getItem(key);
        if (backup && fingerprint(FormSchema.parse(JSON.parse(backup))) === saved.current)
          localStorage.removeItem(key);
      } catch {}
      return true;
    })();
    pending.current = task;
    try {
      return await task;
    } finally {
      if (pending.current === task) pending.current = null;
    }
  }, [key, guest]);
  useEffect(() => {
    if (guest && !claimed) return;
    if (fingerprint(form) === saved.current) return;
    const timer = setTimeout(() => void saveNow(), 600);
    return () => clearTimeout(timer);
  }, [form, saveNow, guest, claimed]);
  useEffect(() => {
    // Resume interrupted saves on return/reconnection, but never replay conflicts or
    // validation failures automatically. Revision checks still guard every write.
    if (guest && !claimed) return;
    const resume = () => {
      if (document.visibilityState === "visible" && navigator.onLine && retryable.current && !pending.current && fingerprint(latest.current) !== saved.current) void saveNow();
    };
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { window.removeEventListener("online", resume); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
  }, [guest, saveNow, claimed]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (fingerprint(latest.current) !== saved.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return {
    status:
      status === "saved" && fingerprint(form) !== savedFingerprint
        ? ("unsaved" as const)
        : status,
    error,
    authRequired,
    claimed,
    storageWarning,
    backedUp: backupFingerprint === fingerprint(form),
    saveNow,
    recovery,
    dismissRecovery: () => setRecoveryDismissed(true),
  };
}
