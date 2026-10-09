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
  JSON.stringify({ ...form, revision: undefined, updatedAt: undefined });
export function useAutosave(form: FormSchemaType, guest = false) {
  const [status, setStatus] = useState<
      "saved" | "unsaved" | "saving" | "error"
    >("saved"),
    [storageWarning, setStorageWarning] = useState(false),
    [error, setError] = useState(""),
    [authRequired, setAuthRequired] = useState(false),
    [recoveryDismissed, setRecoveryDismissed] = useState(false),
    [savedFingerprint, setSavedFingerprint] = useState(fingerprint(form));
  const latest = useRef(form),
    revision = useRef(form.revision || 0),
    saved = useRef(fingerprint(form)),
    pending = useRef<Promise<boolean> | null>(null);
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
      // Surface failure to synchronize the browser backup.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      } catch { setStorageWarning(true); }
    }
  }, [form, key, guest]);
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (pending.current) {
      await pending.current;
      if (fingerprint(latest.current) === saved.current) return true;
    }
    const task = (async () => {
      setError("");
      // Guest drafts stay on this device until an authenticated account claims them.
      if (guest) {
        setStatus("saving");
        try {
          const res = await fetch("/api/forms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...latest.current, revision: 0 }),
          });
          const data = await res.json();
          if (!res.ok) {
            setAuthRequired(res.status === 401);
            throw new Error(data.error || "Could not save your quiz.");
          }
          saved.current = fingerprint(latest.current);
          try {
            localStorage.removeItem("pippi-guest-draft");
            localStorage.removeItem(key);
          } catch {}
          window.location.assign(`/editor/${data.id}`);
          // Navigation owns the next step; do not publish or navigate again.
          return false;
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save your quiz.");
          setStatus("error");
          return false;
        }
      }
      while (fingerprint(latest.current) !== saved.current) {
        const snapshot = latest.current;
        setStatus("saving");
        try {
          const res = await fetch(`/api/forms/${snapshot.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...snapshot, revision: revision.current }),
          });
          const data = await res.json();
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
    if (guest) return;
    if (fingerprint(form) === saved.current) return;
    const timer = setTimeout(() => void saveNow(), 600);
    return () => clearTimeout(timer);
  }, [form, saveNow, guest]);
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
    storageWarning,
    saveNow,
    recovery,
    dismissRecovery: () => setRecoveryDismissed(true),
  };
}
