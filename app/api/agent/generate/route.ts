import { rateLimit } from "@/lib/rate-limit";
import { apiError, checkOrigin, requireUser } from "@/lib/auth";
import { generateQuizWithAgent } from "@/lib/agent-generator";
import { saveForm } from "@/lib/storage";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    rateLimit(req, "generate", 10);
    const user = await requireUser(),
      body = await req.json();
    const form = await generateQuizWithAgent({
      ...body,
      topic: body.topic || body.prompt,
    });
    const saved = body.save === false ? form : await saveForm(form, user.id);
    return Response.json({
      success: true,
      form: saved,
      editorUrl: `/editor/${saved.id}`,
    });
  } catch (e) {
    return apiError(e);
  }
}
