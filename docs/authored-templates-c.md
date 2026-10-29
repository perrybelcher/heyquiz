# Diagnostic and scorecard editorial specification

Status: author review complete; awaiting rotated review and independent integrated QA.

## Outcome blueprints (defined before questions)

- Lead generation: `clarity` covers audience and offer; `access` covers visibility and enquiry experience; `followthrough` covers follow-up and measurement. The result identifies a place to investigate, never a proven cause of low sales.
- Team diagnostic: `direction` covers priorities, completion criteria and changes; `handoffs` covers context, ownership and decisions; `capacity` covers commitments and interruptions. It does not judge individuals.
- Retention diagnostic: `value` covers expectation and first use; `service` covers support and repeat-purchase friction; `relevance` covers follow-up timing and preferences. It does not claim to establish the cause of customer churn.
- Marketing scorecard: audience, positioning, visibility, conversion, follow-up and measurement are six separate categories. Each has five distinct practices.
- Onboarding scorecard: expectations, handover, first use and check-in each have two practices.
- Operations scorecard: priorities, ownership, capacity and learning each have two practices.

Every diagnostic challenge has an explanation, three specific actions and an editable optional next-step CTA. No URL names an invented business. These are operational reflection examples, not validated assessments or industry benchmarks. No external factual or scientific claim is required by these six templates.

## Questions and evidence

Diagnostic questions offer concrete states: a gap, a partial practice, an established practice and unknown/not applicable. They ask what happens, rather than whether a participant is good at their work. Repeated state structures are deliberate; the situations and actions tested are distinct. Each question maps only to the relevant challenge. Results say that the answers suggest investigation, not that every gap in a category was observed. Per-answer reasons identify the question and the selected gap/partial state.

Each challenge has a maximum of six evidence points. A gap contributes 6 divided by the number of questions for that challenge; a partial practice contributes half that. This makes the short 3/3/2 question layouts comparable rather than favoring the challenge with more questions. Established and unknown answers have no rules and contribute no positive challenge evidence. Two points are required for a match. These are example routing thresholds, not empirical cutoffs. A tie uses the displayed challenge order. No result is returned for all-established, all-unknown or missing answers; the fallback explains the possible reasons without claiming the business has no problems.

Scorecard questions use the same observable frequency scale: not yet=0, sometimes=1, usually=2, consistently=3. Unknown/not applicable has no rule and is excluded from both numerator and answered coverage. A reported absence is a real zero, distinct from unknown. The last-three-month instruction gives a common reference period without imposing a business benchmark. Each long category needs at least three of five answered practices; each short category needs both of two. Category percentages are rounded by the existing evaluator, with equal category weight in the overall score. Overall feedback is withheld until every category meets coverage.

Bands are intentionally examples: 0–33 build the foundation, 34–66 make it repeatable, 67–100 maintain and refine. Each category has a different concrete action for each level. All 30 questions are on the normal path, using the existing per-question description for theme labels; no branching or extra navigation exists.

## Publication and design

All forms are ordinary typed drafts with editable existing themes. Diagnostic outcomes and scorecard band CTA URLs start empty. The examples make no promise to send email or contact another company. A creator who enables a link must supply their actual destination. No provider or tracking settings are added. Required questions include a neutral choice, so participants can complete without inventing evidence.

## Fixtures and verification

`tests/fixtures/authored-templates-c.json` contains one literal fully answered path per example: clarity, direction, value, and 67-point scorecards. `tests/authored-templates-c.cjs` independently specifies the question groups for every diagnostic outcome and verifies each route, balanced ties, established/unknown fallbacks, full paths, stable counts, cloning, publication references and six themes of five. Scorecard tests cover zero, 33, 67, 100, middle bands at 50/60, all-unknown, incomplete coverage and the exact minimum coverage.

## Question-by-question rationale

The following inventory links each distinct question to the evidence it contributes. For diagnostics, gap and partial answers contribute the stated challenge evidence; established and unknown do not. For scorecards, the stated practice is the unit measured in its category; no inference about financial or employee performance is made.

### What is holding back your lead generation?

