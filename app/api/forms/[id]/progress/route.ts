import { apiError, checkOrigin, HttpError } from "@/lib/auth";
import { getAttempt } from "@/lib/attempts";
import { writeRecord, ConflictError } from "@/lib/records";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(req: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        checkOrigin(req);
        rateLimit(req, "progress", 240);
        const { id } = await params, b = await req.json();
        const event = b.event || "question_view";
        if (!["question_view", "result_view", "offer_click"].includes(event))
            throw new HttpError(400, "Unknown analytics event.");
        for (let retry = 0; retry < 3; retry++) {
            const r = await getAttempt(b.token, id), a = r.payload, now = Date.now();
            if (event === "question_view" && (typeof b.questionId !== "string" || !a.form.questions.some(q => q.id === b.questionId && q.type !== "hidden")))
                throw new HttpError(400, "Unknown question.");
            if (event !== "question_view" && !a.completed)
                throw new HttpError(409, "Complete the quiz first.");
            if (event === "question_view" && a.completed)
                return Response.json({ ok: true });
            if (event === "offer_click") {
                const target = a.result?.marketing ? a.result.marketing.ctaUrl : a.result?.matchedTier?.ctaUrl || a.form.endingPage?.redirectUrl;
                if (!target || !/^https?:\/\//i.test(target))
                    throw new HttpError(400, "No result offer is available.");
            }
            const update = event === "question_view" ? { reached: [...new Set([...a.reached, b.questionId])], lastQuestionId: b.questionId, lastSeenAt: now } : event === "result_view" ? { resultViewedAt: a.resultViewedAt || now } : { resultViewedAt: a.resultViewedAt || now, offerClickedAt: a.offerClickedAt || now };
            try {
                await writeRecord("attempts", r.id, r.owner_id, { ...a, ...update }, r.version);
                return Response.json({ ok: true });
            }
            catch (e) {
                if (!(e instanceof ConflictError) || retry === 2)
                    throw e;
            }
        }
    }
    catch (e) {
        return apiError(e);
    }
}
