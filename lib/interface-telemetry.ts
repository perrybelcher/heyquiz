import type { InterfaceVersion } from "./interface-contract";

/** First-party operational events only. Never pass identifiers, content or raw errors. */
export const interfaceEvents = ["editor_opened", "save_confirmed", "save_failed", "publish_confirmed", "publish_failed", "switch_to_classic"] as const;
export type InterfaceEvent = typeof interfaceEvents[number];

/** Best effort: telemetry must never block editing, saving, publishing or recovery. */
export function reportInterfaceEvent(event: InterfaceEvent, version: InterfaceVersion): void {
  try {
    if (typeof window === "undefined" || !interfaceEvents.includes(event) || (version !== "v1" && version !== "v2")) return;
    void fetch("/api/interface-events", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, version }),
      referrerPolicy: "no-referrer",
      keepalive: true,
    }).catch(() => { /* No retries: an observation failure must not affect product actions. */ });
  } catch { /* Includes unavailable fetch or browser shutdown. */ }
}
