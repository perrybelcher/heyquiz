import { apiError, checkOrigin, HttpError, requireUser } from "@/lib/auth";
import { createContactSegment, deleteContactSegment, listContactSegments, updateContactSegment } from "@/lib/contact-segments";
import { CONTACT_SEGMENT_REQUEST_BYTES } from "@/lib/contact-segment-schema";

type Context = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "private, no-store" };
function validateRequest(request: Request) {
  try {
    checkOrigin(request);
    const origin = request.headers.get("origin");
    // Next can normalize the internal URL hostname. checkOrigin above uses the
    // actual Host header; compare only the scheme here, never forwarded hosts.
    if (origin && (new URL(origin).origin !== origin || new URL(origin).protocol !== new URL(request.url).protocol)) throw new Error();
  } catch { throw new HttpError(403, "This request came from another site."); }
  if ([...new URL(request.url).searchParams.keys()].length) throw new HttpError(400, "Saved filters do not accept query parameters.");
}
async function readBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new HttpError(400, "Send the saved filter request as JSON.");
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > CONTACT_SEGMENT_REQUEST_BYTES)) throw new HttpError(413, "The saved filter request exceeds 16 KiB.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Send a valid saved filter request.");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > CONTACT_SEGMENT_REQUEST_BYTES) { await reader.cancel(); throw new HttpError(413, "The saved filter request exceeds 16 KiB."); }
      chunks.push(chunk.value);
    }
    const body = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Send a valid JSON saved filter request.");
  } finally { reader.releaseLock(); }
}
async function handle(request: Request, context: Context, operation: "list" | "create" | "update" | "delete") {
  try {
    validateRequest(request);
    const user = await requireUser(), { id } = await context.params;
    const result = operation === "list" ? await listContactSegments(id, user.id) :
      await ({ create: createContactSegment, update: updateContactSegment, delete: deleteContactSegment }[operation])(id, user.id, await readBody(request));
    return Response.json(result, { status: operation === "create" ? 201 : 200, headers });
  } catch (error) {
    const response = apiError(error);
    response.headers.set("Cache-Control", headers["Cache-Control"]);
    return response;
  }
}
export async function GET(request: Request, context: Context) { return handle(request, context, "list"); }
export async function POST(request: Request, context: Context) { return handle(request, context, "create"); }
export async function PATCH(request: Request, context: Context) { return handle(request, context, "update"); }
export async function DELETE(request: Request, context: Context) { return handle(request, context, "delete"); }
