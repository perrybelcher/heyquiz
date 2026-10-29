# Matching and qualification: editorial specification

## Shared design and limits

Six authored examples contain 92 substantive questions. Every question remains on the ordinary step path. Theme labels are descriptions, not new navigation. Four 8-question matching/qualification starters and the two 30-question examples use existing form schemas, themes and evaluators. All result URLs are intentionally empty and editable. Qualification publication must fail until a creator supplies the three destinations. Example thresholds, offers and courses are clearly labelled and must be reviewed before publication.

Matching evidence answers a/b/c contribute one point to their corresponding offer; coffee context answers and c03-a/b are neutral; unknown has no rule and contributes no evidence. Each question offers all three options. First listed eligible outcome wins a tie, disclosed in introductions. Exclusions override points. A single known answer can suggest a sample: results deliberately describe preferences and a conversation, not confirmed suitability. No fixed prices, scientific classification or fabricated business benchmarks appear.

Qualification uses explicit choice IDs and numeric comparisons. Unknown choices have no route condition; blank numeric fields are optional and do not pass a condition. A known preparation constraint can reach preparation even if other information remains unknown: this offers preparation, never permission for the gated service. Inclusive thresholds compile into separate equality and greater-than rules, preserving exact decimal boundaries. Additional context is saved with the response and prepares a provider conversation; it does not change eligibility. Result descriptions state this limit. No auto-redirect, contact capture requirement, integration or tracking configuration is added.

## Matching blueprints and evidence map

### Which website package fits your business? — website-package-30

Outcomes in tie order: **presence**, a small information site with contact links; **services**, service pages/case studies/enquiry form; **shop**, catalogue/cart/checkout. Presence and services explicitly exclude checkout. Answer w16-c excludes both, regardless of their points. The shop result still requires confirming payment, shipping, integrations and costs.

| Theme | Question evidence (a / b / c corresponds to presence / services / shop) |
|---|---|
| Business goals | w01 primary visitor task; w02 desired inbound response; w03 buying decision; w04 first review criterion; w05 promoted subject |
| Visitor needs | w06 essential visitor question; w07 guidance depth; w08 returning visitor task; w09 comparison subject; w10 mobile task |
| Content | w11 available source content; w12 information architecture; w13 useful imagery; w14 update type; w15 FAQ subject |
| Transactions | w16 **hard checkout requirement**; w17 pricing process; w18 immediate response workflow; w19 transaction record; w20 repeat purchase process |
| Operational requirements | w21 supported business system; w22 handover owner; w23 handover risk; w24 training procedure; w25 source record consistency |
| Ongoing management | w26 routine editing work; w27 handover training; w28 maintenance check; w29 expected expansion; w30 ongoing team responsibility |

The six themes distinguish goals, user tasks, assets, transaction mechanics, operating handovers and maintenance. Questions about similar subject matter ask different decisions; they are not presented as independent proof of business success. All weights are equal because this is a preference brief, with checkout handled separately as a non-negotiable requirement. No branching shortens the 30-question example.

### Find your ideal coffee — ideal-coffee-8

Tie order: **bright**, fictional regular-caffeine fruit-forward sample; **balanced**, fictional regular-caffeine rounded sample; **decaf**, fictional decaffeinated sample. c03-c excludes both regular-caffeine offers. Decaf is not represented as caffeine-free or medically appropriate. No health eligibility is evaluated.

| ID | Evidence |
|---|---|
| c01 | Preferred sensory description |
| c02 | Usual drinking occasion; context only, no flavour inference |
| c03 | Explicit decaffeination requirement; required-decaf adds decaf evidence and excludes regular options; both regular-acceptable answers are neutral |
| c04 | Preferred preparation and drink style |
| c05 | Brewing equipment; context only for supplier preparation |
| c06 | Preferences of people sharing the bag |
| c07 | Whole-bean/ground sample format; context only |
| c08 | How the sample will be used; context only |

These are preference signals, not claims that a brewing method guarantees a flavour. Results recommend checking the actual product and trying a small sample.

### Find your best workspace — best-workspace-8

Tie order: **day-pass**, occasional open-space use; **dedicated-desk**, recurring individual open-space desk; **private-office**, enclosed small-team office. s02-c excludes the two open-space offers. Private-office copy explicitly requires checking sound insulation and security: an enclosed room does not guarantee confidentiality.

| ID | Evidence |
|---|---|
| s01 | Frequency and team size |
| s02 | Hard requirement for an enclosed workspace |
| s03 | Storage/equipment continuity |
| s04 | Who works alongside the participant |
| s05 | Arrival/booking predictability |
| s06 | Control over physical setup |
| s07 | Planning/contract horizon |
| s08 | Preferred work environment |

## Qualification blueprints and evidence map

### Is your business ready for our implementation service? — implementation-fit-30

