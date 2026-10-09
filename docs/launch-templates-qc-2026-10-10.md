# Complete marketing templates — 2026-10-10

Added /templates with product finder, follow-up scorecard, and consultation qualifier. Entry links appear in the guest builder and workspace. Each selection creates an independent browser draft and opens the existing editor. Existing starter templates remain unchanged.

Product finder: five questions, three fictional products, weighted preferences and hard laptop exclusions. Scorecard: six questions, three categories, complete score bands and actionable advice; unknown answers remain unscored. Consultation: five questions, three paths, explicit support preference dominates incidental preferences, and opting out never forces a booking recommendation.

Contact capture is optional, marketing consent is disabled by default, and destination URLs are empty. Library instructions require reviewing fictional content, links, privacy policy and result paths before publishing. Templates are starting points, not configured customer campaigns. Previous drafts remain under separate browser storage keys; the library advises saving current work first.

Validation: TypeScript and production build passed. tests/launch-templates.cjs checks schema/publication validity, independent drafts, all 768 product combinations, score boundaries and consultation opt-out. tests/browser-launch-templates.cjs uses Playwright Chrome at 390px to verify selection, overflow, editor draft creation, then local API publication and anonymous submission of each template. Existing result-sections and scorecard-results suites pass. Mobile screenshot: /tmp/pippi-templates-mobile.png. This does not claim physical-device coverage or a complete browser walkthrough of every answer combination.
