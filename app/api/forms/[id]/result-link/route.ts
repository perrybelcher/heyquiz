import { resultEmailAvailable } from "@/lib/result-email-config";
import { apiError, checkOrigin } from "@/lib/auth";
import { getAttempt } from "@/lib/attempts";
import { rateLimit } from "@/lib/rate-limit";
import { issueResultReport } from "@/lib/result-reports";
export async function POST(req: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        checkOrigin(req);
        rateLimit(req, "result-link", 30);
        const body = await req.json();
        const attempt = await getAttempt(body.token, (await params).id);
        return Response.json({ ...await issueResultReport(attempt), resultEmail: resultEmailAvailable() ? "synthetic" : null }, { headers: { "Cache-Control": "private, no-store" } });
    }
    catch (error) {
        return apiError(error);
    }
}
