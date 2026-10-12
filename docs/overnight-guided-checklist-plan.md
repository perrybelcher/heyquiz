# Guided checklist: bounded next-pass plan

12 October 2026. **Historical design plan.** Batch15 implements this bounded checklist; see `overnight-guided-checklist.md` and `overnight-batch15-quality.md` for acceptance evidence and limits. The original design below is retained as the review baseline. This addresses the persistent, exact-control checklist portion of acceptance item 2 in the [original competitive review](../../scoreapp-review-2026-10-11/Pippi-ScoreApp-Competitive-Review-2026-10-12.md). It does not complete every guided-editor requirement or establish faster unaided creation.

## Current behavior and constraints

`GuidedQuizEditor.tsx` renders five steps. Its launch checklist is visible only in Publish, derives a small list of issues during render, and routes each issue by numeric step. It cannot select a particular missing answer or reveal a particular result. The existing conversation-map navigation can select a question ID but supplies no field, answer or outcome target.

The first five target families already have controls in this component: quiz title; question wording; answer wording; recommendation/segmentation outcome destination; and capture privacy URL. All share the current draft and autosave. Recommendation results sit in native, initially closed `details` elements. Capture privacy exists only when capture is enabled. The selected question is currently an index into `orderedQuestions(form)`; stable IDs must be resolved against the current draft when an action is taken.

Subpanels were inspected. `ScorecardResultsEditor.tsx` has overall/category band fields with separate IDs, conditional presentation initialization and nested `details`; scorecard band URLs are **not** ordinary outcome URLs. `LandingPageEditor.tsx` maintains an independent cover title and nested sections. Editing the main quiz title currently also updates its cover title; preserve that established behavior, but do not pretend it targets a separately invalid cover headline or landing section. Neither subpanel needs modification for this first pass.

## Small user-facing change

Show one compact **Setup checklist** above the current step, available on all five steps. Keep it in normal document flow, not a fixed overlay competing with the mobile header. Its collapsed summary gives the counts of required fixes and recommended reviews; expanding it reveals plain-language buttons. Keep the same component mounted outside the conditional step body. Reuse it on Publish instead of rendering a second checklist.

Use the existing visual language and native disclosure behavior. Do not add a second wizard, completion percentage, stored checkbox state or automatic navigation. Derived items update immediately with the current draft. When there are no observed issues, say “These setup checks passed. Preview your intended journeys before sharing,” not “Ready” or “Fully tested.” Optional CTA/privacy recommendations can remain unresolved without a misleading incomplete-progress score.

## Stable targets and ownership of state

Proposed client-safe metadata in `lib/guided-checklist.ts`:

```ts
type GuidedChecklistTarget =
  | { kind: "quiz-title" }
  | { kind: "question-title"; questionId: string }
  | { kind: "answer-label"; questionId: string; answerId: string }
  | { kind: "outcome-cta"; outcomeId: string }
  | { kind: "capture-privacy" };

type GuidedChecklistItem = {
  id: string; // Stable tuple-derived identity, never wording or array position.
  message: string;
  level: "blocker" | "recommendation";
  source: "readiness" | "save" | "publish" | "editorial";
  target?: GuidedChecklistTarget;
  // Untargeted validator messages receive an honest section/advanced action.
  reviewSection?: "promise" | "questions" | "results" | "capture";
};
```

Use pure `buildGuidedChecklist(form)` and `resolveGuidedChecklistTarget(form, target)` functions. The resolver returns the current step and current IDs or an unavailable result; it never silently selects the first question/outcome. IDs may be encoded as JSON tuples for item keys. Do not parse IDs out of human error messages or concatenate them into unescaped CSS selectors.

The helper contains no DOM, storage, fetch, auth or record imports. Derived items are not saved in the quiz schema or localStorage. The component owns only disclosure state and a pending user navigation request `{requestId, quizId, target}`; refs hold mounted inputs and result disclosures by stable target key. A separate pure resolver makes reordered/deleted-target behavior testable without duplicating editing logic.

## Reveal and focus mechanics

| Target | Resolution | Reveal/focus |
|---|---|---|
| Quiz title | Your quiz, step 0 | Existing main quiz-title input. |
| Question title | Questions, step 1; find current question by ID | Set the current question selection, then focus its wording input after mount. |
| Answer label | Questions, step 1; find question and answer by IDs | Select question, then focus that answer's wording input, even after reorder. |
| Outcome CTA | Results, step 2; non-scorecard marketing and existing outcome ID | Open that result's native `details`, then focus Destination link. |
| Capture privacy | Publish, step 4; capture currently enabled | Focus Privacy-policy link. Do not enable capture on the user's behalf. |

Extend the local `field` helper with an optional input/textarea ref; register refs explicitly on these fields. Use a callback-ref map for dynamic questions/answers/results and a result-details map. Resolve on the click, change step/selection, then handle the pending request after the selected controls commit. Before focusing, recheck quiz ID, target existence, current step and request ID. Open the necessary disclosure, call `focus({preventScroll:true})`, then scroll the control into the nearest visible area with immediate scrolling. Do not animate users across the page or scroll on ordinary edits/autosaves.

Clear the request after handling. Explicit later step/question selection cancels it; a newer checklist action supersedes it. If a target disappears, changes kind, or capture is switched off while navigation is pending, cancel and announce that the item changed; keep the user's current work and never fall back to another field. Repeated clicks on the same item need distinct request IDs. Ordinary typing must not cause focus to be recaptured as the derived checklist changes.

