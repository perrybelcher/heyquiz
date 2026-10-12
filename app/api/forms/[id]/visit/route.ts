import { apiError, checkOrigin, HttpError } from "@/lib/auth";
import { readRecord } from "@/lib/records";
import { rateLimit } from "@/lib/rate-limit";
import { resolveExperiment } from "@/lib/experiments";
import { recordLandingVisit } from "@/lib/landing-visits";
import type { FormSchemaType } from "@/lib/schema";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(req);
    rateLimit(req, "landing-visit", 90);
    if (Number(req.headers.get("content-length")) > 4096) throw new HttpError(413, "Landing view request is too large.");
    const { id } = await params, body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || body.preview === true) throw new HttpError(400, "Only public landing views are measured.");
    const experiment = body.experimentToken ? await resolveExperiment(body.experimentToken) : undefined;
    if (experiment && experiment.form.id !== id) throw new HttpError(400, "Invalid experiment landing.");
    const published = await readRecord<FormSchemaType>("published", id);
    if (!published || experiment && published.owner_id !== experiment.row.owner_id) throw new HttpError(404, "This quiz is not published.");
    const link = await recordLandingVisit(id, published.owner_id, body.viewKey, body.embed === true, experiment?.assignment);
    return Response.json(link, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
