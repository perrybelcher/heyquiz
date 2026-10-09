/** Structured, privacy-minimal events in the hosting provider's server logs.
 * Never pass request bodies, cookies, answers, emails, raw URLs or error messages.
 * A reference can be given to support without exposing the failed request.
 */
export function recordFailure(source: 'api' | 'server' | 'client', status = 500) {
  const reference = crypto.randomUUID();
  console.error(JSON.stringify({event: 'pippi.failure', reference, source, status,
    timestamp: new Date().toISOString()}));
  return reference;
}
