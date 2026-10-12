import { ownedForm, publishForm, pauseFormPublication } from "@/lib/storage";
import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
import { publicationFingerprint, type PublicationReceipt } from "@/lib/publication";
const privateHeaders = { "Cache-Control": "private, no-store" };
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
    // publishForm writes this captured source plus publishedAt, which the
    // comparison excludes. Do not reread a potentially newer draft afterwards.
    const publication: PublicationReceipt = { version: 1, formId: id, fingerprint: publicationFingerprint(form) };
    return Response.json({ success: true, url: `/play/${id}`, publication }, { headers: privateHeaders });
  } catch (e) {
    const response = apiError(e);
    response.headers.set("Cache-Control", privateHeaders["Cache-Control"]);
    return response;
  }
}

/** Reversible publication pause; never delete the quiz or retire its result links. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(req);
    const user = await requireUser(), { id } = await params;
    if (!(await pauseFormPublication(id, user.id))) throw new HttpError(404, "Quiz not found.");
    return Response.json({ success: true, published: false }, { headers: privateHeaders });
  } catch (error) { const response = apiError(error); response.headers.set("Cache-Control", privateHeaders["Cache-Control"]); return response; }
}
