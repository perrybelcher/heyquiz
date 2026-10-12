import { HttpError } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { PdfRenderError } from "@/lib/result-pdf-errors";
import { privateResultPdf, ResultPdfAccessError } from "@/lib/result-pdf-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const privacyHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
};
function failure(status: number, error: string, code: string, retryAfter?: string) {
  return Response.json({ error, code }, {
    status,
    headers: { ...privacyHeaders, ...(retryAfter ? { "Retry-After": retryAfter } : {}) },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    rateLimit(request, "private-result-pdf", 12);
    const { token } = await params;
    const pdf = await privateResultPdf(token, request.signal);
    return new Response(new Uint8Array(pdf), {
      headers: {
        ...privacyHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="pippi-result.pdf"',
        "Content-Length": String(pdf.byteLength),
      },
    });
  } catch (error) {
    // Do not use generic error logging: route paths contain bearer capabilities.
    if (error instanceof ResultPdfAccessError && error.reason === "unavailable") {
      return failure(404, "This saved result is unavailable.", "result_unavailable");
    }
    if (error instanceof HttpError && error.status === 429) {
      return failure(429, "Please wait a minute before downloading again. You can still use Print / Save as PDF.", "rate_limited", "60");
    }
    if (error instanceof PdfRenderError && ["unsupported_text", "report_too_large", "invalid_report"].includes(error.code)) {
      return failure(422, "This report cannot use the native PDF format. Please use Print / Save as PDF on the saved result page.", "browser_print_required");
    }
    return failure(503, "The PDF could not be prepared right now. Try again shortly or use Print / Save as PDF.", "pdf_unavailable", "5");
  }
}
