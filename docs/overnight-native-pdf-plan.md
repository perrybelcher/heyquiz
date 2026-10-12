# Native saved-result PDF: implementation plan

Prepared 12 October 2026. **Historical planning document. Implemented in batch6; see overnight-native-pdf.md for actual completed scope and verification.** This review installed no packages, downloaded no assets, contacted no application/provider APIs and changed no application source. Official documentation was read through web research.

## Recommendation

Use **PDFKit in a Next.js Node route**, with app-owned **static Noto Sans Regular and Bold TTF files**, to create a compact, printable report from the existing frozen `ResultReport`. Keep the current browser Print / Save as PDF option as a fallback. A native download should be a deliberate document layout, not a screenshot of the web page.

This is the smallest *engineering scope* I recommend for our bounded, structured reports; it is not a measured bundle-size winner. PDFKit supports Node streams, embedded fonts, text measurement and paragraph flow. Buffered pages support final page numbering. These primitives fit our headings, scores, priorities and conditional text without running Chromium. [PDFKit Node output and page buffering](https://pdfkit.org/docs/getting_started.html), [PDFKit text and fonts](https://pdfkit.org/docs/text.html).

Choose `runtime = "nodejs"`, initially test on Node 22 (local runtime is 22.14.0), and confirm the project's actual Vercel runtime before release. Use `pdfkit` plus explicit `fontkit` only if our glyph-preflight code imports it; never import an undeclared transitive dependency. Add compatible development typings if the selected package lacks them. Pin released versions and the lockfile at implementation time. The upstream PDFKit manifest currently reports 0.20.2/MIT, but a moving source branch is not proof of npm release availability. Its Node/browser entry points differ, so verify the production import against the pinned release. [Upstream manifest](https://github.com/foliojs/pdfkit/blob/master/package.json).

### Alternatives evaluated

| Renderer | Useful capabilities | Tradeoff for this app |
| --- | --- | --- |
| PDFKit — recommended | Direct Node document generation, vector scores, paragraph flow, font embedding | We own block measurement, page breaks and document structure. No HTML/CSS reuse. |
| `@react-pdf/renderer` | Node buffer/stream output, declarative layout and automatic page wrapping | Good second choice if the page-layout spike is too costly. Adds its React layout/reconciliation stack; current upstream accepts React 19, so React compatibility is **not** a known blocker. Our DOM components still need a separate PDF implementation. |
| `pdf-lib` + `@pdf-lib/fontkit` | Portable PDF creation/modification, font embedding, precise drawing | A good existing-PDF editor, but a less direct fit for flowing reports: more of the page-composition machinery becomes ours. |

Primary references: [React PDF Node API](https://react-pdf.org/docs/v4/node), [page wrapping](https://react-pdf.org/docs/v4/advanced/page-wrapping), [fonts](https://react-pdf.org/docs/v4/fonts), [renderer manifest/MIT/React peer range](https://github.com/diegomura/react-pdf/blob/master/packages/renderer/package.json); [pdf-lib examples](https://pdf-lib.js.org/) and [manifest/MIT](https://github.com/Hopding/pdf-lib/blob/master/package.json). All three require release-specific dependency/license review. No candidate was installed or benchmarked in this pass.

Do not add a Python service, a hosted PDF service, or a production Playwright/Chromium renderer for this feature. The PDF skill's ReportLab workflow is useful for offline artifacts; our deployed application needs a Node dependency. Playwright may test the download, but `page.pdf()` is not the product implementation.

## Existing source and the contract to preserve

Reviewed `lib/result-reports.ts`, `lib/marketing.ts`, `components/ResultReportView.tsx`, `components/MarketingResultCard.tsx`, `app/result/[token]/page.tsx`, `lib/schema.ts`, `package.json` and `next.config.ts`.

- `ResultReport` freezes quiz title/theme, completion/expiry, heading/message/CTA and an allowlisted result. It excludes raw answers, contact fields and grading transcripts. Keep that boundary; arbitrary author-written text can still contain personal information, so do not describe the document as guaranteed anonymous.
- `readResultReport(token)` already validates token purpose/signature/expiry, retained form/response ownership, quiz retirement and individual revocation. Reuse it, rather than constructing a second access rule or reading a report row directly.
- Expiry is the original completion plus 30 days. Download must not issue a new token, extend expiry, recreate a cleaned report or change a snapshot.
- Marketing results already freeze `presentation.layout` and matched `resultSections`. Do not reevaluate conditions, scores, category denominators, priorities or outcomes from today's draft.
- No PDF renderer or app-owned TTF/OTF/WOFF files are installed. Fonts found under `node_modules` belong to Next's internal tools/OG rendering and Playwright's icon UI. Do not depend on those private paths or fonts installed on the developer's Mac.

## Route and security design

Proposed files: `lib/result-pdf.ts` (server-only renderer), `lib/result-pdf-model.ts` (pure allowlisted document blocks), `app/api/result/[token]/pdf/route.ts`, app-owned `assets/pdf-fonts/`, and a small download action in `ResultReportView`.

1. A read-only GET uses the existing result-view bearer token. The download action appears only on the saved report page; it requires no new account. Token possession remains the same access capability as the web report. Do not include it in sitemaps or prefetch the expensive route.
2. Validate through `readResultReport` before allocating a renderer. Invalid, wrong-purpose, expired, deleted or revoked links get the same generic 404. Authentication does not justify returning another report by form/response ID.
3. Validate the frozen payload into a bounded render model; do not mutate the stored object. Generate into a bounded memory buffer. Recheck `readResultReport` immediately before returning bytes, so expiry/revocation during rendering denies the response. A revoke after that final check cannot recall bytes already delivered; document this limit rather than claiming absolute cancellation.
4. Return `application/pdf`, `Content-Disposition: attachment; filename="pippi-result.pdf"`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, `X-Robots-Tag: noindex, nofollow, noarchive`, and `Referrer-Policy: no-referrer`. Apply no-store/error privacy headers to failures too. No wildcard CORS. Avoid user text in response headers.
5. Never log tokens, full request paths, report text, contact details or PDF bytes in application diagnostics. Audit provider access-log/redaction configuration separately; application logging rules cannot guarantee that the hosting platform omits URL paths. PDF metadata contains a bounded document title and original completion date, never internal IDs or the bearer URL.
6. The renderer has **no network fetch path**. No remote logo, image, video thumbnail, stylesheet, font, SVG, redirect or attachment fetch; reject local-file paths and data-URL asset injection too. Only explicitly bundled, reviewed assets are permitted. No HTML execution, PDF JavaScript, embedded files or form controls.
7. Preserve safe saved HTTP(S) CTA links as ordinary PDF annotations, after URL parsing/control-character checks; do not append tokens or personal fields. Native PDF clicks do not invoke the current client analytics handler. Do not promise offer-click attribution without a separate, privacy-reviewed tracking design.

The installed Next 16.4 docs were read: route handlers use Web Request/Response APIs, server dependencies are bundled unless externalized, and file tracing may require narrow explicit asset includes. PDFKit is not in this installed version's automatic external-package list. Start with a Node import and verify the compiled trace; use `serverExternalPackages: ["pdfkit"]` only if the pinned package's runtime asset resolution requires it. Include `assets/pdf-fonts/*` for this route if tracing misses them. Keep current data/env/test exclusions; no broad repository include. References: local `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and `03-api-reference/05-config/01-next-config-js/{serverExternalPackages,output}.md`.

## Document layout and content parity

Use A4 portrait initially, 42–48 pt margins, roughly 10.5–11 pt body type and one consistent heading scale. Use white paper, dark text and a contrast-checked version of the saved accent for rules/bars. Preserve saved brand name and hide-branding preference. Web font choices map to the bundled report face; do not claim an exact web-theme reproduction.

The original layout order is meaningful and must survive:

- `stacked`/legacy: heading, overall, priorities, reasons, advice, category details, resolved sections, primary CTA.
- `score_overview`: heading, overall/category overview, reasons/priorities/advice, every category's details, sections, CTA.
- `action_plan`: heading, advice/priorities/CTA, supporting overall/reasons/category details, sections.

Print **all** categories, including low scores and insufficient data. `null` means “Not enough information”; it is never 0%. Show answered/applicable/minimum-needed coverage using saved numbers. Graded results retain earned/possible/percentage, and omit a points panel when possible is zero. No recomputation or decorative invented comparisons.

Render resolved FAQ bodies expanded, testimonials with attribution, and text/CTA sections in stored order. For image/video sections retain title, description and a labeled ordinary media link; note that media is available online. Do not silently omit entire sections. Remote logos become the saved brand name (or logo alt text/quiz title where needed). The download UI should explain: “A print-friendly report. Images and videos remain online.” A reviewed local Pippi mark can be included later without adding a general SVG parser; initial branded text is sufficient.

Build a pure ordered block model first. Measure headings/cards using the same font and width used to draw them. Keep a heading with at least two following lines, keep a score/coverage row together, split oversized narrative blocks across pages, and repeat an unobtrusive category heading when its narrative continues. Never use fixed text heights or ellipses to hide content. Reserve header/footer space before measuring, and add “Page X of Y” after pagination. Do not shrink the whole document to fit.

PDFKit exposes tagging/logical-structure support, but its documentation also lists limitations. Add headings, paragraphs and sensible reading order; mark decorative bars and repeated page furniture as artifacts. Numeric labels must preserve meaning without color. Test extraction and screen-reader order. **Do not claim PDF/UA conformance** merely because `tagged: true` is enabled. [PDFKit accessibility guidance](https://pdfkit.org/docs/accessibility.html).

## Fonts, Unicode and RTL

Vendor static `NotoSans-Regular.ttf` and `NotoSans-Bold.ttf` from a pinned official Noto release in `assets/pdf-fonts/`, with source/version, SHA-256 and its copyright/OFL file. No runtime Google Fonts call. The Noto project's SIL OFL permits bundling/embedding subject to its conditions, including retaining notices. [Official releases](https://github.com/notofonts/latin-greek-cyrillic/releases), [Noto OFL](https://github.com/notofonts/latin-greek-cyrillic/blob/main/OFL.txt).

Initial guaranteed scope should be the **tested** Latin/Greek/Cyrillic glyph set, punctuation and numerals of those exact files, not “all Unicode.” Preflight characters/glyphs and scripts before rendering, allowing legitimate whitespace. Missing glyphs, unsupported emoji/ZWJ sequences and untested scripts must produce a clear 422-style downloadable-report limitation with the existing web/print fallback; never replace substantive text with boxes, question marks or dropped characters.

Fontkit provides OpenType shaping/subsetting; that does not establish correct mixed-direction paragraph layout or font fallback in our document renderer. [Fontkit official documentation](https://github.com/foliojs/fontkit). **RTL remains an explicit release gate.** Do not reverse strings. Arabic/Hebrew require appropriate bundled fonts, bidi run ordering, shaping, mixed numerals/punctuation and wrapped-line tests. Devanagari, Thai and CJK need separate font/line-break fixtures. If full multilingual output is required for the first release, stop the narrow rollout and complete that shaping/layout spike (including the React PDF alternative) before choosing a renderer. Do not market universal language support based on a Latin-only pass.

## Bounded rendering and deployment gate

Suggested starting safety budgets, to tune with fixtures: 200 KiB of printable text, 50 pages and a 3 MiB final PDF. Validate counts and scalar types even for legacy stored data. Abort with a useful fallback rather than truncating at these limits. Current marketing authoring permits 20 categories and 12 sections; longest allowed content can exceed a small PDF budget, so test those cases explicitly.

A page/byte guard and checkpoints between bounded blocks should stop runaway pagination. A promise timeout alone cannot interrupt synchronous layout. Respect aborted requests and destroy streams on failure. Add bounded per-instance render concurrency (for example two, with no unbounded waiting queue) and the application's appropriate request limiter; explicitly distinguish this from a distributed concurrency guarantee. No PDF/snapshot cache is needed for v1. Immutable bundled font bytes may be reused; mutable document/font layout objects must not leak between requests.

Keep memory output below the host response limit; Vercel currently documents a 4.5 MB function request/response payload limit. Record actual compressed/traced function size, fonts, cold/warm render time and peak RSS under concurrent requests. Confirm limits against the actual deployed plan/configuration before release. [Vercel function limits](https://vercel.com/docs/functions/limitations). No package size, render latency or cold-start claim has been measured here.

## Acceptance checklist for implementation

| Area | Required evidence before enabling native downloads |
| --- | --- |
| Snapshot parity | All three layouts plus legacy, graded/product/segmentation/scorecard, no-match, 0/100/null, every denominator and all resolved section types. Editing current quiz/theme cannot change prior PDF content. |
| Access/privacy | Valid/invalid/oversized/wrong-purpose tokens; original expiry; individual revoke; response delete; quiz delete/recreate; expired cleanup/replay; mismatched owner rows. Revoke/expire during render returns no PDF. Inspect metadata/text/links for forbidden fields and token leakage. |
| Network isolation | Trap outbound fetch/HTTP/DNS in renderer tests. Test localhost, cloud-metadata IP, redirecting and data/file URLs as logos/media: zero requests and safe media placeholders. |
| Pagination | One page, boundary heading, many paragraphs, 20 categories, 12 long sections, very long unbroken text, multiline titles and CTA labels, maximum/over-budget payloads. No clipping, overlap, trailing empty page or lost text. |
| Typography | Accents, decomposed marks, Greek/Cyrillic, symbols, emoji, Arabic/Hebrew mixed text, Indic/CJK and malformed sequences. Supported fixtures render/extract correctly; unsupported ones fail clearly before producing a corrupt/partial PDF. |
| Visual/accessibility | Rasterize **every page** locally and inspect light/dark source themes, grayscale, minimum contrast, bars and reading order. Parse PDF text/page count as additional checks. No dependency on browser print-background settings. |
| Packaging/recovery | Test compiled Next output with only traced assets and no developer fonts. Missing font, renderer error, abort, output cap, concurrent requests and retry recover without leaking streams or report data. Verify no renderer/font bytes enter client bundles. |
| Download UX | Chromium/Firefox/WebKit desktop and mobile action, proper filename/MIME, useful pending/failure state, no popup requirement, keyboard access, 404/no-store behavior and continued browser-print fallback. |

Implementation order: (1) dependency/font provenance and a compiled one-page spike; (2) pure frozen block model and three layouts; (3) access-controlled bounded route; (4) error-aware download UI; (5) synthetic security/layout/language/packaging tests and visual review. The spike must pass before expanding scope. Nothing in this plan establishes production readiness, a working download, or a production browser renderer.
