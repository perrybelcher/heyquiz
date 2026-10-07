import { ownedForm, saveForm, deleteForm } from "@/lib/storage";
import { FormSchema } from "@/lib/schema";
import { apiError, checkOrigin, requireUser, HttpError } from "@/lib/auth";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) {
  try {
    const u = await requireUser(),
      { id } = await params,
      f = await ownedForm(id, u.id);
    if (!f) throw new HttpError(404, "Quiz not found.");
    return Response.json(f);
  } catch (e) {
    return apiError(e);
  }
}
export async function PUT(req: Request, { params }: Context) {
  try {
    checkOrigin(req);
    const u = await requireUser(),
      { id } = await params;
    if (!(await ownedForm(id, u.id)))
      throw new HttpError(404, "Quiz not found.");
    const body = FormSchema.parse({ ...(await req.json()), id });
    return Response.json(await saveForm(body, u.id));
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(req: Request, { params }: Context) {
  try {
    checkOrigin(req);
    const u = await requireUser(),
      { id } = await params;
    if (!(await deleteForm(id, u.id)))
      throw new HttpError(404, "Quiz not found.");
    return Response.json({ success: true });
  } catch (e) {
    return apiError(e);
  }
}
