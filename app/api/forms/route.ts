import { outcomeCreationEnabled } from "@/lib/outcome-availability";
import { HttpError } from "@/lib/errors";
import { readJsonRequest } from "@/lib/errors";
import { getAllForms, saveForm } from "@/lib/storage";
import { FormSchema } from "@/lib/schema";
import { apiError, checkOrigin, requireUser } from "@/lib/auth";
export async function GET() {
  try {
    const u = await requireUser();
    return Response.json(await getAllForms(u.id));
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const u = await requireUser(),
      body = FormSchema.parse(await readJsonRequest(req));
    if (!outcomeCreationEnabled && body.quizType && ["personality", "product_finder", "diagnostic", "qualification"].includes(body.quizType)) throw new HttpError(503,"New outcome quiz creation is temporarily unavailable. Existing quizzes remain available.");
    return Response.json(await saveForm({ ...body, revision: 0 }, u.id), {
      status: 201,
    });
  } catch (e) {
    return apiError(e);
  }
}
