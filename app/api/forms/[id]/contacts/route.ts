import { apiError, requireUser, HttpError } from "@/lib/auth";
import { ownedForm } from "@/lib/storage";
import { loadContactDirectory } from "@/lib/contact-context-store";
import { parseContactAnswerQuery, ContactAnswerQueryError } from "@/lib/contact-answer-cohort";
export async function GET(request: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        const user = await requireUser(), { id } = await params;
        if (!(await ownedForm(id, user.id)))
            throw new HttpError(404, "Quiz not found.");
        const answerPair = parseContactAnswerQuery(new URL(request.url).searchParams);
        try {
            return Response.json(await loadContactDirectory(id, user.id, Date.now(), answerPair), { headers: { "Cache-Control": "private, no-store" } });
        } catch (error) {
            if (error instanceof ContactAnswerQueryError) throw error;
            throw new HttpError(503, "Contacts and their recorded history could not be loaded. Try refreshing.");
        }
    }
    catch (error) {
        return apiError(error instanceof ContactAnswerQueryError ? new HttpError(400, error.message) : error);
    }
}
