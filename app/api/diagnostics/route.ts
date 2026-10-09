import { apiError, checkOrigin, HttpError } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { recordFailure } from '@/lib/diagnostics';

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    rateLimit(req, 'diagnostics', 10);
    // No client-supplied payload is accepted or logged. Reports are untrusted
    // signals, not proof of a server failure; the source identifies that fact.
    if (req.headers.get('content-type') !== 'application/pippi-error')
      throw new HttpError(400, 'Unsupported diagnostic report.');
    return Response.json({ reference: recordFailure('client') },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
