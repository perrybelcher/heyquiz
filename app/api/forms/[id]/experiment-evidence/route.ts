import { apiError, checkOrigin, HttpError, requireUser } from "@/lib/auth";
import { prepareExperimentEvidence } from "@/lib/experiment-evidence-server";
import { EXPERIMENT_EVIDENCE_HEADER, EXPERIMENT_EVIDENCE_REQUEST_LIMIT } from "@/lib/experiment-evidence";
import { ExperimentRequestError, readExperimentBody } from "@/lib/experiment-plan";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "private, no-store" };
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    try {
      checkOrigin(req);
      const origin = req.headers.get("origin");
      // Next can normalize internal hostnames; checkOrigin uses the actual Host.
      if (origin && (new URL(origin).origin !== origin || new URL(origin).protocol !== new URL(req.url).protocol)) throw Error();
    } catch { throw new HttpError(403, "This request came from another site."); }
    if ([...new URL(req.url).searchParams.keys()].length) throw new HttpError(400, "Send evidence selectors in the request body only.");
    const user = await requireUser(), { id } = await params;
    if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new HttpError(400, "Send evidence selectors as JSON.");
    const declared = req.headers.get("content-length");
    if (declared && !/^\d+$/.test(declared)) throw new HttpError(400, "Send a valid evidence request.");
    const selected = await prepareExperimentEvidence(id, user.id, await readExperimentBody(req, EXPERIMENT_EVIDENCE_REQUEST_LIMIT));
    // The short-lived proof is deliberately outside ordinary JSON/page DTOs.
    return Response.json({ evidence: selected.evidence }, { headers: { ...privateHeaders, [EXPERIMENT_EVIDENCE_HEADER]: selected.proof } });
  } catch (error) {
    const response = apiError(error instanceof ExperimentRequestError ? new HttpError(error.status, error.message) : error);
    response.headers.set("Cache-Control", privateHeaders["Cache-Control"]);
    return response;
  }
}
