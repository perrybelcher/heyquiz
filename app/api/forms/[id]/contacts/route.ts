import { apiError, requireUser, HttpError } from "@/lib/auth";
import { ownedForm, getSubmissionsByFormId } from "@/lib/storage";
export async function GET(_: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        const user = await requireUser(), { id } = await params;
        if (!(await ownedForm(id, user.id)))
            throw new HttpError(404, "Quiz not found.");
        const rows = (await getSubmissionsByFormId(id, user.id)).filter(s => s.contact);
        return Response.json({ contacts: rows }, { headers: { "Cache-Control": "private, no-store" } });
    }
    catch (error) {
        return apiError(error);
    }
}
