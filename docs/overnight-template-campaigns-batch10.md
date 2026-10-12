# Six more original campaigns — batch 10

Implemented and verified locally on 12 October 2026. Source checks and the compiled release-candidate browser/PDF acceptance pass. Nothing here claims production deployment or live customer testing.

## Delivered scope

Six previously unenriched catalog entries now have complete editable landing and result content. The catalog retains all **43 IDs**, questions, answer IDs, rules, outcomes, category IDs/bands/minima, tie order and explicit opt-out behavior. There are now **24 enriched campaigns**, with 19 other starters unchanged. The preceding eighteen editorial entries were checked byte-for-byte against the batch-9 checkpoint's specific source member and are unchanged; no checkpoint was extracted or overlaid onto the app.

| Existing ID | Audience and useful direction | Landing | Results |
| --- | --- | --- | --- |
| `garden` | Nurseries and gardening educators; choose a manageable growing project | Split, existing local artwork | Stacked |
| `travel` | Travel planners; describe a trip's pace before comparing destinations | Split, existing local artwork | Stacked |
| `cleaning` | Home service teams; prepare a clear cleaning scope | Compact | Action plan |
| `bookkeeping` | Record-support providers; organize a useful first conversation | Compact | Action plan |
| `volunteer-readiness` | Volunteer teams; clarify roles, orientation and support | Compact | Score overview |
| `content-readiness` | Creators and marketing teams; connect audience, production and learning | Compact | Action plan |

Each includes a concrete promise, three benefits, relevant context, a topic FAQ, truthful optional-contact FAQ, repeated Start control, three conditional result plans, common reflection and result FAQ. Unsure/stop paths remain useful without pushing a purchase, booking or appointment. Scorecard context explains what each area measures; incomplete areas retain visible null/coverage evidence without inventing an overall band.

The already-applied Belcher quiz skill informs conversational and useful copy; the task's fixed five/six-question scope takes precedence over generic skill suggestions. No competitor language, unverified proof, actual service availability, delivery promises or paid/new imagery was added. Gardening/travel keep their existing owned artwork and themes. Bookkeeping offers preparation rather than financial/tax advice or record inspection. Travel does not select a destination, quote a price or book anything. All links begin empty, contact capture stays optional, and marketing opt-in remains disabled.

## Files

- `lib/template-campaigns.ts`: six new editorial entries/IDs only; no renderer, schema, player, scoring, library or launch integration edit.
- `tests/template-campaigns-batch10.cjs`: independent literal fixture exported for browser use, with unit assertions run only when invoked directly.
- `tests/browser-template-campaigns-batch10.cjs`: prepared six-campaign compiled flow with native PDF and report retention checks.
- Authorized narrow updates to `tests/template-campaigns.cjs` (24/count wording) and `tests/template-campaigns-batch9.cjs` (preserved first-eighteen IDs and historical wording). Previous expected outcomes and category values were not weakened. The existing batch-8 first-twelve check remains unchanged.
- This handoff only; no other documentation or application files edited.

## Source verification — passed

- **44 new literal journeys:** all three outcomes per matching campaign, explore-without-commitment, all unsure, strong-match opt-out and original tie order; scorecard 0/50/100, mixed 0/50/100, all unknown, fully unknown area, one answer below required coverage, and within-area 50/75/25. Expectations include precise category score/null, answered/applicable/minimum values and ordered section IDs. They are not generated from the engine being tested.
- **128 shared representative expectations** across all 24 campaigns, expanding the previous 96. These overlap the batch-specific checks; counts are not additive unique journeys.
- Historical batch-8 and batch-9 suites: 44 cases each, passed.
- Original catalog: 43 templates and 64,000 scoring-path checks, passed. Original three launch templates: 768 product paths, passed.
- Every catalog's questions/options, rules/exclusions, outcomes and category minima/bands remain equal to its original constructor. All eight enriched scorecards have distinct context separate from advice/actions.
- Frozen report copies resist later mutations to both original form and result. PDF models retain selected guidance, exact numeric/null category values, order and full context; unmatched guidance and empty CTA links are absent.
- Scoped ESLint, full `tsc --noEmit --incremental false`, and both new script syntax checks: passed.

Logs: `../pippi-overnight-2026-10-12/compiled-verification-batch-10/campaigns/{unit-batch10,unit-all24,unit-batch8-regression,unit-batch9-regression,catalog-regression,legacy-launch-regression,lint,typecheck}.log`.

## Compiled release-candidate acceptance — passed

Ran `tests/browser-template-campaigns-batch10.cjs` from the separately staged candidate at `/Users/perry/Documents/Codex/2026-10-06/gr/work/pippi-release-2026-10-12` against its parent-built production server at `http://127.0.0.1:3164`. The candidate used isolated `release-test-data`, a synthetic session secret and all five cloud configuration variables empty. No application or test-source repair was required after compilation; the first acceptance run passed.

The run used **six synthetic starts and six native PDF downloads**. It verified all six gallery details/checklists, independent guest gardening creation, guided autosave/reload, published snapshots, desktop/mobile landings, one complete gardening click-through with skipped capture, matched/unsure/stop/mixed/incomplete results, all three report layouts and immutable report/PDF content after changed drafts were republished. Exact result expectations came from the independent literal fixture. There were no page errors, and all six landing/report viewport checks passed.

The actual journeys were gardening containers, an outdoor trip, unsure cleaning, explicit opt-out bookkeeping, volunteer category scores 0/50/100 with overall 50, and content scoring with one insufficiently answered area, overall null, and other areas 50/0. Downloaded text retained all selected guidance/category context and omitted unmatched advice, empty CTA links, quiz IDs, bearer tokens and later draft changes.

All **nine actual PDF pages** were rendered with `pdftoppm` and visually inspected: garden 1, travel 1, cleaning 1, bookkeeping 1, volunteer-readiness 3 and content-readiness 2. Text, score bars, null/coverage labels, continuation headings and page-number footers were legible with no observed clipping, overlap or missing glyphs. The desktop garden landing, mobile travel landing and mobile incomplete-content report screenshots were also inspected; their layouts and wrapping were intact. This is representative visual acceptance, not a claim to every browser/device combination.

Evidence under `../pippi-overnight-2026-10-12/compiled-verification-batch-10/`:

- `browser-template-campaigns-batch10.log`: complete passing run log.
- `campaigns/results.json`: the six completed campaign checks.
- `campaigns/template-{garden,cleaning}.png`, `campaigns/landing-*.png` and `campaigns/report-*.png`: gallery, landing and saved-report captures.
- `campaigns/*.pdf`: six downloaded reports; `campaigns/pdf-pages/*.png` and `page-counts.json`: all nine rendered pages and actual counts.

Only this run's fixture IDs were cleaned. No production, provider, email, credential or paid action was included. The candidate source remains unchanged by this verification; this handoff was updated in the active source tree for parent-controlled staging.

## Limits

These are editable starters, not verified plant inventories, itineraries, service contracts or program certification. Creators must supply their actual offerings, policies, destinations and branding. No image generation, live email or cloud verification is claimed. Representative browser journeys and literal scoring checks do not establish every possible browser, device or edited configuration. Application source remains frozen after passing compiled visual acceptance; parent controls any release staging or deployment.
