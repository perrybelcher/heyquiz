"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/** Only explicit Add actions request focus; ordinary edits and autosaves never do. */
export function useAddedItemFeedback() {
  const rootRef = useRef<HTMLElement>(null);
  const pending = useRef<string | null>(null);
  const [notice, setNotice] = useState({ sequence: 0, text: "" });
  function added(selector: string, kind: "Rule" | "Condition" = "Rule") {
    pending.current = selector;
    setNotice(previous => ({ sequence: previous.sequence + 1, text: `${kind} added` }));
  }
  useLayoutEffect(() => {
    if (!pending.current) return;
    const target = rootRef.current?.querySelector<HTMLElement>(pending.current);
    pending.current = null;
    if (!target) return;
    for (let ancestor: HTMLElement | null = target; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      if (ancestor === rootRef.current) break;
    }
    const control = target.querySelector<HTMLElement>("select:not(:disabled), input:not(:disabled), textarea:not(:disabled)");
    const focusTarget = control || target;
    if (!control) target.tabIndex = -1;
    focusTarget.style.scrollMarginBlock = "6rem";
    focusTarget.focus({ preventScroll: true });
    // Immediate positioning keeps the new item visible before the next action
    // and avoids motion for people who prefer reduced animation.
    focusTarget.scrollIntoView({ block: "center", behavior: "instant" });
  });
  const feedback = <span className="sr-only" role="status" aria-live="polite" aria-atomic="true"><span key={notice.sequence}>{notice.text}</span></span>;
  const attachRoot = useCallback((element: HTMLElement | null) => { rootRef.current = element; }, []);
  return { attachRoot, added, feedback };
}