| Question ID | Evidence examined | Result/category |
|---|---|---|
| audience-situation | When a new prospect asks who you help, what can you describe? | clarity |
| audience-evidence | Where does your picture of your customers' problems come from? | clarity |
| audience-fit | What happens when an enquiry falls outside your usual service? | clarity |
| audience-language | When you write marketing copy, which words describe the problem? | clarity |
| audience-change | When customer needs change, how do you find out? | clarity |
| offer-scope | What can a visitor learn about the scope of your main offer? | clarity |
| offer-difference | How do visitors distinguish your main packages or services? | clarity |
| offer-evidence | What supports the claims on your main offer page? | clarity |
| offer-cost | Before enquiring, what can a visitor learn about cost? | clarity |
| offer-next | What does your main call to action tell a visitor? | clarity |
| visibility-location | Where can someone with your main customer problem discover you? | access |
| visibility-info | When your contact details or services change, what happens to public listings? | access |
| visibility-intent | What does your latest public content help a prospective buyer do? | access |
| visibility-route | When someone follows a link from a post or listing, where do they land? | access |
| visibility-maintenance | Who checks that your active discovery channels still work? | access |
| enquiry-mobile | What happens when you try to enquire from a small phone screen? | access |
| enquiry-fields | What information must someone provide before asking an initial question? | access |
| enquiry-error | If a visitor makes a form-entry mistake, what happens? | access |
| enquiry-confirm | What does a person see after submitting an enquiry? | access |
| enquiry-alternative | If your main enquiry method is unsuitable for a visitor, what can they do? | access |
| followup-hours | When an enquiry arrives outside business hours, what usually happens? | followthrough |
| followup-owner | When two people could reply to the same enquiry, how is ownership settled? | followthrough |
| followup-context | What can the person replying see about the original enquiry? | followthrough |
| followup-stalled | How are enquiries with an agreed future next step tracked? | followthrough |
| followup-stop | What happens when a prospect asks you to stop contacting them? | followthrough |
| measurement-source | How do you learn where an enquiry came from? | followthrough |
| measurement-stage | How do you distinguish an enquiry from a paying customer in your records? | followthrough |
| measurement-period | When comparing marketing activity with customers, which records do you use? | followthrough |
| measurement-reasons | What do you record when an enquiry does not proceed? | followthrough |
| measurement-review | What follows a review of your enquiry data? | followthrough |

### What is slowing down your team?

| Question ID | Evidence examined | Result/category |
|---|---|---|
| team-priority | When two urgent tasks arrive together, how is the next task chosen? | direction |
| team-done | Before work starts, how is a finished task described? | direction |
| team-change | What happens when a request changes halfway through work? | direction |
| team-handoff | When work passes to another person, what goes with it? | handoffs |
| team-owner | How does a colleague find who owns a blocked task? | handoffs |
| team-decision | Where can someone find a decision made while they were absent? | handoffs |
| team-load | What happens when planned work exceeds the available time? | capacity |
| team-interrupt | How are incoming requests handled during focused work? | capacity |

### Why do customers stop buying?

| Question ID | Evidence examined | Result/category |
|---|---|---|
| return-purpose | After a first purchase, what helps a customer use what they bought? | value |
| return-fit | When a customer says the purchase was not what they expected, what do you learn? | value |
| return-progress | How can you tell whether customers reached the benefit they wanted? | value |
| return-support | When a customer reports a problem, what happens next? | service |
| return-resolution | How do you check that a reported problem was resolved? | service |
| return-friction | What happens when a returning customer tries to reorder or renew? | service |
| return-timing | How do you decide when to contact a past customer about buying again? | relevance |
| return-choice | What can a customer do if your follow-up messages no longer suit them? | relevance |

### Small Business Marketing Health Check

