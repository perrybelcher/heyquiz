"use client";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { registerDraftSave } from "@/lib/session-client";
import { useEffect } from "react";
/** Pending panel text stays outside the saved quiz until Apply. Each editor has
 * its own persistent copy, so another tab cannot erase unapplied input. */
export function usePanelDraft<T>(legacyKey: string, accountKey: string | undefined, parse: (raw: string | null) => T | null, serialize: (value: T) => string) {
  const prefix = accountKey ? `pippi-panel:v2:${encodeURIComponent(accountKey)}:${legacyKey}:` : legacyKey;
  const cached = useRef<string | undefined>(undefined), instance = useRef<string | null>(null), currentRaw = useRef<string | null>(null);
  const read = useCallback(() => {
    if (cached.current !== undefined) return cached.current;
    const texts: string[] = [];
    const add = (raw: string | null) => { if (raw && parse(raw) && !texts.includes(raw)) texts.push(raw); };
    try { add(sessionStorage.getItem(prefix)); } catch {}
    if (accountKey) {
      try { for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key?.startsWith(prefix)) add(localStorage.getItem(key)); } } catch {}
      // Owned server context permits importing this tab's legacy copy. It is
      // retained until the exact copy is applied/discarded in this editor.
      try { add(sessionStorage.getItem(legacyKey)); } catch {}
    }
    cached.current = JSON.stringify(texts); return cached.current;
  }, [prefix, accountKey, legacyKey, parse]);
  const raw = useSyncExternalStore(() => () => {}, read, () => "[]");
  const choices = useMemo(() => (JSON.parse(raw) as string[]).map(parse).filter((value): value is T => value !== null), [raw, parse]);
  const [override, setOverride] = useState<T | null | undefined>(undefined), [storageWarning, setStorageWarning] = useState(false);
  const draft = override === undefined ? choices.length === 1 ? choices[0] : null : override;
  function clearHandled(store: Storage, previous: string | null) {
    if (!previous) return;
    const parsed = parse(previous); if (!parsed) return;
    const handled = serialize(parsed), keys: string[] = [legacyKey, prefix];
    for (let i = 0; i < store.length; i++) { const key = store.key(i); if (key?.startsWith(prefix)) keys.push(key); }
    for (const key of keys) { const value = parse(store.getItem(key)); if (value && serialize(value) === handled) store.removeItem(key); }
  }
  function update(next: T | null, reason: "edit" | "recover" | "apply" | "discard" = next === null ? "discard" : "edit") {
    if (reason !== "recover") setOverride(next);
    if (!instance.current) instance.current = crypto.randomUUID();
    let tabOk = false, persistentOk = !accountKey;
    const text = next === null ? null : serialize(next), previous = currentRaw.current || (draft ? serialize(draft) : null);
    if (text && !parse(text)) { setStorageWarning(true); return; }
    try {
      if (text) { sessionStorage.setItem(prefix, text); tabOk = sessionStorage.getItem(prefix) === text; }
      else { if (reason !== "apply") clearHandled(sessionStorage, previous); tabOk = true; }
    } catch {}
    if (accountKey) {
      try {
        if (text) { localStorage.setItem(prefix + instance.current, text); persistentOk = localStorage.getItem(prefix + instance.current) === text; }
        else { if (reason !== "apply") clearHandled(localStorage, previous); persistentOk = true; }
      } catch {}
    }
    currentRaw.current = text;
    setStorageWarning(!tabOk || !persistentOk);
  }
  useEffect(() => {
    if (!draft) return;
    // A recovered copy must become persistent for this instance as well.
    if (!currentRaw.current) update(draft, "recover");
    return registerDraftSave(async () => ({ dirty: true, saved: false, persistent: !!accountKey && !storageWarning }));
    // Draft content is intentionally checkpointed by update, not an effect loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!draft, accountKey, storageWarning]);
  return { draft, update, restored: override === undefined && choices.length === 1, storageWarning, alternatives: override === undefined && choices.length > 1 ? choices : [] };
}
