import { after } from "next/server";
import { dispatch } from "./service";
// The saved submission is the durable source of truth. The scheduled reconciler
// can recreate missing delivery jobs if this callback is interrupted.
export function scheduleDeliveries(owner: string, formId: string) {
  after(async () => {
    try {
      await dispatch(owner, formId);
    } catch {
      console.error("Lead saved; integration delivery requires a retry.");
    }
  });
}
