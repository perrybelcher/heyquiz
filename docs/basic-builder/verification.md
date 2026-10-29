# Basic builder verification

## Automated

Passed: npm test; test:templates; test:outcomes; test:workspace; test:reliability; test:v2; guided-editing (11); guided-checklist (10); basic-fields; basic-preview; independent Basic QA (6); publication-pause (9); publication-receipt (5); visual-brand-kits; visual-brand-kit-management (7). TypeScript and production webpack build passed. Full lint: zero errors, 70 warnings; scoped changes have two image warnings and one existing navigation-effect dependency warning.

A pre-existing publication-receipt harness failure was reproduced in the common-base worker checkout: extracted handler referenced reportInterfaceEvent/v2 but the VM did not stub them. Added only those test bindings; the actual source-handler/route receipt scenarios now pass. Publication behavior was not changed.

## Browser acceptance

Compiled isolated app, synthetic records under /tmp/pippi-hover-data, provider credentials disabled by /tmp/pippi-hover-run.cjs. In-app Chromium browser:
- Created comprehensive website template; all30 questions in outline; search reaches30.
- Edited question30, switched Advanced/Basic, reloaded: identity/content/step retained.
- Claimed guest draft using local account; saved to account successfully.
- Edited result CTAs, quiz title, welcome settings/button, progress/review, fonts/corners, capture/privacy/consent.
- Existing validation/confirmation/publish succeeded locally; sharing controls appeared.
- Blank question30 produced exact checklist target; keyboard activation returned focus to its textarea; restored valid wording.
- Mobile drawer reaches30; preview mounts once; no duplicate IDs; Escape restores focus.
- Completed every question of the30-question public snapshot, reviewed answers, skipped optional contact capture; expected Business presence website recommendation returned.
- Widths320/390/768/1024/1440: no horizontal overflow. Mode targets44px. Desktop/tablet footer fits viewport.

Firefox/WebKit and actual native200% browser zoom remain unverified;720×500 reflow was checked instead. Independent source/fixture QA is recorded separately and is not represented as browser testing. Production verification follows the user-authorized deployment; no production data was modified during local testing.
