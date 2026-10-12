import { apiError, checkOrigin, requireUser } from "@/lib/auth";
import { cleanExpiredResultCopies } from "@/lib/report-management";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(req);
    const user = await requireUser(), { id } = await params;
    return Response.json(await cleanExpiredResultCopies(id, user.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
