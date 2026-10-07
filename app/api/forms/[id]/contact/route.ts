import { apiError, checkOrigin, HttpError } from "@/lib/auth";
import { getAttempt } from "@/lib/attempts";
import { parseContact } from "@/lib/contacts";
import { readRecord, writeRecord } from "@/lib/records";
import type { QuizSubmissionResult } from "@/lib/schema";
export async function POST(req: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        checkOrigin(req);
        const { id } = await params, body = await req.json(), attempt = await getAttempt(body.token, id), a = attempt.payload;
        if (!a.completed || !a.form.capture?.enabled || a.form.capture.placement !== "after_results")
            throw new HttpError(409, "Complete the quiz before sharing contact details.");
        const contact = parseContact(a.form.capture, body.contact, a.form.revision);
        if (!contact)
            throw new HttpError(422, "Please enter your contact details.");
        if (a.preview)
            return Response.json({ success: true, preview: true });
        const row = await readRecord<QuizSubmissionResult>("submissions", attempt.id);
        if (!row || row.owner_id !== attempt.owner_id)
            throw new HttpError(404, "Response not found.");
        if (!row.payload.contact) {
            try {
                await writeRecord("submissions", row.id, row.owner_id, { ...row.payload, contact, contactCaptured: true }, row.version);
            }
            catch (error) {
                const saved = await readRecord<QuizSubmissionResult>("submissions", row.id);
                if (!saved?.payload.contact || saved.owner_id !== row.owner_id)
                    throw error;
            }
        }
        return Response.json({ success: true });
    }
    catch (error) {
        return apiError(error);
    }
}
