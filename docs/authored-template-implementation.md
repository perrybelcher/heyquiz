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
