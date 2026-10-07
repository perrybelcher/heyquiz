import { createHash, timingSafeEqual } from "node:crypto";
import { readRecord } from "../records";
interface SchedulerConfig {
  enabled: boolean;
  tokenHash: string;
  cadence: string;
}
export async function schedulerSettings() {
  const row = await readRecord<SchedulerConfig>(
    "meta",
    "integration-worker-auth",
  );
  if (
    row?.owner_id === "system" &&
    row.payload.enabled &&
    /^[a-f0-9]{64}$/.test(row.payload.tokenHash)
  )
    return row.payload;
  return null;
}
export async function schedulerStatus() {
  const database = await schedulerSettings();
  return {
    configured: Boolean(
      database || (process.env.CRON_SECRET?.length || 0) >= 32,
    ),
    cadence:
      database?.cadence ||
      ((process.env.CRON_SECRET?.length || 0) >= 32 ? "daily" : "none"),
  };
}
export async function authorizeScheduler(header: string | null) {
  const match = /^Bearer ([^\s]{32,512})$/.exec(header || "");
  if (!match) return false;
  const digest = createHash("sha256").update(match[1]).digest();
  const env = process.env.CRON_SECRET;
  if (
    env &&
    env.length >= 32 &&
    timingSafeEqual(digest, createHash("sha256").update(env).digest())
  )
    return true;
  const db = await schedulerSettings();
  return Boolean(
    db && timingSafeEqual(digest, Buffer.from(db.tokenHash, "hex")),
  );
}
