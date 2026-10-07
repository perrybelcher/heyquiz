# HeyQuiz MVP acceptance tracker

Updated October 7, 2026. This tracks implementation, not a claim of full Fillout parity. A full competitor feature audit remains separate. The original backup and original app remain unchanged.

## Current milestone: lead capture and Contacts

Implemented locally October 7, 2026:

- Contacts tab with capture before or after results, optional/required contact details, configurable name/phone fields and transition copy. Capture after results is always optional.
- Separate unchecked marketing consent. Declining marketing never blocks results. Stored consent includes the wording, timestamp, quiz revision, privacy URL and purpose copy.
- Contacts are stored atomically inside their response, alongside answers and computed segment/product/category results. Retries reuse the attempt ID; separate attempts remain separate contacts.
- Search, consent filters, detail view and filtered CSV export. CSV neutralizes spreadsheet formulas.
- Failed saves retain the participant’s answers and form input; completed results can be resumed during the 24-hour session. Contact fields themselves are not stored in browser session storage.
- Preview never creates saved contacts. Owner-only Contacts endpoint; public results omit contact details.

Verification: 19 dedicated checks (including simulated storage failure/retry), 25 unit regressions, 12 general API and 12 marketing API checks passed: 68 total. Production build passes with four existing filesystem tracing warnings; touched-file lint has no errors (existing editor/player warnings remain). Browser verified optional capture with unchecked marketing consent, correct recommendation, contact search/filter/detail and a downloaded CSV containing the fictional record.

Limitations: browser checks were desktop; broader mobile/accessibility testing remains. Cloud account isolation and cloud storage have not been verified. Capture does not send an email or webhook. These are local MVP milestones, not production-launch readiness.

## Previous milestone: marketing decision engine

Implemented in the local preview at http://127.0.0.1:3130:

- Three editable starting templates on the dashboard: product finder, buyer segmentation, and category scorecard. All examples are clearly fictional and have no live offer destinations.
- A Marketing tab in the editor with result/category copy, answer rules, exclusion rules, minimum match points, category answer coverage, and fallback copy. Uses the existing autosave and published-version controls.
- A draft simulator that does not create a response or lead.
- Server-computed personalized results, selected-answer explanations, useful advice, optional offer buttons, and category scores. Decision rules are omitted from the public starting payload.
- Marketing results are saved with responses, visible in response detail, and included in CSV exports. Marketing responses do not display a knowledge-test percentage in the results table.
- Brief question-entry animation with reduced-motion support.

### Decision rules

Product/segment recommendations use additive answer points. Duplicate selections count once. Any matching exclusion makes that result ineligible. Highest eligible total above the result's minimum wins; ties follow result order. No eligible result produces the configured no-fit response.

Scorecards sum selected points and divide by the maximum possible for the answered, applicable mapped questions in each category. Single-choice maxima use the highest mapped answer; multiselect maxima use the sum of available mapped points. Explicit zero-point answers count toward coverage; unmapped/unknown answers do not become zero. Categories below minimum coverage show “Not enough information.” This is a configurable self-report rubric, not a validated diagnostic instrument.

Hidden questions cannot contribute to either calculation. The server uses the attempt's published snapshot; respondent-supplied result IDs are ignored. Preview submissions remain unsaved.

## MVP requirements and acceptance criteria

| Capability | Current state | Acceptance criterion / remaining work |
|---|---|---|
| Builder, pages, themes, preview/publish | Existing local implementation | Broader field-by-field accessibility and editing QA still needed; no blanket 51-feature parity claim |
| Autosave and draft isolation | Tested locally | No silent overwrite; stale revisions rejected; published snapshot unchanged by drafts |
| Branching and calculations | Existing implementation with regression checks | Add visual branch diagnostics and broader calculation authoring checks |
| Product finder | Implemented this milestone | Positive fit, exclusions, ties, unknowns, server storage and live rendering verified |
| Buyer segmentation | Implemented this milestone | Selected help routes correctly; decline/unsure paths do not force an offer |
| Category scorecards | Implemented this milestone | Independent category math, zero vs unknown, minimum coverage and saved result verified |
| Personalized results | Functional basic blocks | Explanations, advice and CTA work; full drag-and-drop result-page design and conditional proof blocks remain |
| Persuasive AI generation | Pending | Existing Gemini adapter still generates conventional quizzes; connect the supplied persuasion core and the new marketing schema, then test live with credentials |
| Lead capture and consent | Implemented and tested locally | Before/after capture, separate consent, linked contacts, search/filter/export and retries verified; cloud and broader device QA remain |
| Webhook connection | Pending | Owner-configured destination, secure outbound policy, signed payload, delivery status, idempotent retries and test endpoint |
| Analytics | Basic starts, completion and question reach | Add explicit lead/offer-click events and reconcile them with records; question reach alone is not abandonment |
| Authentication and storage | Working local mode; cloud adapters unverified | Verify two isolated real accounts and durable cloud uploads with Supabase credentials |
| Production launch | Not ready | Connected-service checks, broader QA, deployment configuration, recovery and operational checks remain |

## Next implementation milestone

Verified webhook delivery: owner-configured destinations, signed payloads, delivery status and idempotent retries, tested against a synthetic destination. Then integrate persuasive AI drafting with marketing types, verify real hosted accounts, and complete device/accessibility and operational checks.

## How to try this milestone

1. Open the local workspace.
2. Choose Product finder, Buyer segmentation, or Category scorecard under “Start with a marketing quiz.”
3. Open Marketing. Expand a result or rule to edit it and try combinations in the simulator.
4. Use Preview for an unsaved-response trial, or Publish for a local saved-response trial.
5. Open Results and View to inspect the computed recommendation or scorecard.

The persisted browser demo is “Find your everyday carry.” Its edited title “The Everyday Sling — light essentials” confirms marketing configuration survived save and publish.

## Try lead capture

Open the fictional “Find your everyday carry” demo and select Contacts. Its locally published player now has optional capture before results. Complete three questions, submit a fictional email with marketing unchecked (or skip), and inspect Contacts. “Fictional Demo Contact” is an intentionally retained test record; no email was sent. Changes in Contacts use the existing autosave and Publish workflow.

Source snapshot: `heyquiz-mvp-milestone-2.zip`. It excludes secrets, runtime data, node_modules, build output, and original imported data. Evidence: `heyquiz-contacts-verification.json`, `heyquiz-lead-capture.png`, `heyquiz-contacts-screen.png`.
