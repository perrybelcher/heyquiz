# Focused QC and polish — 12 October 2026

## Changes
- Analytics preferences now show the saved allow/off choice and offer a close button without changing consent. Long panels scroll on short screens. Equal allow/decline choices and masking remain unchanged.
- Creation cards use refined padding, softer shadows, clear focus and reduced-motion-aware arrow feedback.
- Creation heading spacing and draft card presentation refined; extra bottom space avoids crowding the fixed preferences control.

## Verification
- Production build and TypeScript passed. Scoped ESLint and diff whitespace checks passed.
- 25 regression cases, 5 Clarity privacy groups, 10 independent report customization groups, 5 auth/recovery boundary groups passed.
- Compiled Playwright creator tests: next-step focus, scoring examples, multiple-answer scoring, privacy/consent/withdrawal, new close-without-consent behavior at mobile/desktop widths passed. Vendor traffic was mocked.
- Manual creation, answer editing, correct answer/points, theme persistence, guest claim, autosave/reload passed. Tested desktop/mobile states had zero axe violations.
- Respondent tests: 5 workflow groups and 10 accessibility scans passed, including branching, persisted results, preview isolation and frozen grading.
- Report management passed: owner/origin isolation, metadata privacy, contact/response targeting, revocation, replay, concurrent operations, failure recovery and mobile layout.
- Native PDF rendering passed: nine fixture layouts, long documents, glyphs, margins, boundary pagination, no remote assets and failure recovery.

## Limits
Synthetic local fixtures; no real emails, paid AI calls, customer modifications or hosted authentication certification. No claim of exhaustive testing. Live /create was visually inspected before edits. This polish pass is distinct from the already-live Clarity release; deployment evidence is recorded separately.
