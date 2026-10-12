# Six more original campaigns — batch 9

Implemented and verified locally on 12 October 2026. Source checks and the six-campaign compiled browser/native-PDF pass succeeded on the parent-controlled batch-9 build at port 3163. Source remains frozen. Nothing here claims production deployment or live customer testing.

## What changed

The catalog retains all **43 template IDs** and their original questions, answer IDs, rules, outcome IDs, category IDs, score bands, weights, exclusions and minimum-answer requirements. Six existing starters now have complete editable campaign content, bringing the total to **18 enriched campaigns**. The prior twelve campaigns were not rewritten; the other 25 retain their existing starters.

| ID | Practical direction | Landing | Results |
| --- | --- | --- | --- |
| `tea` | A tea preference, small tasting and product-specific checks | Compact | Stacked |
| `desk` | A workspace format and a measuring plan before choosing furniture | Compact | Stacked |
| `language` | A real practice situation, without claiming to measure language proficiency | Compact | Action plan |
| `nonprofit` | A manageable contribution, without pressure to donate or commit | Compact | Action plan |
| `course-readiness` | Learning promise, learner access and support | Compact | Score overview |
| `workshop-readiness` | Practical outcome, participation and follow-through | Compact | Action plan |

Each campaign has an original landing promise, three concrete benefits, context, a topic-specific FAQ, the truthful optional-contact FAQ and a repeated Start button. Results add three conditional plans, a common reflection and a useful FAQ. All-unsure and explicit opt-out paths provide neutral next steps without inventing a recommendation. Incomplete scorecards retain category evidence without inventing an overall band. New category descriptions explain the measured area rather than repeating its action.

The already-applied Belcher quiz skill informs conversational, specific and useful-without-purchase copy. The task's preservation requirements take precedence over its generic question-count, outcome-count and capture-placement suggestions. Existing five-question matches and six-question scorecards remain unchanged.

No new images were needed: these six templates do not have assigned local artwork, and compact landings use their existing color themes. No competitor copy, external imagery, invented proof, health/proficiency certification, available-role promise, guaranteed outcome, automatic setup or email-delivery promise was added. All offer and result URLs start empty. Contact capture stays optional and marketing opt-in disabled. The nonprofit campaign centers voluntary time, skills and accurate sharing; it does not make a donation request.

## File scope

- `lib/template-campaigns.ts`: six new editorial entries and IDs only. The existing pure enrichment and dynamic gallery integration already support them; no launch/library, engine, schema, player or scoring edit was needed.
- `tests/fixtures/template-campaigns-batch9.cjs`: independently authored literal result titles, answers, numeric/null scores, coverage and ordered sections.
- `tests/template-campaigns-batch9.cjs`: content, unchanged full-catalog semantics, journey expectations, immutable report and PDF-model assertions.
- `tests/browser-template-campaigns-batch9.cjs`: prepared compiled acceptance with six synthetic starts and six native PDF downloads; additionally checks saved-report contents after a later republish.
- `tests/template-campaigns.cjs`: necessary count update to 18 and an unenriched control template changed from tea to candles.
- `tests/template-campaigns-batch8.cjs`: explicitly preserves the first twelve entries while permitting appended campaign IDs. Its prior 44 expectations remain unchanged.
- This handoff.

## Verification completed

- New batch-9 suite: **44 literal journeys**. Four matches each cover all three named outcomes, exploration without commitment, all unsure, opt-out overriding a strong match, and original tie order. Two scorecards each cover 0/50/100, mixed 0/50/100 areas, all unknown, a completely unknown area, one answer below the two-answer coverage requirement, and mixed values within areas (50/75/25). Expected values are not derived from the scoring engine.
- All-18 regression: **96 representative literal journey/category/section expectations**. This overlaps the batch-specific cases and is not an additional set of 96 unique cases.
- Prior batch-8 regression: **44 literal cases**, passed unchanged expectations.
- Existing catalog regression: **43 templates and 64,000 scoring paths**. This is the broader original scoring check, separate from the bounded new campaign fixtures.
- Existing three legacy starters: **768 product paths**, passed.
- New tests compare every original catalog question/option, rule/exclusion, outcome and category minimum/band against its original constructor. Intentional category context is checked separately for all six enriched scorecards.
- Private report copies remain unchanged after later mutation of both input form and result. The PDF model contains all selected guidance in order and the original category scores/nulls; unmatched guidance and empty links are absent.
- Scoped ESLint, full `tsc --noEmit --incremental false` and new browser script syntax: passed.

Logs: `../pippi-overnight-2026-10-12/compiled-verification-batch-9/campaigns/{unit-batch9,unit-all18,unit-batch8-regression,catalog-regression,legacy-launch-regression,lint,typecheck}.log`.

## Compiled acceptance — passed

The browser suite passed on its first compiled run with exactly **six synthetic starts and six native PDF downloads**. It checked all six gallery previews/checklists, blank creation, an independent guest tea draft, guided autosave/reload, authenticated save/publish, publication stability after draft changes, desktop/mobile landings, a complete tea click-through with skipped capture, literal matched/neutral/mixed/incomplete results, saved-report retention after republishing changed guidance, all three report layouts, and full native PDF content parity. It recorded no browser exceptions and cleaned only its synthetic records. The parent owned the combined build and compiled server.

The chosen journeys included a tea recommendation, a desk recommendation, language with all unsure answers, nonprofit with an explicit stop overriding a strong recommendation, course readiness with 0/50/100 categories and workshop readiness with an incomplete category alongside 50% and 0%. New draft cover, neutral title and plan wording stayed out of the original publication; after the changed draft was republished, the private reports and PDFs still retained the exact original result content. No placeholder destinations, token/record identifiers, unmatched advice or later-draft wording appeared in the PDFs.

Using the PDF skill's render-and-inspect workflow, all **nine pages from the six native PDFs** were visually reviewed. Text, headings, scores, coverage, footer numbering and page transitions are readable without clipping, overlap or unsupported glyphs. The course score overview spans three pages; the incomplete workshop report spans two. The four matching/neutral reports each fit one page. Separately inspected the desktop tea landing, mobile desk landing and mobile workshop saved report: readable spacing, reachable buttons and correctly distinguished missing versus numeric information.

Evidence:

- `../pippi-overnight-2026-10-12/compiled-verification-batch-9/browser-template-campaigns-batch9.log`: final PASS.
- `campaigns/results.json` under that directory: six recorded results and acceptance checks.
- `campaigns/`: six `landing-*.png`, six `report-*.png`, gallery previews and the six native PDFs.
- `campaigns/pdf-pages/`: the nine rendered pages reviewed visually.

Run settings: `TEST_BASE_URL=http://127.0.0.1:3163`, the dedicated local `HEYQUIZ_DATA_DIR`, all five cloud variables empty, `ARTIFACT_DIR` set to the evidence directory, and the installed Chrome engine. No real recipient, email, external provider or production data was used.

## Remaining boundaries

These are editable starters rather than verified inventories, roles or courses. Owners must supply their actual offerings, scope, policies, destinations and branding before sharing with customers. Self-reported readiness scores are not audits or certifications. The new browser suite covers six representative paths in Chrome, not every path on every device; the broader literal/catalog tests cover scoring separately. No cloud writes, real email, provider request, new artwork, charges or deployment are included.
