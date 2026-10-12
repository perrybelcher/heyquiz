# Native saved-result PDF renderer

Implemented 12 October 2026. This lane owns only `lib/result-pdf.ts`, `tests/result-pdf-renderer.cjs` and this log. The ordered frozen model/error class, authorized route/service/UI, packages/fonts/configuration and compiled deployment checks belong to the other batch-6 lanes.

## What changed

`renderResultPdf(report, { signal }?)` now produces a native PDFKit `Buffer` from the validated frozen model. It uses the pinned, bundled Noto Sans Regular/Bold fonts, A4 pages, consistent type sizes, dark text on white paper and a saved accent when its contrast is sufficient. Very light accents fall back to a dark red. Saved web background colors never make print text disappear.

- Preserves the model's three layout orders, all categories, exact numeric values, null/insufficient states, coverage, selected sections and ordinary CTA annotations. It never re-scores answers or reads the live quiz.
- Prints text as searchable glyphs, with logical structure for headings/paragraphs, decorative content marked as artifacts, and final page numbering on every page. This is not a claim of PDF/UA conformance.
- Wraps normal text and long unbroken strings by measured font width, without dropping characters. Paragraphs can flow across pages. Category headings stay with their score; short attributions stay with their preceding paragraph. Continued category pages repeat their category name. Repeated page furniture may abbreviate an unusually long heading; the original content is complete.
- Uses fixed app-owned font paths and never fetches logos, media, fonts, redirects or other URLs. The model supplies media links/descriptions instead of remote assets. The PDF renderer has no HTTP client path.
- Preflights the exact text against both bundled font files and the supported Latin/Greek/Cyrillic/common-character scope. Canonically equivalent decomposed accents normalize to NFC; tabs become spaces. Unsupported scripts, missing glyphs, direction controls and unsupported variation sequences fail clearly instead of creating an unreadable file.
- Enforces 50 pages, 3 MiB final output and a 10-second layout budget in addition to the model's 200 KiB text budget. It observes abort before/after font loading, between blocks and at cooperative line-yield points; streams are destroyed on failure. The API lane owns request limiting and the per-instance two-render concurrency limit.

Only immutable font bytes are cached. Each request has an independent document, parsed fonts, subset state, output buffers and pagination state. An asset read failure clears the byte-cache promise for recovery. Missing runtime font assets, including after an earlier successful request, return a typed generic 503 error.

## Error contract

The renderer re-exports the shared `PdfRenderError(code, status, message)`:

| Code | Internal status | Meaning |
| --- | --- | --- |
| `unsupported_text` | 422 | Unsupported script/glyph; use the existing web report/browser print. |
| `report_too_large` | 422 | Text, pagination, layout-time or output budget exceeded; no partial PDF. |
| `render_unavailable` | 503 | Bundled font assets are unavailable/unusable. |
| `render_failed` | 503 | Unexpected rendering failure; report content is not included in the public error. |
| `render_aborted` | 499 | Request cancelled internally; the API lane maps it to a safe 503 response if the browser is still waiting. |

Model validation can additionally raise `invalid_report`. Access, token purpose, original expiry, owner relationships, deletion/revocation and the final authorization recheck remain the route/service responsibility. The renderer intentionally has no record or authentication adapter.

## Verification performed

`node tests/result-pdf-renderer.cjs` passed after the pagination fixes. Targeted ESLint and shared `tsc --noEmit --pretty false` passed. No production build/server restart, cloud write, email or provider call was performed by this lane.

The renderer suite creates nine synthetic fixtures (24 pages total), parses them with pypdf and checks every non-whitespace glyph's page geometry with pdfplumber. Evidence is under `../pippi-overnight-2026-10-12/native-pdf-renderer/`:

- `simple.pdf`: one page, saved 70% / 7 of 10, Latin/Greek/Cyrillic text, safe CTA, no private IDs in extracted content/metadata/links, bundled fonts only.
- `stacked.pdf`, `score_overview.pdf`, `action_plan.pdf`: three pages each; 0%, 100%, insufficient information, all denominators, expanded FAQ, testimonial attribution and online-media labels/links. Fetch and Node HTTP methods are trapped during generation.
- `long.pdf`: five pages; 175 narrative lines plus a 1,600-character unbroken word and a final marker. Extraction confirms all 1,600 characters and the final content survive.
- `boundary-30.pdf`, `boundary-31.pdf`, `boundary-32.pdf`: two pages each; a category heading close to the page boundary remains on the same page as its 40% score.
- `continuation.pdf`: three pages; a 90-line category narrative retains a repeated category header and its final coverage line.
- Negative/recovery checks: Arabic, Hebrew, CJK, Indic, Thai, emoji/ZWJ, bidi controls and variation sequences; over-text/over-page limits; a fault-injected >3 MiB output chunk; missing fonts; pre-abort/in-flight abort; and independent successful concurrent renders after failures.

`renderer-test.log` records the final pass. `*-review.png` contact sheets and individual page PNGs were refreshed after the last source change. All 24 pages were rasterized with Poppler; the single-page, layouts, boundary and continuation pages were visually inspected, and the unchanged five-page long-text layout was checked against its prior render. No clipping, margin overflow, missing glyphs or overlapping text was found. Earlier screenshots/PDFs are preserved in `native-pdf-renderer-before-pagination/`.

