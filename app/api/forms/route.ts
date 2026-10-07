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
      body = FormSchema.parse(await req.json());
    return Response.json(await saveForm({ ...body, revision: 0 }, u.id), {
      status: 201,
    });
  } catch (e) {
    return apiError(e);
  }
}
