# Native PDF download access — batch 6

This document covers the download route and access/concurrency service. The model, fonts, native PDF layout, browser download UI, packaging and rendered-page inspection are separate batch-6 lanes; the tests below do not establish their quality or production deployment readiness.

## Access and response contract

`GET /api/result/[token]/pdf` uses the same private saved-result capability as the web report. It runs in the Next.js Node runtime, is explicitly dynamic, and has a 30-second route duration configuration. It does not create, renew or cache reports or tokens, alter responses, record marketing events, send email, or call a PDF provider.

The route calls the existing `readResultReport(token)` before rendering. This preserves the original purpose/signature/expiry checks and verifies retained report, response and quiz ownership plus individual revocation and quiz retirement. Invalid, oversized, tampered, wrong-purpose, expired, missing, deleted and revoked links return the same generic 404. Current draft edits cannot change the frozen report supplied to the renderer. A cleaned report is not recreated by downloading.

After a successful render, the service reads the **same original token again**, immediately before returning bytes. Revocation, response/quiz deletion, expiry or same-ID quiz retirement/recreation during rendering withholds the PDF. A revocation after the final successful access check cannot recall bytes already delivered; downloaded files remain with their recipients.

Successful responses use:

- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="pippi-result.pdf"`
- A byte-derived `Content-Length`
- `Cache-Control: private, no-store`
- `X-Content-Type-Options: nosniff`
- `X-Robots-Tag: noindex, nofollow, noarchive`
- `Referrer-Policy: no-referrer`

Every handled error has the same privacy headers. No wildcard CORS is enabled. The filename and header values never use report text or personal data. Error bodies use fixed content-free messages/codes; neither internal error messages nor tokens, paths, report text or PDF bytes are logged by this route. Hosting access-log URL redaction remains a separate deployment responsibility.

Shared `PdfRenderError` codes `unsupported_text`, `report_too_large` and `invalid_report` become 422 with code `browser_print_required` and the existing **Print / Save as PDF** fallback. Busy, aborted, timed-out, unavailable-font, storage and unexpected renderer failures return safe 503/`pdf_unavailable`, with `Retry-After: 5`. The existing request limiter returns safe 429/`rate_limited`, with `Retry-After: 60`. No partial PDF is returned on failure.

## Bounded execution and recovery

The default service permits **two active rendering/access-recheck jobs per server instance**, with no waiting queue. It uses the existing hashed, per-process IP request limiter at **12 download requests per minute**; this is a backstop, not a distributed or bot-proof quota.

A 15-second service deadline covers the initial read, rendering and final read. Request disconnection or deadline abort is passed to the renderer through `AbortSignal`; the caller receives a safe failure. The native renderer is responsible for checking that signal during cooperative layout and closing its stream. A JavaScript timer alone cannot interrupt synchronous rendering.

Crucially, an aborted/timed-out job retains its concurrency slot until the underlying renderer/read work actually settles. Returning a timeout therefore cannot allow new jobs to oversubscribe still-running work. If an underlying dependency never settles, its slot stays occupied; once both are occupied, further work is refused until recovery or instance restart. Initial reads use the existing adapter, so a read already started may settle after the caller's deadline; the aborted service will not begin a late render.

`createResultPdfService` permits trusted dependency/deadline injection for isolated race tests. Request bodies/queries cannot change deadlines, limits, renderers or access rules.

## Files and test evidence

- `lib/result-pdf-service.ts`: access revalidation, two-job capacity, cooperative cancellation and deadline.
- `app/api/result/[token]/pdf/route.ts`: fixed PDF response and safe error/privacy contract.
- `tests/result-pdf-api.cjs`: direct route and service tests with the **real report access functions**, synthetic in-memory records and a deliberately mocked renderer. Outbound fetch is trapped; no files, cloud records, provider calls or emails are created.

`node tests/result-pdf-api.cjs`: **15 checks passed**:

1. Valid frozen report access, fixed filename/MIME/length/privacy headers and no contact/raw answers/token passed to the renderer.
2. Indistinguishable 404 for invalid, oversized, tampered, expired, wrong-purpose and missing capabilities; no renderer allocation.
3. Form, response and report owner isolation.
4. Frozen snapshot unaffected by current draft edits.
5. Individual revocation, response deletion, quiz deletion, expiry and same-ID retirement/recreation during rendering return no PDF bytes.
6. Downloads cannot recreate cleaned report records or issue new links.
7. Safe 422 browser-print fallback for unsupported text, size limits and malformed reports.
8. Safe 503 and recovered capacity after abort/missing-font/unexpected renderer failures.
9. Two-job concurrency, no queue and recovery as jobs finish.
10. Pre-aborted and disconnected requests propagate cancellation without leaking capacity.
11. A timed-out renderer keeps its occupied slot until actual settlement; no oversubscription.
12. A timed-out initial storage read cannot start a late render.
13. Failed final authorization never returns bytes and releases its slot.
14. Existing per-process rate limit stops the thirteenth request before rendering.
15. No network calls or sensitive application logs.

Focused ESLint for the route/service passed. Root's final compiled batch-6 build passed and served on local port 3163. The unit test uses dummy PDF bytes solely to test authorization/HTTP behavior; it is **not** PDF rendering evidence.

## Compiled browser verification

After the final build, `tests/browser-native-result-pdf.cjs` passed serially in **Firefox and WebKit** against the isolated compiled server. Each checked an actual native PDF download, exact filename/MIME/privacy headers, Unicode and numeric content, absence of private fields, keyboard activation, recovery from a simulated 503, unsupported-text print fallback, revocation and 390px mobile layout. The mobile success and fallback screenshots were inspected: controls and messages remain readable without horizontal overflow. Root separately owns the Chrome run and native PDF page/packaging inspection.

`tests/browser-result-reports.cjs` also passed unchanged after both native suites, preserving frozen-report authorization, purpose isolation, expiry, light/dark browser-print colors with backgrounds on/off, original text and score/bar geometry, mobile view and deletion revocation. Its `/tmp` PDF/screenshot artifacts were copied into the batch-6 evidence directory.

Evidence:

- `../pippi-overnight-2026-10-12/compiled-verification-batch-6/native-pdf-firefox/`
- `../pippi-overnight-2026-10-12/compiled-verification-batch-6/native-pdf-webkit/`
- `../pippi-overnight-2026-10-12/compiled-verification-batch-6/result-reports/`

All browser fixtures used the isolated local data directory with all five cloud configuration variables explicitly empty. They cleaned up their own synthetic quizzes. No application edits, production/cloud calls, emails or deployment were made during this verification.
