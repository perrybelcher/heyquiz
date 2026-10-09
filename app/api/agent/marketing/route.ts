import { apiError, checkOrigin, requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { generateMarketingQuiz } from "@/lib/marketing-agent";

export const maxDuration = 90;
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    await requireUser();
    rateLimit(req, "marketing-generate", 5);
    // Generation is a preview. The creator reviews the result before saving it.
    return Response.json(await generateMarketingQuiz(await req.json()));
  } catch (e) { return apiError(e); }
}
