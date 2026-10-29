import { z } from "zod";
import { apiError, checkOrigin, requireUser } from "@/lib/auth";
import { readJsonRequest } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { interfaceEvents } from "@/lib/interface-telemetry";

const EventInput = z.object({ event: z.enum(interfaceEvents), version: z.enum(["v1", "v2"]) }).strict();

/** No account, quiz, contact, URL, submitted content or error text is logged. */
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    rateLimit(req, "interface-events", 120);
    await requireUser();
    const value = EventInput.parse(await readJsonRequest(req));
    console.info(JSON.stringify({ event: "pippi.interface", name: value.event, version: value.version, count: 1, timestamp: new Date().toISOString() }));
    return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
