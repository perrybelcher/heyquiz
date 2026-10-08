# HeyQuiz competitive gap review

Reviewed 8 October 2026. Scope: ScoreApp, Perspective, Heyflow and involve.me. Evidence: public product/help pages compared with current HeyQuiz source. This is a feature and positioning audit, not hands-on testing of paid competitor accounts or independent validation of conversion claims. Availability can depend on plan. No live conversion experiment was started.

## Decision

HeyQuiz has the core of a marketing quiz platform, but does not yet match these products end to end. Attractive analytics and many question types alone will not differentiate us. Our strongest direction is thoughtful question design, explainable recommendations, and analytics that connect decisions to business outcomes. This is a strategy, not a proven performance advantage.

## Competitive benchmarks

| Competitor | Benchmark | Material HeyQuiz gap |
| --- | --- | --- |
| ScoreApp | Category scores, personalized results, dynamic PDFs and supporting landing pages | Category scoring exists; flexible result/landing-page design and personalized report delivery do not. |
| Perspective | Mobile-first funnels, campaign metrics, A/B tests, messages and client workspaces | Responsive player exists; no native experiments, campaign dashboard, email sequences or client/team workspace system. |
| Heyflow | Flow map, page/device analytics, custom traffic splits, verification, server tracking and payments | Conditional paths and browser events exist; no visual map, experiment assignment, device reporting, OTP, conversion API or payment processor. |
| involve.me | Quiz/calculator flows, CRM/email workflows, experiments, payments and custom domains | Quizzes, calculations, contacts and connector pilots exist; not a full CRM/workflow service, checkout or domain onboarding. |