Three outcomes: **pilot**, **preparation**, **scoping**, evaluated in that priority. Displayed outcome order may differ from route order; route rules determine priority explicitly.

1. Pilot requires i01-a (defined existing-tool workflow), i06-a (authorised named owner), i11-a (documented pilot process), i16-a (authorised safe test data/access), i21 >= 4 confirmed staff hours/week and i26 >= 6 weeks before launch.
2. Preparation requires any explicit c answer on those four choice gates, i21 < 4 or i26 < 6. A preparation constraint therefore takes precedence over a simultaneous request for scoping.
3. Scoping requires any explicit b answer on the four choice gates.
4. Otherwise no-match asks for more information. Unknown gate answers never satisfy pilot readiness. Context choices never turn into eligibility points.

Thresholds are fictional service-design examples, not research-based standards. Numeric bounds: hours 0–80; weeks 0–104. Bounds constrain valid input, not a business quality judgment.

| Theme | Gating and contextual evidence |
|---|---|
| Use case | i01 **gate**; i02 candidate process; i03 initiating event; i04 desired first delivery; i05 scope exclusion |
| Ownership | i06 **gate**; i07 process contact; i08 review method; i09 pilot testers; i10 change approval |
| Process | i11 **gate**; i12 current delay; i13 exception handling; i14 pilot comparison; i15 fallback operation |
| Data | i16 **gate**; i17 data locations; i18 quality issue; i19 test-case coverage; i20 issue documentation |
| Resources | i21 **numeric gate**; i22 maintenance owner; i23 training format; i24 feedback method; i25 recurring cost clarification |
| Timing | i26 **numeric gate**; i27 schedule driver; i28 schedule risk; i29 expansion preference; i30 planning-conversation goal |

Each result describes only its route evidence and prompts a scoped next conversation/checklist. Context answers are not summarised as observed facts in static result copy.

### Find the right renovation next step — renovation-next-step-8

1. **assessment**: r01-b (possible structural/building-service work) AND r02-a (authority). This wins even if the schedule is short.
2. **brief**: r01-a (cosmetic work) AND r02-a AND r03 >= 4 weeks.
3. **research**: explicit information-first selection r01-c, missing permission r02-b/c, or known r03 < 4 weeks.
4. Unknown scope/authority/time alone gives no match.

| ID | Evidence |
|---|---|
| r01 | Scope gate |
| r02 | Authority gate |
| r03 | Example planning-window gate, 0–104 weeks |
| r04 | Area of work, context |
| r05 | Occupancy during work, context |
| r06 | Available briefing materials, context |
| r07 | Practical constraint to discuss, context |
| r08 | Desired first-conversation output, context |

No property safety assessment, permission determination or promise of availability is made. Structural/service changes are directed toward qualified local advice; this template does not teach construction operations.

### Which training route can you join? — training-route-8

1. **applied**: t01-a (self-reported table/formula skills), t03-a (software access) and t02 >= 2 practice hours/week.
2. **foundations**: t01-b or c, t03-a and t02 >= 1 hour/week, using separate all-groups for the two skill answers.
3. **orientation**: explicit t03-b/c, t02 < 1, or t01-a with t02 < 2. An experienced participant with 1–2 hours gets orientation rather than a beginner course they did not request.
4. Missing prerequisites do not qualify for applied/foundations; unknown alone gives no match.

| ID | Evidence |
|---|---|
| t01 | Self-reported skill gate, not a skills examination |
| t02 | Practice-time gate, 0–40 hours/week |
| t03 | Software access gate |
| t04 | Intended application, context |
| t05 | Relevant fictional practice data, context |
| t06 | Support preference, context |
| t07 | Practice schedule, context |
| t08 | First practical use, context |

Course requirements are fictional and subject to a provider's review. No enrolment or certification is confirmed.

## Fixtures and verification

`tests/fixtures/authored-templates-b.json` supplies a fully answered literal path for each template, including all 30 questions in each comprehensive example. `tests/authored-templates-b.cjs` additionally checks all 18 outcomes, count totals, schema validity, nonblank choices, reference validity through publication validation, clone independence, neutral inputs, tie ordering, hard exclusions, overlapping route priority, invalid and unknown numeric inputs, exact fractional boundaries, context neutrality and theme neutrality. Qualification publication blocks blank CTA URLs, then passes with synthetic `example.test` destinations. No live transports or customer records are used.

Editorial self-review: all questions ask one concrete task/decision; neutral options are unmapped; numeric unknowns remain blank; no prices or invented external destinations; all outcomes have descriptions, limits and next steps. Peer review by C identified repeated coffee preferences and unsupported timing/regular-caffeine weights. Replaced three repeated prompts with equipment, bag-format and tasting-plan context; all four context prompts and regular-acceptable requirement answers now have no points. Added neutral-context assertions. No qualification issues identified in that review.