The nine final files are approximately 19–32 KiB. Logged elapsed times include local PDF parsing/geometry inspection (roughly 130–420 ms per fixture in this run); they are not renderer-only benchmarks, cold-start measurements or production SLAs. Root runs the compiled-route/font-tracing/browser verification separately.

## Batch 12: measured heading and body grouping

The batch 11 rental report exposed a narrower page-flow issue: its `Make it consistent` band heading was on page 2, while its short advice and coverage appeared on page 3. The paragraph correctly stayed with its coverage; the heading had only reserved a fixed 32 points. That pair needed 46 points, plus the heading's 9-point trailing gap. All content was present, but the grouping was poor.

`lib/result-pdf.ts` now uses a shared measured text-entry reservation for drawing and lookahead. A heading reserves its gap and the following block's actual opening height, including the existing paragraph-to-label carry. Consecutive headings carry the next entry requirement, and score blocks retain their full measured reservation. Heights are capped to the printable page; only the first three lines of long text are reserved, so long paragraphs and headings still flow instead of becoming oversized atomic groups. The model, frozen snapshots, scoring, API, font assets, links, glyph checks, limits, and network policy are unchanged.

`tests/result-pdf-pagination.cjs` regenerates the exact rental campaign using the same preserved literal answer fixture as batch 11. Before the renderer edit, its actual PDF word-coordinate assertion failed: advice page 3 did not match heading page 2. That original PDF and an observed-failure transcript are retained under `compiled-verification-batch-12/pdf-pagination/before/`.

After the fix, all **13 additional fixtures / 29 pages** pass coordinate checks:

- Exact rental and one/two added context-line offsets: band heading, advice, and coverage now share page 3, beneath the existing category continuation header. The report remains three pages.
- Four neighboring boundaries with a short band heading, advice, and coverage: the entire group either fits or moves together.
- Four neighboring boundaries without a following label: a section heading remains with the three opening body lines.
- A 90-line guidance paragraph keeps its heading and opening lines together, flows across three pages, and retains its final coverage.
- A 90-line heading flows across three pages, retaining all lines and keeping its final line with the following body and coverage.

The coordinate checks require correct page/order/vertical position, check all non-whitespace glyphs against page margins, preserve page numbering, and ensure internal IDs do not appear in the PDF. The fixtures use direct local rendering with fetch/HTTP traps; zero network calls occurred. All 29 pages were rasterized with Poppler. Rental pages 2 and 3, nearby fit/move boundaries, all three long-heading pages, the long-body tail, and the offset rental ending were visually inspected: no clipping, overlap, detached band heading, or lost continuation context was found in those reviewed pages.

The unchanged `tests/result-pdf-renderer.cjs` suite also passed: **nine fixtures / 24 pages**, including all three layouts, score/attribution boundaries, long unbroken words, score/coverage parity, scripts and glyph fallback, remote-asset isolation, page/text/output budgets, missing fonts, cancellation, and concurrent recovery. Targeted ESLint and `tsc --noEmit --pretty false` passed. This lane ran no production build, shared server restart, cloud request, or real email.

Evidence: `../pippi-overnight-2026-10-12/compiled-verification-batch-12/pdf-pagination/` contains `pagination-first.log` (the first corrected run), `after/pagination-results.json` (named fixtures and exact page coordinates), `renderer-regression.log`, `lint.log`, `typecheck.log`, `before/`, `after/`, `regression/`, and `pages/`. Root owns the subsequent compiled-route and font-tracing checks; these direct-render tests do not claim a production deployment.

### Compiled candidate acceptance

The existing `tests/browser-template-campaigns-batch11.cjs` suite subsequently passed from the clean candidate against the parent's compiled server at `http://127.0.0.1:3164`, with the isolated `release-test-data` directory and all five cloud aliases blank. It covered six public starts and six actual native-PDF downloads, saved draft/publication/report immutability, the three report layouts, literal score/unknown/coverage expectations, desktop/mobile presentation, and no browser page errors. There were no application source edits during this acceptance pass.

All six compiled downloads were extracted, compared against the batch 11 PDFs, rasterized, and **all nine pages were visually inspected**. Visible content is equal after removing only page furniture and the saved date; the ordered percentage values match exactly. Every visible glyph passed the page-margin check, and every page retained its correct footer numbering. The rental report remains three pages; its band heading, advice, and coverage are now together on page 3 at approximately 52.3, 78.8, and 103.3 points from the top. No clipping, overlap, missing guidance, or incorrect score/coverage was found on the nine reviewed pages.

Evidence is under `compiled-verification-batch-12/pdf-pagination/compiled-campaigns/`: `browser-compiled.log`, `results.json`, `pdf-inspection.json`, the six downloaded PDFs, and `pages/`. The first sandboxed Chrome launch failed before test execution and is retained as `browser-first.log`; the authorized local-browser retry passed. Strict deployment tracing and package verification remain parent-owned. This verifies the local compiled candidate, not a production deployment, real inbox delivery, or cloud storage.

## Remaining limits

This release does not provide universal Unicode/RTL output, arbitrary uploaded fonts, remote image embedding, visual parity with every web theme, live video, PDF offer-click analytics or PDF/UA certification. Unsupported content keeps the existing browser-print fallback. Large reports can deliberately be refused rather than truncated. Native PDFs are downloaded copies: revoking the original link cannot recall a file already received. Future richer layout or language work should preserve the existing numeric/snapshot/access tests.
