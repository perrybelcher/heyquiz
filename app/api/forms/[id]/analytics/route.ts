import { ownedForm, getSubmissionsByFormId } from "@/lib/storage";
import { apiError, requireUser, HttpError } from "@/lib/auth";
import { listRecords } from "@/lib/records";
import type { Attempt } from "@/lib/attempts";
import { summarizeAnalytics, type AnalyticsRange } from "@/lib/analytics";
export async function GET(req: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        const user = await requireUser(), { id } = await params, form = await ownedForm(id, user.id);
        if (!form)
            throw new HttpError(404, "Quiz not found.");
        const range = new URL(req.url).searchParams.get("range") || "30";
        if (!["7", "30", "90", "all"].includes(range))
            throw new HttpError(400, "Choose a supported date range.");
        const [attempts, submissions] = await Promise.all([listRecords<Attempt>("attempts", user.id), getSubmissionsByFormId(id, user.id)]);
        return Response.json(summarizeAnalytics(form, attempts, submissions, range as AnalyticsRange), { headers: { "Cache-Control": "private, no-store" } });
    }
    catch (error) {
        return apiError(error);
    }
}
