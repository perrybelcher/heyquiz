import { createHash } from "node:crypto";
import { HttpError } from "./auth";
const windows = new Map<string, { until: number; count: number }>();
// Per-process backstop. Production deployments should also apply an edge rate limit.
export function rateLimit(
  req: Request,
  scope: string,
  max: number,
  seconds = 60,
) {
  const now = Date.now(),
    ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const key = createHash("sha256").update(`${scope}:${ip}`).digest("hex");
  for (const [k, v] of windows) if (v.until < now) windows.delete(k);
  const value = windows.get(key) || { until: now + seconds * 1000, count: 0 };
  value.count++;
  windows.set(key, value);
  if (value.count > max)
    throw new HttpError(
      429,
      "Too many requests. Please wait a minute and try again.",
    );
}