Labels stay associated with inputs, buttons have visible focus treatment, and the disclosure has an accessible name. Announce a failed target resolution with a polite status. Avoid announcing the entire changing checklist after every keystroke. Keyboard and screen-reader focus should land on the field, not merely on a step heading.

## Validation boundary: preserve the actual policy

Three existing layers matter: `PublishReadiness.tsx` gates the confirmation button; `saveForm` parses `FormSchema` and calls reference/marketing validators; `publishForm` additionally checks landing/publication rules and result-email copy. The publish route also has an environment-dependent challenge check. Checklist UI cannot certify that server-only check.

Extract the current client readiness calculation **without changing its behavior** into a small client-safe `lib/publish-readiness.ts`, consumed by both the dialog and checklist. Keep the existing `validateFormReferences`, `validateMarketing(form, true)`, `validateLanding(cover, true)` and schema validation as the authorities; do not reproduce band/rule/URL validation in checklist predicates. Schema issues may be mapped by their structured path to a proven field. Unmapped validator failures remain explicit review items. Localized throw strings must not become the targeting contract.

| First-pass observation | Current policy to preserve |
|---|---|
| Blank quiz title / question title | Blocks the existing readiness dialog, despite the underlying string schema permitting blank text. Keep blocker classification. |
| Blank answer wording | Existing guided/conversation editorial issue; not itself a current publication gate. Recommend review without creating a new gate. |
| Missing non-scorecard outcome destination | Recommended; respondents may intentionally receive advice without an outbound button. |
| Missing capture privacy URL | Recommended under the current publishing policy; do not silently introduce new enforcement. |
| Invalid supplied outcome/privacy URL rejected by the existing schema | Save-blocking configuration problem; use that schema result. A stricter editorial URL check is not automatically a publication blocker. |
| Reference/scoring/landing failure from existing publication validators | Blocker/review message, with only a truthful section-level destination unless its structured target is known. |

Do **not** equate `inspectConversation().issues[].severity === "error"` with a publish blocker. It includes editorial/complete-URL checks that differ from the current gates. Reuse its editorial observations where helpful, adding optional structured field metadata in a narrow follow-on only if needed; do not infer answer identity from the aggregate `labels-{questionId}` issue. Enumerating blank labels by their stable option IDs is a presentational editorial check, not a parallel scoring validator.

Do not remove publish confirmation, disable publishing solely on recommendations, alter autosave/preview, or claim that passing client checks guarantees publication. Broader cleanup of differences between the existing dialog and server is outside this pass.

## Honest handoffs and file ownership

For unsupported exact targets, offer “Review scoring in advanced tools” or “Review landing page,” not “Fix this field.” Existing `onAdvanced()` only switches editor mode; it does not promise to select a particular tab or rule. Either retain that generic label, or coordinate a narrowly typed section callback through `EditorStudio.tsx` and verify the resulting tab. Do not reuse `editFromConversation` blindly: in guided mode it can deliberately route back into the guided step.

Suggested implementation split:

- **Checklist lane:** new `lib/guided-checklist.ts`, `components/GuidedQuizEditor.tsx`, dedicated unit/browser tests and feature notes. Exact first-pass targets stay entirely here.
- **Shared validation owner, coordinated sequentially:** new `lib/publish-readiness.ts` and extraction-only `components/PublishReadiness.tsx`; verify unchanged blockers/warnings. No storage/API/schema edits. A narrow `EditorStudio.tsx` callback belongs to its owner only if an actual section-targeted advanced handoff is included.
- **Independent acceptance:** parent reviews target resolution, blocker parity and compiled mobile/keyboard checks after the source freezes. No concurrent shared build.

No campaign, contact-filter, report, scoring, routing, provider or persistence feature changes are required. Scorecard bands, arbitrary landing sections, formulas and advanced rule-level focusing stay out of scope; this remains partial against the full original checklist bar.

## Meaningful acceptance

1. Pure fixtures distinguish existing title blockers from blank-answer/missing-CTA/missing-privacy recommendations; verify unchanged readiness-dialog results for ordinary, scorecard and invalid-rule drafts. Server/save validators remain authoritative.
2. One synthetic quiz has two incomplete questions, two empty answers in different questions and two outcomes. Every checklist button selects and focuses its intended field; outcome navigation opens the correct closed disclosure. Repairing a field updates only the corresponding derived item.
3. Reorder questions/answers/outcomes between render and navigation; IDs still identify the original target. Remove a target, switch marketing kind or disable capture while navigation is pending; there is no wrong-field fallback or lost work. Rapid two-item clicks and manual navigation cannot produce late focus theft.
4. Check availability across all five steps, a 320px viewport and keyboard-only use. Ensure no overlay/clipping, correct disclosure semantics, visible focus and no unsolicited scrolling while typing. Existing save/preview and publish confirmation continue to work.
5. Save/reload preserves the edited draft and derives the checklist afresh; no derived checklist state is persisted. A failed save does not report the quiz saved or open a stale preview. Use existing draft-safety coverage rather than rebuilding that feature.

These checks demonstrate routing and state correctness, not beginner comprehension or comparative usability. An unaided human creation session, observed errors and completion time remain unmeasured.

## Inspection record

Read-only source review covered `GuidedQuizEditor.tsx`, `ScorecardResultsEditor.tsx`, `LandingPageEditor.tsx`, `PublishReadiness.tsx`, the editor's publish/navigation handlers, `lib/journey-testing.ts`, schema/capture/marketing/landing/reference validators, and `lib/storage.ts` publication flow. Repository `AGENTS.md` and the installed Next.js `use client` guide were read. This pass created only this plan; no application changes, build, browser run, provider call or deployment occurred.
