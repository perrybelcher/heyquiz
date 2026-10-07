import { ownedForm, publishForm } from "@/lib/storage";
import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(req);
    const u = await requireUser(),
      { id } = await params,
      form = await ownedForm(id, u.id);
    if (!form) throw new HttpError(404, "Quiz not found.");
    if (
      form.questions.some((q) => q.type === "captcha") &&
      (!process.env.TURNSTILE_SITE_KEY || !process.env.TURNSTILE_SECRET_KEY)
    )
      throw new HttpError(
        422,
        "Connect Cloudflare Turnstile before publishing a security challenge.",
      );
    await publishForm(form, u.id);
    return Response.json({ success: true, url: `/play/${id}` });
  } catch (e) {
    return apiError(e);
  }
}
