# Native PDF: frozen content model

Implemented 12 October 2026 in `lib/result-pdf-model.ts`, with shared content-free errors in `lib/result-pdf-errors.ts`. This is the pure content layer; it does not grant report access, generate a PDF, fetch assets or change stored records.

## Preserved behavior

- The model uses only the saved `ResultReport`. It never evaluates today's quiz, reads answers, recalculates scores or reselects conditional content.
- Legacy knowledge results retain earned/possible points and the stored percentage. Zero-point surveys omit the score panel. Product and segmentation results do not inherit the unrelated knowledge score.
- All three saved layouts retain the order in `MarketingResultCard`: stacked, score overview and action plan. Historical marketing reports without presentation use stacked order.
- Every category is included, including 0%, 100% and `null`. `null` remains “Not enough information”; answered/applicable/minimum coverage remains the saved value. Overview layouts intentionally show category summaries followed by their complete details.
- Resolved sections keep their stored order. FAQ answers are expanded. Testimonials retain text and attribution. Images/videos retain title, body and safe labeled web links, with a note that the media remains online. No remote media is fetched.
- Saved brand name and hide-branding preference survive. A saved logo becomes brand text, falling back to logo alt text or quiz title. Valid six-digit accent colors survive; malformed decorative colors use the document's burgundy fallback. This is not an exact copy of the web theme.

## Exported contract

`buildResultPdfModel(report: unknown)` returns metadata (`title`, `brandName`, `hideBranding`, `createdAt`, `layout`, `accent`) and ordered `blocks`. Block kinds are heading (levels 1–3), paragraph, label, score, link and rule. A score contains a number or `null`, with optional coverage. There is no HTML, script, arbitrary styling, asset payload or raw-object passthrough.

The renderer owns fonts, script/glyph preflight, line wrapping, pagination, page/byte output budgets and physical PDF generation. The route owns access control, expiry/revocation checks and download headers. `PdfRenderError(code, status, message)` is shared so these layers return generic useful failures without reflecting report content.

## Boundaries and failures

The function accepts `unknown` because persisted data can predate current TypeScript definitions. It validates visible text, enums, arrays, scores, counts and ISO completion dates, including calendar rollover. Unknown extra fields are ignored. It rejects malformed scalar types, C0/C1 control characters and lone UTF-16 surrogates. Other Unicode remains intact for the renderer's explicit supported-font/script check.

There is a 200 KiB UTF-8 budget for printable text, metadata and link text/destinations, plus a 2,000-block defensive limit. Input arrays are bounded to 20 categories/priorities, 12 sections and 1,000 reasons. Over-budget input returns `report_too_large` (422); malformed required content returns `invalid_report` (422). The function never truncates narrative or returns a partial document.

HTTP(S) links are parsed with `URL`. Non-web schemes, relative URLs, credentials, raw/encoded control characters, backslashes, oversized URLs and saved-result bearer paths are excluded. Unusable destinations become a labeled explanation while retaining surrounding section text. Safe destinations are ordinary PDF annotations; they do not invoke the web player's offer-click analytics. The model does not fetch even localhost or other HTTP destinations.

The allowlist excludes contact fields, raw answers, grading, form/submission/category/outcome/section IDs, conditions, expiry fields, source asset URLs and report-access URLs. Authors can still put personal information into their own visible prose; this is not a guarantee that arbitrary authored reports are anonymous. It also does not detect secrets deliberately embedded in ordinary author copy or unrelated destination parameters.

## Verification

`node tests/result-pdf-model.cjs`: **18 checks passed** using synthetic in-memory data:

1. Exact legacy graded output and no recomputation.
2. Zero-point survey without fabricated score.
3. Product/segmentation, matched/no-match wording without knowledge scores.
4. Stacked order and all six resolved section types.
5. Overview order, all details and denominators.
6. Action-plan CTA before supporting evidence.
7. Historical missing optional marketing presentation fields.
8. Null/zero/100 distinction and partial coverage.
9. Allowlist privacy, ignored internal fields and source URLs.
10. Frozen input immutability and detached output.
11. Saved brand/hide preference and fallback behavior.
12. Safe links and credential/control/capability rejection.
13. Unsafe-link explanation without losing surrounding content.
14. Invalid shapes/enums/scalars/scores/counts.
15. Valid timezone normalization and invalid calendar dates.
16. Unicode preservation and malformed text rejection.
17. Long text retention plus byte/count failure boundaries.
18. Twenty categories and twelve sections in every layout.

`eslint lib/result-pdf-model.ts lib/result-pdf-errors.ts`: **passed, no warnings/errors**. Parent runs the shared production build and integration suites. PDF rendering, pagination, visual/accessibility review, supported language coverage, access races, browser download behavior and compiled asset packaging are separate integration gates; these pure tests do not establish them.

No cloud APIs, real email, credentials, production records, deployments or shared server restarts were used for this work.
