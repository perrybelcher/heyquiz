# Independent QA: authored quiz collection

Reviewed integrated application source at `00a5fe610993967e4cb4b72dd5511062d8d5906d` on 29 October 2026. This review did not author the templates or derive expected answers from evaluator output. Written blueprints and concrete participant choices were used to specify separate mixed-answer cases.

## Automated evidence

`node tests/authored-templates-independent-qa.cjs`: **12 groups pass**.

- Exactly 18 templates, 276 substantive questions, 8/8/30 for all six types; guided defaults remain eight questions.
- Existing factory IDs remain usable and independent.
- Mixed personality preferences, two-observation minimum, declared-order ties, renaming and result deletion.
- Website checkout and enclosed-workspace requirements override otherwise dominant preferences.
- Coffee timing/equipment/format/sample-plan context and regular-acceptable requirement answers have no hidden weights; decaf requirement overrides competing taste preferences.
- Diagnostic mixed gap/partial evidence and normalized ties; established/unknown answers produce no asserted challenge.
- Implementation readiness at exact 4-hour/6-week bounds; fractional shortfalls, overlapping preparation/scoping, unknown and invalid input, contextual neutrality, CTA publication validation.
- Renovation priority, four-week boundary and stable-ID deletion; training distinguishes 1.5-hour experienced learners, beginners, unknown skills and missing access.
- Short scorecard mixed category scores of 50; explicit zero remains zero; missing coverage remains null.
- Long scorecard three known practices can yield a bounded category score of 44, but not an overall score; two observations remain insufficient.
- Knowledge five-of-eight mixed result rounds to 63, gives the developing feedback band, fails the editable 70 threshold, and retains explanations.
- All authored normal paths include all questions; separate form objects and themes do not contaminate source content; references remain valid.

One initially mistyped independent fixture used `onboarding-handover` instead of authored `onboarding-promises`. Corrected the fixture ID after inspecting the question inventory; the expected score of 50 was unchanged. This was a test-writing mistake, not an application defect.

## Content and interface review

Reviewed the six type modules, author blueprints and rationale, catalogue/factory, default adapter and template selection components. Confirmed neutral choices, example limitations, empty editable destinations, six long-theme structures, plausible revised knowledge distractors and contextual qualification questions. The weighted examples describe indications rather than scientific diagnoses or guaranteed business outcomes. Existing data and engines are reused.

One nonblocking preview completeness finding was reported to the lead: scorecard previews showed generic band advice but omitted `band.action`, which contains the concrete category-specific next step. Resolved by the lead: inspected the updated preview, which now renders `band.action` with the advice. Compiled preview verification remains in the lead browser run. No evaluator or content blocker remained in this review.

## Independent source spot checks

Author documentation records references for all knowledge questions. Independent spot checks confirmed these principles on authoritative pages:

- [FTC phishing guidance](https://consumer.ftc.gov/articles/how-recognize-avoid-phishing-scams): verify unexpected requests using a known independent route; additional authentication factors reduce risk without guaranteeing safety.
- [National Coffee Association decaf guidance](https://www.aboutcoffee.org/beans/decaf-coffee/): decaffeination removes most caffeine; residual caffeine can remain. This review does not adopt the page's broader health claims.
- [WA Consumer Protection complaint handling](https://www.consumerprotection.wa.gov.au/handling-customer-complaints): understand and record the issue, discuss solutions, keep commitments, follow up and review recurring patterns. The quiz tests general practice rather than local legal rights.

The other Australian Government page timed out during this independent fetch; the author previously verified it, and the accessible WA primary source supports the reviewed complaint-handling principles.

## Verification limits

This independent review covers authored data, evaluation, factory behavior, source spot checks and static interface review. The lead owns compiled Chromium/Firefox/WebKit acceptance, guest/authentication recovery, publication, full participant completion, PDF/export integration, lint/type/build and deployed verification. It does not claim those browser or production gates passed. Production deployment remains a separate action.
