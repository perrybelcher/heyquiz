# Final seven original campaigns — batch 14

12 October 2026. Source and compiled local acceptance passed for the final seven campaigns. All 43 existing template IDs now have original landing/result enrichment, with the earlier batches retaining their accepted copy and scoring. Seven final-batch public journeys, seven native PDFs (11 actual pages) and 16 desktop/mobile screenshots were checked on the isolated release candidate. All work is local; no production, cloud, provider, real-email, credential, purchased-artwork or paid activity is included.

## Editorial scope

| ID | Practical direction | Result layout |
| --- | --- | --- |
| `candles` | Sample a fragrance family and verify the actual product | Stacked |
| `event-format` | Define the attendee takeaway before choosing a format | Action plan |
| `hotel` | Compare ordinary-day requirements with actual property details | Stacked |
| `renovation` | Prepare the right scope and questions before arranging work | Action plan |
| `product_finder` | Compare fictional carry formats while respecting hard fit limits | Stacked |
| `scorecard` | Investigate one follow-up habit with honest unknown-answer coverage | Score overview |
| `consultation` | Choose welcome support without overriding no-support/no-time answers | Action plan |

All seven use compact, intentionally art-free landing pages. Each has three benefits, context, topic FAQ, optional-contact FAQ, repeated Start button, three conditional plans, reflection, result FAQ and four creator customization checks. Neutral and excluded paths remain useful without a purchase, reservation, booking or support commitment. Contact capture stays optional, marketing consent stays off and every destination begins empty. No email delivery or performance guarantee is promised.

These are original editorial directions, not market-research findings. The already-applied Belcher Quiz skill informs conversational copy; the explicit existing five/six-question structures and three results override generic skill structure suggestions. No competitor copy or external asset was used.

## Legacy integration and preservation

The four catalog rows use the existing campaign helper. The three older constructors now pass their completed, independently cloned forms through that same helper after the existing design step. No constructor question, option, rule, outcome, weight, exclusion, category minimum or score band changes.

The helper retains original non-generated result sections before adding campaign sections. The carry finder's `check-fit` FAQ remains first, with its original exact wording. Generated IDs are replaced consistently when enrichment is reapplied, avoiding duplicate sections. All 43 forms pass an exact once/twice idempotence check. This is template enrichment, not an editor migration or retroactive rewrite of saved quizzes.

The carry finder still excludes every fictional product for a 17-inch laptop, and laptop-protection requirements exclude the sling/tote even when preference points favor them. The consultation's support answer retains its 20-point weight, its other answers retain one point, and explicit no-support/no-time exclusions remain. Its and the carry finder's existing fallback wording remains exact. The follow-up scorecard gains explanatory category context while its original band thresholds, advice/actions, IDs, two-answer minima and unknown handling remain unchanged.

External before/after SHA-256 evidence confirms all prior 36 campaign property source bytes are unchanged and all 43 templates retain their exact original question/answer wording and IDs, outcomes, rules/weights/exclusions, category/band structure and original outcome/band copy. No schema, engine, player, editor, PDF renderer, package or provider code changed.

## Source verification — passed

- **64 new literal journeys:** 32 across the four catalog campaigns; 10 carry cases; 12 scorecard cases; 10 consultation cases. Expected values are authored independently of the evaluator.
- Carry cases cover three matches, unsure choices, 17-inch exclusion, laptop-protection priority, minimum points, original tie ordering and unresolved size verification. Every resolved result retains `check-fit` first.
- Scorecard cases cover 0/50/100, two different category distributions with the same overall 50, all unknown, a wholly unknown category, one scored answer below its two-answer minimum, every category below minimum, and reachable scores adjacent to the original band transitions (42/50 and 75/83). Exact band endpoints 0–49, 50–79 and 80–100 are separately asserted. Unknown is null, never zero; category answered/applicable/minimum counts and section order are literal.
- Consultation cases cover all three routes, the dominant support preference against four conflicting low-weight answers, explicit no support, no time excluding otherwise strong planning, and no time preserving an eligible self-guided route.
- All cases check immutable saved-report snapshots, full selected guidance and literal numeric/null values in the PDF model, no unmatched plan leakage and no placeholder links.
- Shared suite passes **210 representative catalog expectations** across the 40 catalog constructors; bespoke legacy expectations are in the new suite. These counts overlap and are not additive unique coverage.
- Historical batches 8, 9, 10 and 11 retain their 44 cases each; batch 13 retains all 48. Only the authorized batch 13 first-36 prefix/message changed. The shared test no longer assumes candles is unenriched and explicitly leaves the differently structured legacy fixtures to batch 14.
- Original catalog regression passes 43 template IDs / 64,000 scoring paths. Original legacy regression passes 768 carry paths plus scorecard/unknown and consultation checks unchanged. These are scoring checks, not exhaustive browser journeys.
- Scoped ESLint, full TypeScript and browser script syntax pass. No dependency or build operation was performed by this lane.

