/** Browser projection of owner delivery history. Never display unvalidated provider data. */
export type ResultDeliveryRow = {
  responseId: string;
  requestedAt: number;
  state: string;
  message: string;
  attempts: number;
  nextAttemptAt: number | null;
};
export type ResultDeliveryListing = { mode: "resend"; total: number; jobs: ResultDeliveryRow[] };
const states = new Set(["queued", "sending", "accepted", "delivered", "delivery_delayed", "bounced", "complained", "unknown", "failed", "cancelled"]);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const timestamp = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
const fail = (): never => { throw Error("Delivery status could not be read. Refresh and try again."); };

export function parseResultDeliveryListing(value: unknown): ResultDeliveryListing {
  if (!record(value) || value.mode !== "resend" || typeof value.total !== "number" || !Number.isSafeInteger(value.total) || value.total < 0 || !Array.isArray(value.jobs) || value.jobs.length > 100 || value.total < value.jobs.length) return fail();
  const ids = new Set<string>();
  const jobs = value.jobs.map((job): ResultDeliveryRow => {
    if (!record(job) || typeof job.responseId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(job.responseId) || ids.has(job.responseId) || !timestamp(job.requestedAt)
      || typeof job.state !== "string" || !states.has(job.state) || typeof job.message !== "string" || !job.message.trim() || job.message.length > 1000
      || typeof job.attempts !== "number" || !Number.isSafeInteger(job.attempts) || job.attempts < 0 || job.attempts > 1000 || !(job.nextAttemptAt === null || timestamp(job.nextAttemptAt))) return fail();
    ids.add(job.responseId);
    return { responseId: job.responseId, requestedAt: job.requestedAt, state: job.state, message: job.message, attempts: job.attempts, nextAttemptAt: job.nextAttemptAt };
  });
  return { mode: "resend", total: value.total, jobs };
}
