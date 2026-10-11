# Conversation Map and local journey testing

## Purpose
An original Pippi authoring view connects the opening promise, questions, configured branches, contact capture, and results. It is accessible from both guided and advanced editors and does not replace blank creation or require a new wizard.

Cards and observations open the relevant editor section. Question links select the actual question and its page; mobile advanced links open question settings. Contact capture is placed before or after results according to configuration. Nonmarketing result links open the ending editor.

## Local simulation
`lib/journey-testing.ts` uses production path resolution, answer validation, grading, and marketing scoring. It performs no network calls and does not create respondents, attempts, contacts, emails, analytics events, or integration deliveries.

The UI checks at most 256 terminal cases with a separate complexity limit. Complete finite traversals are identified; capped runs are labeled partial. Unsupported open-ended input domains are disclosed and require manual testing. Missing results are described as not observed, not automatically unreachable. Changing the draft invalidates a previous result.

Results list the actual visited questions, chosen answers, and numeric score when one can be calculated. Per-answer exclusions, scorecard minimum coverage, neutral answers, conditional visibility, and branching use the same functions as the quiz player. Runtime shuffling, timeouts, contacts, external URLs, and integrations are outside these checks.

Browser QA also identified a false recovery prompt on fresh templates: schema parsing reordered nested object keys. Autosave fingerprints now canonicalize object keys while retaining array order and content, so equal drafts do not appear to have unsaved changes.

## Checks
- TypeScript and production build.
- `tests/journey-testing.cjs`: branching, jumps, references, empty forms, hidden/typed coverage, grading, exclusions, scorecards, multi-select, bounded traversal, no mutations/network, observation severity.
- Existing template scoring suite (64,000 combinations).
- Existing guided-editor browser regression: edits, per-answer scoring, shared state, theme, recovery, publication checklist.
- `tests/browser-conversation-map.cjs`: guest testing, precise editor navigation, latest draft state, partial coverage, mobile layout, and no API mutations.
- Existing draft-protection browser regression: two-tab isolation, failed-save reload recovery, restore, stale revision rejection, and unavailable storage handling.

These are structural checks and local scoring simulations, not a claim of validated conversion performance or complete end-to-end delivery.
