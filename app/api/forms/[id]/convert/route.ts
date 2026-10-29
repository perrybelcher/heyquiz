import { outcomeCreationEnabled } from "@/lib/outcome-availability";
import { HttpError } from "@/lib/errors";
import { apiError, checkOrigin, requireUser } from "@/lib/auth";
import { readJsonRequest } from "@/lib/errors";
import { convertOwnedQuiz } from "@/lib/quiz-conversion-service";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, {params}: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    if (!outcomeCreationEnabled) throw new HttpError(503,"Quiz conversion is temporarily unavailable. Existing quizzes remain available.");
    const {id} = await params;
    return Response.json(await convertOwnedQuiz(user.id,id,await readJsonRequest(request)));
  } catch(error) { return apiError(error); }
}
