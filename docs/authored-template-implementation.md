# Authored quiz collection

Starting revision: 4fb3c48f936343fc2e0ca6418280f38bb6cce30d.

## Shared contract and ownership

The collection adds exactly 18 examples, 8/8/30 questions per type, 276 questions. Existing template IDs and saved forms remain intact. `AuthoredTemplate` in `lib/authored-template-contract.ts` is the common interface. Each module exports an array named `<type>Templates` (productFinderTemplates for product matching). Build functions return ordinary parsed forms, using a supplied new ID. No persistence or evaluation engine belongs in content modules. Counts are derived from built questions by the catalogue. Every long example has six themes of five questions, with all questions on the normal path.

- A owns lib/authored-templates/personality.ts and knowledge.ts, tests/authored-templates-a.cjs, docs/authored-templates-a.md.
- B owns lib/authored-templates/product-finder.ts and qualification.ts, tests/authored-templates-b.cjs, docs/authored-templates-b.md.
- C owns lib/authored-templates/diagnostic.ts and scorecard.ts, tests/authored-templates-c.cjs, docs/authored-templates-c.md.
- Lead owns contract, catalogue/factory, default adapter, template UI, shared acceptance and integration documentation.

Authors define three outcomes before writing questions (knowledge and scorecard use their existing graded presentations). Include introduction, complete answers, mappings/conditions, useful result explanations and next steps. Diagnostic results need three actions. Unknown answers provide no positive evidence. Qualification rules are ordered, use stable choice IDs and numeric boundaries where appropriate, and require explicit known evidence. Empty editable CTA URLs must not point at invented businesses. Label example offers, thresholds and nonvalidated assessments. Keep existing theme controls. No AI limit changes.

Editorial documentation must explain each outcome, each question's evidence, neutral handling, ties, exclusions, route priority and score/category coverage as applicable. Knowledge claims require verified authoritative sources. Tests use literal answer fixtures for all outcomes plus meaningful edge cases; expected results must not be derived from evaluator output.

Review rotation: A reviews C; B reviews A; C reviews B. Findings go to authors for edits. Fresh independent QA follows sequential integration. Acceptance covers counts, IDs/references, independent instances, publication after creator configuration, neutral/tie/exclusion/boundary cases, full 30-question paths, recovery/design/report compatibility and compiled browser flows. Production deployment is separate; Firefox startup limitation remains a gate unless successfully verified.


## Integrated delivery

Compiled application source: `c48858e472387aee0401c725439c85a8d9bf7b05`. Acceptance checkout: `bee0fb43e275ac57ac30a78344d352b345fe20ae` (29 October 2026); the later commit only corrects a browser test locator and has identical application source. The initial checkout was clean. The lead integrated content commits sequentially; authors worked from shared contract commit `ff5e219` in three separate managed worktrees. No evaluator, storage schema, AI question limit, integration configuration or customer record was changed.

`lib/authored-templates.ts` registers the 18 authored examples; `lib/template-factory.ts` provides one selection entry point for authored and historical templates. `outcomeTemplate(type,id)` remains the guided-creation adapter and now chooses an eight-question example. Metadata counts derive from content. Existing 43 template IDs and contents remain accessible through the additional-template view. The existing guest draft keys and recovery/editor flow are reused.

Editorial review rotation completed: A cleared C; C requested distinct coffee evidence and neutral treatment of contextual preferences, then cleared B's revisions; B requested more plausible knowledge distractors and a canonical source URL, then cleared A's revisions. A fresh QA author added 12 independent mixed-case groups and identified missing scorecard action text in the preview. That preview omission is fixed. See the three author documents and the independent QA record for question rationales, source references, rules and literal expected cases.

### Automated verification

- Baseline: standard regression, outcome, reliability, workspace and TypeScript checks passed before content integration.
- `npm run test:templates`: 18-template structural checks, author fixtures, 12 independent QA groups, and the retained 43-template catalogue pass. Existing catalogue covers 64,000 scoring paths.
- `npm test`, `npm run test:outcomes`, `npm run test:reliability`, `npm run test:workspace`, `npm run test:v2`: pass.
- Existing launch-template/campaign, journey-testing, guided-editing, saved-result and PDF-model suites: pass.
- Integration, provider, Nango, analytics, tracking and Meta suites: pass with synthetic/mocked transports. No live delivery or provider verification is claimed.
- `npx tsc --noEmit`: pass. Full lint: zero errors, 67 warnings; scoped changed-source lint passes. Production build: pass.

### Isolated browser environment

Compiled Next server on `http://127.0.0.1:3193`; synthetic storage `/tmp/pippi-authored-template-data`; cloud credentials blanked, local authentication enabled, Meta disabled, external browser requests blocked. Browser suites sharing the server are serialized. Knowledge AI tests use mocked responses and a dummy enablement key, never live generation. Browser evidence is recorded below after completion.

Firefox launch was retried with the installed Playwright runtime: it exits before app load with `Could not find profile folder`. This remains a release gate requiring a host on which Firefox launches. Production deployment and actual deployed creator/participant verification are separate outstanding release actions.


### Browser results

`TEST_BASE_URL=http://127.0.0.1:3193 BROWSER_ENGINES=webkit,chromium node /tmp/pippi-template-run.cjs test tests/browser-authored-templates.cjs`: **pass** for both engines. All18 templates were previewed and instantiated in each browser; all18 survived reload; keyboard selection and narrow preview layouts passed. A real guest draft was claimed through local authentication. Each template was saved and published with synthetic CTA destinations, every one of its questions was answered through the player, its literal expected outcome/score was checked, and its saved result, PDF and CSV export were verified. This includes all276 question responses per browser and every comprehensive quiz end to end. The additional historical-template view remains available.

WebKit recorded three background same-origin Next RSC prefetch diagnostics during navigation, separately reported by the existing narrow diagnostic classification; all page-readiness checks passed and no application/session/render errors were excluded. During harness development, two locators were corrected for the existing Responses tab and Industry combobox; these were test assumptions, not app defects. The final full command exited successfully.


Existing creator browser regression: **seven groups pass** on Chromium, covering all six blank/guided/template entries, reload, results-first review, manual mappings/deletion, qualification rule priority and stable IDs, guest conversion retry/recovery, and mocked AI creation. The AI mock now uses the existing marketing starter compiler with distinct synthetic target descriptions; authored numeric qualification questions are not injected into the choice-only AI schema. AI behavior and limits are unchanged. Creator-test revision: `aae46b06ceedfc2232cc03e0689641aecc3350ef` (application source still identical to the compiled revision).


Existing outcome browser regression also passes in Chromium and WebKit: personality, product matching, diagnostic and qualification editor → theme edit → publish → participant completion → saved result/PDF, including mobile layout and conversion keyboard controls. Final compiled catalogue screenshots were visually inspected at desktop and390px mobile width; the concrete scorecard category action is present in the preview. Screenshots: `/tmp/pippi-template-browser/catalogue-desktop.png` and `catalogue-mobile.png`.

The isolated test server was stopped after verification. No production deployment occurred. Remaining release gates: Firefox on a working host, then deployment approval/action and actual deployed creator/participant smoke tests. Keep current readers available when rolling back creation entry points.

Final TypeScript, full lint and production build pass at `aae46b06ceedfc2232cc03e0689641aecc3350ef`; application source is unchanged from the browser-tested build. Later documentation commits only record this evidence.
