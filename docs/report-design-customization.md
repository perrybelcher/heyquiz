# Saved report and PDF design — 12 October 2026

Implemented and verified against the combined compiled local app at port3165. Hosted acceptance remains separate at this checkpoint. This does not change scoring, private-link authorization, revocation or email delivery.

## Creator controls

Report design is a collapsed disclosure in Guided Results and full-editor Ending. Two original styles share a consistent content model:

- **Editorial:** an open title treatment, fine rules and generous spacing.
- **Executive:** a dark masthead and shaded score panels.

Both support a separate PDF cover, a report title/subtitle, opening introduction, closing footer note, and optional supporting-section order/visibility. A custom main report button can replace the saved main result button. It does not change the player or buttons inside conditional content. Title defaults to the frozen quiz title when left blank.

The result title/message, all stored scores, category descriptions/bands/advice, coverage and insufficient-information states are mandatory. Creators may hide/reorder next priorities, reasons, first-step advice, resolved additional sections and the main button. The internal order of resolved additional sections remains intact. No evaluator runs to regenerate or improve an already stored result.

Changes use explicit Apply. Pending text is separate from form autosave, survives editor-mode changes and has bounded session-tab recovery. Invalid settings disable Apply. A changed saved-design baseline requires reloading the current design; failure to back up pending settings is visible. Applying/resetting clears only the matching pending entry. Ordinary draft saving/retry and publication then apply. Before-unload protects unapplied settings; this is not account-wide version history.

The live sample uses fixed, visibly labeled fictional scores, including missing information. Its buttons are inert and it fetches no artwork. It illustrates order/style, not exact native pagination. A real completed saved result supplies the actual native download.

## Contract and freezing

`Form.reportDesign` is optional and strict/versioned. It contains two style choices, cover boolean, bounded plain text (title140, subtitle240, introduction2000, footer160), up to five distinct allowed groups and an optional label80/URL2000 CTA. HTTP(S) annotation links reject credentials, controls, backslashes, unsafe protocols and result bearer paths. No arbitrary HTML, CSS, filesystem path or remotely fetched asset is accepted.

The report snapshot copies design from the frozen attempt form alongside its result/theme. Subsequent draft editing or republishing cannot change that saved report. Public quiz projection omits report settings. With no settings, the model retains the exact former shape and the renderer/web view use the former path. Resetting to the original layout affects future published responses only.

Configured web reports and PDFs share the same bounded allowlisted model. White report-paper variables are scoped locally so a dark quiz theme cannot turn report text white on white. Native PDF accent text falls back to a dark readable accent when the chosen brand color is too light; the sample uses the same rule.

## Verification so far

- Existing18 model checks pass, including exact legacy model object, all result types, null/zero/100, categories, all conditional section types and privacy bounds.
- Existing renderer suite passes: three old layouts, long text/words, page and output budgets, heading/score and attribution boundaries, script fallback, no remote assets, cancellation and recovery.
- Independent10 model/schema/snapshot groups plus four actual style/cover renders pass. All10 rendered pages were visually reviewed; selected cover and inline pages were additionally inspected by the implementation owner. Evidence: `outputs/pippi-delivery-2026-10-12/independent/pdf`.
- New pagination stress test passes for both styles: seven pages each, maximum title/subtitle/footer, long introduction/category/FAQ, complete closing markers and glyph bounds. Its first fixture exceeded the subtitle limit before rendering; that test-only length was corrected to exactly240 characters. Evidence: `outputs/pippi-delivery-2026-10-12/report-flow`.
- Full TypeScript and scoped new-file ESLint pass. Existing EditorStudio/legacy image warnings remain. No dependencies were added.
- Final Chrome, Firefox and WebKit compiled browser tests pass guided/full controls, invalid-input isolation, pending reload, exact saving/retry/reset, frozen publication/report, real native download and six320/390/1440 accessibility scans per engine (18 total, zero violations). Each engine created exactly one synthetic public attempt/completion/report and downloaded one PDF; no page errors, external requests or email requests were observed. Final dark-theme fixtures verify paper colors remain readable. Chrome320 editor/390 report and WebKit390 sample/320 report screenshots were inspected.
- Actual browser-downloaded PDFs were separately extracted: all three contain the frozen title, introduction,100% and10/10 points, closing note and exact custom CTA, with no later draft wording. All are two pages. A first standalone extraction assertion expected an unwrapped title; normalizing PDF whitespace correctly recognizes the wrapped title without changing any content assertion.
- Initial sandboxed Chrome launch failed before fixtures; isolated browser launch permission resolved it. The first functional Chrome run reached all checks then failed a test-only counter: Playwright's API request context does not emit page request events. The API wrapper now counts successful fixture starts directly and retains the strict one-start assertion. That initial run added one identical synthetic attempt/report/PDF beyond the three final runs; it is not extra unique coverage. Original logs remain.
- Final browser evidence: `outputs/pippi-delivery-2026-10-12/report-browser/{chromium,firefox,webkit}-final`, with adjacent per-engine logs. Runtime source stayed unchanged throughout compiled acceptance.

## Deliberate limits

This is structured report customization, not a freeform page designer. The native PDF uses bundled fonts and brand name/color; logos, images and videos remain online. Current unsupported writing systems retain the existing browser-print fallback. No new PDF/UA claim, upload/font service, remote image fetching, website extraction, report-email delivery, tracking or customer-data operation is included. The web sample and native PDF can differ in line breaks/type metrics. Hosting and actual user-created account delivery remain separate verification work.
