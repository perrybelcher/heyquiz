import { ownedForm, getSubmissionsByFormId } from "@/lib/storage";
import { apiError, requireUser, HttpError } from "@/lib/auth";
import { listRecords } from "@/lib/records";
import type { LandingVisit } from "@/lib/landing-visit";
import type { Attempt } from "@/lib/attempts";
import { summarizeAnalytics } from "@/lib/analytics";
import { parseAnalyticsQuery, AnalyticsQueryError } from "@/lib/analytics-filters";
export async function GET(req: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        const user = await requireUser(), { id } = await params, form = await ownedForm(id, user.id);
        if (!form)
            throw new HttpError(404, "Quiz not found.");
        const { range, filters } = parseAnalyticsQuery(new URL(req.url).searchParams);
        const [attempts, submissions, visits] = await Promise.all([listRecords<Attempt>("attempts", user.id), getSubmissionsByFormId(id, user.id), listRecords<LandingVisit>("landing_visits", user.id)]);
        return Response.json(summarizeAnalytics(form, attempts, submissions, range, Date.now(), visits, filters), { headers: { "Cache-Control": "private, no-store" } });
    }
    catch (error) {
        return apiError(error instanceof AnalyticsQueryError ? new HttpError(400, error.message) : error);
    }
}
