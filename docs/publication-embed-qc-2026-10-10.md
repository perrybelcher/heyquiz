# Publication, embeds, branching and readiness — 10 October 2026

## Feature

Publish now opens a keyboard-accessible native dialog reviewing structure, scoring diagnostics, missing recommendation links and lead-capture/privacy settings. Empty quizzes and invalid structure block the confirmation; advisory scoring/capture notes do not. The dialog explains that publishing replaces the public/embedded version and reminds creators to preview complete journeys. Cancel/Escape returns to the editor. Confirmation saves current edits before publishing; failures close the dialog so the existing recovery message remains visible.

## Verification

All tests used isolated local synthetic quizzes. Production build, TypeScript and component lint passed (existing filesystem tracing warnings remain).

Chrome, Firefox and Playwright WebKit each passed:
- Scorecard and segmentation completion journeys.
- Forward jump skips a required middle question; Back and a changed answer restore it; revised path completes.
- Hidden campaign attribution is retained.
- Readiness cancellation does not publish; confirmation enables public starts.
- Unpublished draft changes remain absent from anonymous starts until republishing.
- Republish exposes the new title; an attempt started on the previous version retains its previous result advice.
- Multi-select ties resolve by result order; exclusion overrides positive points.
- A 390px-wide host page embeds the quiz from a different origin/site (localhost versus 127.0.0.1). The embedded quiz completes without horizontal overflow in host or child.
- The embedded CTA navigates to the test offer, and persisted analytics records exactly one offer click, one result view, and four expected completions across the controlled API/UI cases.

Additional Chrome checks passed: existing sharing flow; all four guest launch modes and unpublished-edit status; readiness on mobile blocks an empty quiz, displays optional capture/marketing-off/privacy guidance, and dismisses with Escape.

## Limits

WebKit is Playwright's browser engine, not a physical iPhone or the installed Safari application. Embeds were tested against a separately hosted local fixture, not arbitrary customer site CSP, consent managers or production browser extensions. This pass confirms never-published link behavior; it does not add an unpublish feature. Readiness checks do not guarantee every complex logic path or editorial claim is correct. No production submissions, customer emails, CRM or Stripe work were part of this pass.

Screenshots: /tmp/pippi-embed-chrome.png, /tmp/pippi-embed-firefox.png, /tmp/pippi-embed-webkit.png, /tmp/pippi-publish-readiness.png.