Owned files: `lib/template-campaigns.ts`, narrow final-return integration in `lib/launch-templates.ts`, new `tests/template-campaigns-batch14.cjs` and `tests/browser-template-campaigns-batch14.cjs`, approved maintenance in `tests/template-campaigns.cjs` and `tests/template-campaigns-batch13.cjs`, and this document.

Evidence: `../pippi-overnight-2026-10-12/compiled-verification-batch-14/campaigns/`: `unit-batch14.log`, `unit-all43-catalog.log`, `historical-regressions.log`, `catalog-regression.log`, `legacy-launch-regression.log`, `lint.log`, `typecheck.log`, `preservation.log`, `prior36-editorial-hashes.json` and `original43-semantic-hashes.json`.

## Compiled acceptance — passed

The first Chromium run of `tests/browser-template-campaigns-batch14.cjs` passed against the parent-built candidate at `http://127.0.0.1:3164` (`build-batch-14-final.log`). It used the isolated `release-test-data` directory, blank cloud aliases and the synthetic local session secret. There were seven unique forms, seven public starts and seven native PDFs, covering all three result layouts. Cases were fresh fragrance, a workshop, unknown stay preferences, renovation feasibility, laptop protection beating higher travel preference points, a partial scorecard with one category below minimum, and no-extra-time consultation preserving self-guided work.

The run verified all seven gallery details/checklists, an independent guest fragrance draft, guided CTA autosave/reload, frozen publication while a draft changes, one full fragrance click-through with optional capture skipped, exact literal public result/coverage/section ordering, and saved-report/PDF invariance after republishing the edited draft. There were no page errors. Its own synthetic form/attempt/submission/report/visit and retirement records were cleaned up.

All **11 actual PDF pages** were rendered and visually inspected: candles 1, event-format 2, hotel 1, renovation 2, product_finder 1, scorecard 3 and consultation 1. Headings and body text remain readable, with no clipping or footer overlap. The two longer preference reports keep the final FAQ intact on a second page. The three-page scorecard displays null/below-minimum information distinctly from 50% and 0%, with a clear category continuation label. A possible overlap in the scaled bag-report preview was checked against the PDF coordinates and ruled out; no renderer change was needed.

All **16 UI screenshots** were inspected: seven landings, seven saved reports and two gallery previews. Event-format, renovation and scorecard were exercised at 390px; the other landings/reports at 1440px. The gallery also includes a mobile scorecard preview. Controls wrap, report cards contain the longer copy, the hotel neutral result omits an unmatched plan, and the bag finder retains its fit FAQ first. No new visual defect was found in these representative views.

Evidence in the same campaign directory: `browser-compiled.log`, `results.json`, the seven PDFs, `pdf-pages/page-counts.json`, all 11 rendered page PNGs, 16 UI PNGs and `visual-review.json`. A final test-only lint cleanup replaced an unused destructured category description with an explicit cloned-field omission, preserving the exact original semantic hash assertion. Scoped lint and all 64 literal cases passed again in `lint-test-final.log` and `unit-batch14-final.log`. Application source stayed frozen after the coordinated build.

This is representative compiled acceptance in Chromium, not every answer path or a new cross-engine result. No production authentication, real inbox, cloud, live conversion, human usability, broad load or accessibility-conformance claim is made. No provider service, dependency, paid asset, deployment or server change was made by this lane.