Sources: [ScoreApp features](https://www.scoreapp.com/features/), [Perspective platform](https://www.perspective.co/), [Perspective metrics](https://www.perspective.co/metrics), [Heyflow](https://heyflow.com/), [involve.me](https://www.involve.me/). These are vendor descriptions, not independently measured results.

## Current implementation

| Capability | Status | Evidence and limit |
| --- | --- | --- |
| Fields and conditional logic | Built | `lib/schema.ts`, `lib/engine.ts`, `components/EditorStudio.tsx`. Broad field palette, calculations and paths; count alone is not parity. |
| Product recommendations | Built, basic presentation | `lib/marketing.ts`: weighted matches, exclusions, reasons, fallback and outcome CTA. No live catalog, inventory, variants, cart or orders. |
| Audience segmentation | Built | Outcome rules and result-specific advice/CTA. No native branching nurture workflow. |
| Category scorecards | Built | Category scores and minimum-answer requirements. No personalized PDF/report designer. |
| Lead capture | Built | Optional/required capture before or after results, with consent settings. No verified email/phone ownership. |
| Conversion analytics | Built, partial parity | `lib/analytics.ts`: starts, finishes, leads, views, offer clicks, daily cohorts, segments, median time and quiet unfinished sessions. Quiet sessions are not confirmed abandonment. |
| Attribution | Partial | Hidden URL fields can capture UTMs. No acquisition/device dashboard, revenue events or ROAS. A click is not a purchase. |
| Retargeting | Partial | Consent-gated GA4/Meta events with question/event selection. No conversion API, TikTok, GTM container or server-event deduplication. |
| Integrations | Pilot | Ten requested provider adapters plus direct GoHighLevel/webhooks. Nine Nango definitions configured; Keap credentials missing. Authorization and real delivery validation remain. Previous adapter tests used mocks. |
| AI authoring | Partial | `lib/agent-generator.ts` drafts questions with configured Gemini. Not a complete strategy/scoring/results/branding agent. Persuasion skills are not a verified generation pipeline. |
| Publishing | Basic built | Hosted links and embeds. No per-account domain verification/SSL lifecycle. |
| Booking / payments | Missing | The scheduler field requests a preferred time; it does not reserve a calendar slot. Currency fields are not payment processing. |
| Account lifecycle | Launch gap | Provisioned-account login only. No public signup, self-service billing or in-app recovery flow. |
| Teams / agencies | Missing | Owner isolation exists; team invites, roles, client subaccounts, collaborative editing and audit history do not. |
| Public positioning | Improved in this release | Sales page, working matching sample, use cases and analytics illustration. No fabricated proof or trial offer. |

## Prioritized backlog

### P0: before calling it a self-service MVP

1. **Account onboarding and recovery.** Signup, verification, reset, first-quiz checklist and explicit access/plan model. Acceptance: a new tester can register, recover access, create, preview, publish and inspect results without an administrator.
2. **One dependable follow-up path.** Prioritize GoHighLevel and one email provider. Acceptance: authorized sandbox delivery of consent, segment and score; retries, duplicates, expired credentials and reauthorization covered. Configured does not mean production-proven.
3. **Flexible intro/result composer.** Product images, reasons, score visuals, advice, next-step links, mobile preview and fallbacks. Acceptance: all three marketing use cases can produce distinct polished results without custom code.
4. **Measurement integrity and source reporting.** Structured campaign attribution, device groups, quiz revision tracking and event reconciliation. Acceptance: synthetic journeys reconcile start → finish → lead → result → click, with exclusions explained. Add revenue only after purchase-event verification.
5. **Release readiness.** Privacy/terms, support route, error monitoring, restore rehearsal, operational alerts, accessibility and abuse checks. No implied certifications or guarantees.

### P1: competitive credibility

6. **Native A/B tests:** stable assignment, immutable variants, traffic allocation, preview exclusion, sample counts and uncertainty. Build/test synthetically first; no automatic winners from weak data.
7. **Branded publishing:** verified custom domains, certificate states, sharing metadata and responsive embeds.
8. **Personalized reports:** branded PDFs, secure downloads and explicitly configured email delivery. Closes a specific ScoreApp gap.
9. **Commerce depth:** product catalog/images, availability-aware matching, multiple recommendations, cart handoff and purchase events. Linking to an offer is only the first step.
10. **Advanced tracking/quality:** consent-aware server events and deduplication, additional ad platforms and optional ownership verification.
11. **Template/onboarding library:** distinct buyer journeys, previews and explained rules. Do not describe untested templates as proven winners.

### P2: surpass through focus

12. **Persuasive question assistant:** goal → obstacle → preferences → decision criteria → recommendation. Flag intrusive, repetitive or overly promotional questions. Explain each question's purpose for the creator.
13. **Answer-to-action analytics:** connect answer patterns to qualified leads, clicks and verified purchases. Show evidence coverage and uncertainty, not unsupported causality.
14. **Visual journey editor:** branches, exclusions, capture timing and outcomes in one view; detect unreachable results before publishing.
15. **Agency workflows:** roles, client workspaces, change history and approvals after core solo use is dependable.

## Sales-page strategy

Competitor pages combine outcome-led headlines, product demonstrations, use cases, customer proof and repeated CTAs. Their maturity includes complete signup journeys. HeyQuiz cannot replace missing evidence with invented testimonials or uplift claims.

Our positioning: **The right question changes everything.** The narrative is curiosity → feeling understood → relevant recommendation → meaningful next step. Original product artwork supports a working example using the existing matching engine. The example keeps answers in memory and sends no submissions or tracking events. Dashboard numbers are visibly illustrative; integrations are labeled pilot; access is described accurately. No pricing or free trial is invented.

`/welcome` always displays the sales page. Unauthenticated `/` displays it too; authenticated `/` remains the workspace. Publishing the product page does not start a live quiz conversion campaign.

Additional sources: [Perspective funnel builder](https://www.perspective.co/funnel) for branding/logic, [ScoreApp plan documentation](https://support.scoreapp.com/article/155-pricing) for plan-dependent capabilities, and [involve.me recommendations](https://www.involve.me/product-recommendation-quiz) for commerce positioning. Do not infer native catalog sync from a website embed claim.

**Recommended next work:** onboarding and the result-page composer, alongside campaign/revision measurement foundations. Live conversion tests remain paused until the user lifts the hold.
