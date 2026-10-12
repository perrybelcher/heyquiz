# Native PDF download — batch6 integrated handoff

Saved result pages now offer **Download PDF** alongside existing **Print / Save as PDF**. The server generates a searchable, paginated document directly with PDFKit; no production browser or hosted PDF service is involved. The original frozen result and safe CTA/media annotations are retained. Images and videos stay online. Unsupported text or oversized reports get a clear browser-print fallback. A failed request can be retried; keyboard access and390px layout were checked.

The route reads the existing private capability before and after generation. Original expiry, individual revocation, deleted responses, ownership and retired/recreated quizzes remain enforced. Responses have no-store/noindex/no-referrer/nosniff headers and a fixed filename. Downloaded copies remain on the recipient's device after link expiry or revocation. No email/CRM/Stripe work was activated.

PDFKit0.20.2 and fontkit2.0.4 are exact production dependencies, with exact development types. Installation disabled lifecycle scripts. Noto Sans Regular/Bold v2.015 is owned in assets/pdf-fonts with official release URL, archive paths, SHA-256 and SIL OFL notice. Fonts are loaded locally. This module never fetches arbitrary remote assets. The final production-only npm advisory check returned0 vulnerabilities; this is an advisory snapshot, not a security guarantee.

## Final verification

- Combined build/TypeScript passed:build-batch-6-final.log,32 static routes plus dynamic PDF route. Isolated compiled3163/session3641 remains running.
-18 model checks,15 access/concurrency/race checks,25 general regressions and existing saved-report allowlist passed.
- Nine real renderer fixtures,24 pages: all three layouts, graded results,0/100/null, exact coverage, expandedFAQ, testimonial/media sections, long narrative/unbroken text, Unicode, size limits, missing fonts and abort/recovery. Every page rasterized; page geometry and visual review passed after heading/attribution pagination fixes.
- Native downloads passed in Chromium,Firefox andWebKit: filename/MIME/privacy, parsed scores and Latin/Greek/Cyrillic content, private-field exclusion, keyboard/error retry, unsupported-language fallback, revocation andmobilewidth. Existing saved-result/browser-print regression also passed.
- Strict packaging harness passed9 real compiled-route cases from only135 traced files (4,393,115 uncompressed bytes including entry). No access to source dependencies/fonts or network was allowed. Font/license/provenance hashes matched. Missing-font failure recovered after restoration. No PDF renderer/font markers were found in client JavaScript chunks. These are local function-trace checks, not a deployed Vercel benchmark.

Evidence:../pippi-overnight-2026-10-12/compiled-verification-batch-6/final-status.json. Earlier visual flaws and test-helper failures remain preserved. Tests use synthetic local records and isolated browser contexts.

Packaging review also found legacy local backup data and QA documents unnecessarily present in traces. next.config now excludes data/** and docs/** in addition to existing env/runtime/test exclusions. Original local files and legacy local import behavior are untouched; these files are not distributed in compiled function bundles. The narrow PDF font folder is explicitly included so its license travels with its fonts.

## Limits and next work

Native text support is tested for Latin,Greek,Cyrillic and covered common glyphs; RTL,emoji,CJK and other unsupported scripts deliberately fall back to browser printing. Remote images, arbitrary uploaded fonts, exact web-theme reproduction, native PDF CTA analytics and PDF/UA certification are not implemented. Limits are50 pages,200KiB model text,3MiB output,10s cooperative layout and15s service deadline. Two-render capacity and12requests/minute are per process/instance. No live deployment, cloud backup/restore or inbox delivery was verified.

Detailed contracts:overnight-native-pdf-model.md, overnight-native-pdf-renderer.md, overnight-native-pdf-access.md, overnight-native-pdf-packaging.md. The original planning document remains historical acceptance context, not a statement that this feature is still unimplemented.