| Question ID | Evidence examined | Result/category |
|---|---|---|
| mh-audience-trigger | How consistently do you record what prompted a new customer to seek help? | audience |
| mh-audience-language | How consistently do you keep customers' own descriptions of the problem for future copy? | audience |
| mh-audience-segment | How consistently do you identify which customer group a campaign is intended to reach before writing it? | audience |
| mh-audience-interview | How consistently do you ask recent customers what mattered when choosing a provider? | audience |
| mh-audience-limits | How consistently do you explain when your offer is unsuitable for an enquiry? | audience |
| mh-positioning-scope | How consistently do offer pages state what is included and what is outside the scope? | positioning |
| mh-positioning-tradeoff | How consistently do you explain practical trade-offs between your packages? | positioning |
| mh-positioning-proof | How consistently do you include the context and limitations of customer examples you publish? | positioning |
| mh-positioning-price | How consistently do you explain prices or the factors used to prepare a quote? | positioning |
| mh-positioning-promise | How consistently do sales conversations and website copy describe the same offer? | positioning |
| mh-visibility-route | How consistently do you maintain at least one discovery channel that customers say they use? | visibility |
| mh-visibility-listings | How consistently do you update public listings when contact details or services change? | visibility |
| mh-visibility-content | How consistently does your published content address a specific question customers have asked? | visibility |
| mh-visibility-links | How consistently do you check links from active posts, listings or campaigns? | visibility |
| mh-visibility-owner | How consistently does a named person review your active public channels? | visibility |
| mh-conversion-mobile | How consistently do you test the enquiry process on a small phone screen after changing it? | conversion |
| mh-conversion-action | How consistently do calls to action explain what happens after a person clicks? | conversion |
| mh-conversion-fields | How consistently do you limit required enquiry fields to information needed for the first response? | conversion |
| mh-conversion-errors | How consistently do you check that form errors explain the fix and preserve valid input? | conversion |
| mh-conversion-confirm | How consistently do enquiry confirmations set realistic expectations for a response? | conversion |
| mh-followup-owner | How consistently is a single owner recorded for each new enquiry? | followup |
| mh-followup-hours | How consistently are out-of-hours enquiries picked up at the next stated check time? | followup |
| mh-followup-context | How consistently can the person replying see the original request and earlier conversation? | followup |
| mh-followup-next | How consistently do active enquiries have an agreed next action and date? | followup |
| mh-followup-preference | How consistently are requests to stop contact reflected in the shared enquiry record? | followup |
| mh-measurement-source | How consistently do you record the source of an enquiry using agreed labels? | measurement |
| mh-measurement-stage | How consistently do enquiry stages use the same definitions across the team? | measurement |
| mh-measurement-period | How consistently do reports use defined periods and account for customers who decide later? | measurement |
| mh-measurement-loss | How consistently do you distinguish stated reasons for not buying from reasons you do not know? | measurement |
| mh-measurement-action | How consistently does a marketing review produce an owner, action and review date? | measurement |

### Customer Onboarding Scorecard

| Question ID | Evidence examined | Result/category |
|---|---|---|
| onboarding-scope | How consistently do new customers receive a written summary of the agreed scope? | expectations |
| onboarding-milestone | How consistently do you agree the first useful milestone with the customer? | expectations |
| onboarding-promises | How consistently does the delivery team receive the promises made during the sale? | handover |
| onboarding-contact | How consistently does a new customer know their main contact and how to reach them? | handover |
| onboarding-access | How consistently do you check that a customer has the access or materials needed to begin? | activation |
| onboarding-task | How consistently do you guide a new customer through the first task that delivers value? | activation |
| onboarding-friction | How consistently do early check-ins ask about obstacles rather than only general satisfaction? | checkin |
| onboarding-next | How consistently is an owner and date recorded for issues raised during onboarding? | checkin |

### Team Operations Scorecard

| Question ID | Evidence examined | Result/category |
|---|---|---|
| ops-priorities | How consistently does the team agree which tasks take priority when requests compete? | priorities |
| ops-scope | How consistently do changes to a task include an explicit scope or timing trade-off? | priorities |
| ops-owner | How consistently can someone see the owner of an active task without asking around? | ownership |
| ops-handoff | How consistently do handoffs include current files, context and the next action? | ownership |
| ops-load | How consistently do you compare planned work with available team time before committing? | capacity |
| ops-interruptions | How consistently are nonurgent incoming requests queued without interrupting focused work? | capacity |
| ops-done | How consistently are acceptance conditions agreed before work begins? | learning |
| ops-review | How consistently does a completed-work review produce a concrete change for the next cycle? | learning |
