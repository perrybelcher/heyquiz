# Help depth and persistent support — 13 October 2026

## Delivered locally
- Expanded the core guide from 18 to 28 structured articles. Added worked scoring, Form/Cards, conditional results, concrete report-design controls, missing-email troubleshooting, preview versus publication, unavailable links, a first-test plan, responsible quiz copy and assistant limitations.
- Article tables of contents. Search removes common filler words and promotes the actual Form/Cards and page-grouping guides for layout questions; representative retrieval tests guard usefulness.
- Bottom-left Ask Pippi launcher in the shared product layout. Collapsible, keyboard-accessible, responsive nonmodal panel. Conversation survives minimize/reopen and clears on reload or Clear conversation. Lazy-loaded chat UI.
- Shared chat component powers the portal and widget. Clear AI identification, provider disclosure, cited guide links, guest sign-in guidance with immediately useful public articles, timeouts and retained question on failure. No fake human availability, promised response time or imaginary ticket creation.
- Explicitly excludes customer-facing player, experiment and result routes and all iframe/embed contexts. Chat contains no auto-collected route, quiz or contact content. Strict Clarity masking remains intact.

## Evidence
- Production build, TypeScript, scoped lint, whitespace checks passed.
- 28 unique structured guides and retrieval examples pass (`tests/help-content.cjs`). Source validation, malformed-response fallback and authentication provider-mock tests pass.
- Local Chromium widget checks: availability on creation, blank editor, login, help and article pages; guest guide suggestions; minimize/reopen; Escape focus restoration; mobile viewport fit; mocked cited answer; conversation clearing and embed exclusion.
- Shared help/grouped-form acceptance still passes. No real AI or external messages were sent, no cloud data changed.
- Mobile screenshot visually reviewed; panel fits viewport and scrolls independently.

## Limits
Local commit only, not deployed. Gemini is intentionally absent from the isolated preview, so authenticated requests fall back to guide links. A real provider response and hosted verification remain release tasks. This is guide-based AI support, not a staffed inbox or account-operating agent. Guides cover the core product and common failure modes; deeper advanced-feature documentation can continue as those capabilities stabilize.
