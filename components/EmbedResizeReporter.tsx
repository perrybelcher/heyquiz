"use client";

import { useEffect, useRef, type RefObject } from "react";
import { EMBED_MAX_HEIGHT, EMBED_MIN_HEIGHT, EMBED_VERSION, embedOrigin, validEmbedChannel } from "@/lib/embed";

/** Observe the intrinsic player, never document.scrollHeight: the document's
 * viewport is the iframe height, which would prevent shorter steps shrinking. */
export default function EmbedResizeReporter({ target, navigationKey }: { target: RefObject<HTMLElement | null>; navigationKey: string }) {
  const previousNavigation = useRef(navigationKey);
  // Question/capture transitions recreate observers, not the iframe connection.
  // Keep the authenticated transport available during the next handshake roundtrip.
  const connection = useRef({ parentOrigin: "", channel: "", modal: false });
  useEffect(() => {
    const element = target.current;
    if (!element || window.parent === window) return;
    let { parentOrigin, channel, modal } = connection.current;
    let lastHeight = 0, scheduled = false, stopped = false;
    let reveal = previousNavigation.current !== navigationKey;
    previousNavigation.current = navigationKey;
    function measure() {
      if (stopped || !parentOrigin || !channel) return;
      const intrinsic = element!.getBoundingClientRect().height;
      if (!Number.isFinite(intrinsic) || intrinsic <= 0) return;
      const height = Math.min(EMBED_MAX_HEIGHT, Math.max(EMBED_MIN_HEIGHT, Math.ceil(intrinsic) + 2));
      if (height === lastHeight && !reveal) return;
      lastHeight = height;
      // A visitor-triggered step change may replace a long page while the host
      // is scrolled to its bottom. Send only the new heading's dimensions so
      // the host can reveal it if needed. Passive image/FAQ resizes never do.
      const heading = reveal ? element!.querySelector("main h1, main h2") : null;
      const bounds = heading?.getBoundingClientRect(), top = bounds ? Math.max(0, Math.floor(bounds.top - element!.getBoundingClientRect().top)) : 0;
      const bottom = bounds ? Math.ceil(top + bounds.height) : 0;
      const destination = heading && bottom > top && bottom <= height ? { revealTop: top, revealBottom: bottom } : {};
      reveal = false;
      window.parent.postMessage({ type: "pippi:embed:resize", version: EMBED_VERSION, channel, height, ...destination }, parentOrigin);
    }
    function schedule() {
      if (stopped || scheduled) return;
      scheduled = true;
      // Browsers may suspend animation frames in an offscreen cross-origin
      // iframe. Measurement must still complete to give that frame its height.
      // Coalesce DOM/resize notifications without depending on a paint frame.
      queueMicrotask(() => { scheduled = false; measure(); });
    }
    function initialize(event: MessageEvent) {
      const data = event.data;
      // The browser-authenticated source is the actual embedding parent.
      // Referrer is not an authority: reloads may replace it with our own URL.
      if (event.source !== window.parent || !embedOrigin(event.origin) || !data || typeof data !== "object" || Array.isArray(data) || data.type !== "pippi:embed:init" || data.version !== EMBED_VERSION || !validEmbedChannel(data.channel) || (data.transport !== undefined && data.transport !== "modal")) return;
      parentOrigin = event.origin;
      channel = data.channel;
      modal = data.transport === "modal";
      connection.current = { parentOrigin, channel, modal };
      lastHeight = 0;
      schedule();
    }
    function escape(event: KeyboardEvent) {
      // Cross-origin frame key events do not bubble into the host document.
      // Let player controls consume Escape before forwarding this optional signal.
      if (!modal || !parentOrigin || !channel || event.key !== "Escape" || event.defaultPrevented || event.isComposing || event.repeat) return;
      window.parent.postMessage({ type: "pippi:embed:escape", version: EMBED_VERSION, channel }, parentOrigin);
    }
    window.addEventListener("message", initialize);
    window.addEventListener("keydown", escape);
    window.addEventListener("resize", schedule);
    element.addEventListener("load", schedule, true);
    element.addEventListener("toggle", schedule, true);
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resize?.observe(element);
    const mutations = new MutationObserver(schedule);
    mutations.observe(element, { subtree: true, childList: true, characterData: true, attributes: true });
    void document.fonts?.ready.then(schedule);
    // Only this empty readiness signal uses '*'. The source/origin-checked
    // handshake establishes an explicit target for all later dimensions.
    window.parent.postMessage({ type: "pippi:embed:ready", version: EMBED_VERSION }, "*");
    if (parentOrigin && channel) schedule();
    return () => {
      stopped = true;
      resize?.disconnect(); mutations.disconnect();
      window.removeEventListener("message", initialize);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", schedule);
      element.removeEventListener("load", schedule, true);
      element.removeEventListener("toggle", schedule, true);
    };
  }, [target, navigationKey]);
  return null;
}
